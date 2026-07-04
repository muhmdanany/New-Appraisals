import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import {
  useEvaluationFormData,
  useCreateEvaluation,
  useUpdateEvaluation,
  useSubmitEvaluation,
  getEvaluationFormDataQueryKey,
  getListEvaluationsQueryKey,
  useGetEvaluation,
  getGetEvaluationQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { SelectField } from "@/components/form-fields";
import { Loader2, Save, Send, Plus, X, BookOpen, ChevronDown, ChevronUp, ChevronsUpDown, Star } from "lucide-react";
import { CriteriaGuideDialog } from "./index";

/* ───── Rating row (1–5 buttons matching Vercel UI) ───── */

const RATING_COLORS: Record<number, string> = {
  5: "#1a7f4b",
  4: "#27ae60",
  3: "#2a6db5",
  2: "#b87d12",
  1: "#c0392b",
};
function getRatingLabels(t: (key: string) => string): Record<number, string> {
  return {
    5: t("evaluations.ratingLabels.5"),
    4: t("evaluations.ratingLabels.4"),
    3: t("evaluations.ratingLabels.3"),
    2: t("evaluations.ratingLabels.2"),
    1: t("evaluations.ratingLabels.1"),
  };
}

function RatingRow({
  label,
  value,
  onChange,
  ratingLabels,
}: {
  label: string;
  value?: number;
  onChange: (v: number) => void;
  ratingLabels: Record<number, string>;
}) {
  const maxScore = Math.max(...Object.keys(ratingLabels).map(Number), 5);
  const scores = Array.from({ length: maxScore }, (_, i) => maxScore - i);
  const getColor = (n: number) => {
    const ratio = (n - 1) / (maxScore - 1);
    if (ratio <= 0.2) return "#c0392b";
    if (ratio <= 0.4) return "#b87d12";
    if (ratio <= 0.6) return "#2a6db5";
    if (ratio <= 0.8) return "#27ae60";
    return "#1a7f4b";
  };
  const activeColor = value ? getColor(value) : undefined;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-3 last:border-0">
      <div className="min-w-[140px] flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
      </div>
      <div className="flex items-center gap-2 min-w-[280px]">
        {/* Dots on line */}
        <div className="relative flex items-center w-full max-w-[200px]">
          {/* Background line */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-border rounded-full" />
          {/* Active fill line — from low end towards selected value */}
          {value && (
            <div
              className="absolute top-1/2 -translate-y-1/2 h-[2px] rounded-full transition-all end-0"
              style={{
                width: `${((value - 1) / (maxScore - 1)) * 100}%`,
                background: activeColor,
              }}
            />
          )}
          {/* Dots */}
          <div className="relative flex items-center justify-between w-full">
            {scores.map((n) => {
              const isActive = value === n;
              const isPast = value !== undefined && n <= value;
              return (
                <button
                  key={n}
                  type="button"
                  title={ratingLabels[n]}
                  onClick={() => onChange(n)}
                  className="relative z-10 rounded-full transition-all"
                  style={{
                    width: isActive ? 18 : 12,
                    height: isActive ? 18 : 12,
                    background: isPast && activeColor ? activeColor : isActive ? activeColor : "#fff",
                    border: isPast && activeColor ? `2px solid ${activeColor}` : isActive ? `2px solid ${activeColor}` : "2px solid #aaa",
                    boxShadow: isActive ? `0 0 0 3px ${activeColor}30` : "none",
                    cursor: "pointer",
                  }}
                />
              );
            })}
          </div>
        </div>
        {/* Selected label — next to the bar */}
        <span className="text-[10px] font-semibold whitespace-nowrap min-w-[60px]" style={{ color: activeColor }}>
          {value ? ratingLabels[value] : ""}
        </span>
      </div>
    </div>
  );
}

/* ───── Live score calculator ───── */

function calculateLiveScore(opts: {
  mode: string;
  kpiWeight: number;
  sharedScores: Record<string, number>;
  jobScores: Record<string, number>;
  kpis: { achievement: number | "" }[];
  ratingLabels: Record<number, string>;
}) {
  const { mode, kpiWeight, sharedScores, jobScores, kpis, ratingLabels } = opts;
  const compWeight = 100 - kpiWeight;

  // Competency score: average of all scores (1-5 → mapped to 0-100)
  const compValues: number[] = [];
  if (mode !== "SPECIFIC") {
    Object.values(sharedScores).forEach((v) => compValues.push(v));
  }
  if (mode !== "SHARED") {
    Object.values(jobScores).forEach((v) => compValues.push(v));
  }
  const competencyScore =
    compValues.length > 0
      ? (compValues.reduce((a, b) => a + b, 0) / compValues.length / 5) * 100
      : null;

  // KPI score: average of achievement percentages
  const kpiValues = kpis
    .filter((k) => k.achievement !== "")
    .map((k) => Number(k.achievement));
  const kpiScore =
    kpiValues.length > 0
      ? kpiValues.reduce((a, b) => a + b, 0) / kpiValues.length
      : null;

  // Total score
  let totalScore: number | null = null;
  if (competencyScore !== null && kpiScore !== null) {
    totalScore = Math.round(competencyScore * (compWeight / 100) + kpiScore * (kpiWeight / 100));
  } else if (competencyScore !== null && kpiWeight === 0) {
    totalScore = Math.round(competencyScore);
  } else if (kpiScore !== null && compWeight === 0) {
    totalScore = Math.round(kpiScore);
  } else if (competencyScore !== null) {
    // KPIs not filled yet — show competency-only score as preview
    totalScore = Math.round(competencyScore * (compWeight / 100));
  } else if (kpiScore !== null) {
    totalScore = Math.round(kpiScore * (kpiWeight / 100));
  }

  // Rating label
  let ratingLabel: string | null = null;
  if (totalScore !== null) {
    if (totalScore >= 90) ratingLabel = ratingLabels[5];
    else if (totalScore >= 75) ratingLabel = ratingLabels[4];
    else if (totalScore >= 60) ratingLabel = ratingLabels[3];
    else if (totalScore >= 40) ratingLabel = ratingLabels[2];
    else ratingLabel = ratingLabels[1];
  }

  return { competencyScore, kpiScore, totalScore, ratingLabel };
}

/* ───── Evaluation form body ───── */

export type EvaluationInitial = {
  period: string;
  mode: string;
  kpiWeight: number;
  sharedScores: Record<string, number>;
  jobScores: Record<string, number>;
  kpis: { name: string; achievement: number }[];
};

export function EvaluationFormBody({
  employeeId,
  evaluationId,
  initial,
  initialTemplateId,
  evalType = "EMPLOYEE",
  period: periodProp,
  mode: modeProp,
}: {
  employeeId: string;
  evaluationId?: string;
  initial?: EvaluationInitial;
  initialTemplateId?: string;
  evalType?: string;
  period?: string;
  mode?: string;
}) {
  const hasEmployee = Boolean(employeeId);
  const [templateId, setTemplateId] = useState<string | undefined>(initialTemplateId);

  // Fetch available templates filtered by evalType.
  const { data: templates } = useQuery<{ id: string; name: string; isDefault: boolean; evalType: string }[]>({
    queryKey: ["eval-templates", evalType],
    queryFn: async () => {
      const uid = localStorage.getItem("selectedUserId");
      const h: Record<string, string> = { "Content-Type": "application/json" };
      if (uid) h["X-User-Id"] = uid;
      const r = await fetch(`/api/admin/templates?evalType=${evalType}`, { headers: h });
      if (!r.ok) return [];
      return r.json();
    },
  });

  // Auto-select first template matching evalType if none chosen.
  if (!templateId && templates?.length && !evaluationId) {
    const def = templates.find((t) => t.isDefault) ?? templates[0];
    setTemplateId(def.id);
  }
  // If current templateId is not in the filtered templates list, reset it.
  if (templateId && templates?.length && !templates.find((t) => t.id === templateId)) {
    const def = templates.find((t) => t.isDefault) ?? templates[0];
    setTemplateId(def.id);
  }

  const formParams = templateId ? { employeeId, templateId } : { employeeId };
  const { data, isLoading } = useEvaluationFormData(
    formParams,
    { query: {
      queryKey: [...getEvaluationFormDataQueryKey({ employeeId }), templateId ?? ""],
      enabled: hasEmployee,
    } },
  );
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const RATING_LABELS_DEFAULT = getRatingLabels(t);

  // Fetch rating labels from evaluation settings
  const { data: evalSettings } = useQuery<{ ratingScale: number; ratingLabels: string[]; evaluationPeriods: string[]; defaultKpiWeight?: number }>({
    queryKey: ["eval-settings-labels"],
    queryFn: async () => {
      const uid = localStorage.getItem("selectedUserId");
      const h: Record<string, string> = { "Content-Type": "application/json" };
      if (uid) h["X-User-Id"] = uid;
      const r = await fetch("/api/settings/evaluation", { headers: h });
      if (!r.ok) return null;
      return r.json();
    },
  });

  // Use saved labels if available, otherwise fallback to defaults
  const RATING_LABELS = (() => {
    if (evalSettings?.ratingLabels?.length) {
      const labels: Record<number, string> = {};
      evalSettings.ratingLabels.forEach((l, i) => {
        labels[i + 1] = l || RATING_LABELS_DEFAULT[i + 1] || String(i + 1);
      });
      return labels;
    }
    return RATING_LABELS_DEFAULT;
  })();

  // Use saved periods if available
  const savedPeriods = evalSettings?.evaluationPeriods ?? [];

  const [guideOpen, setGuideOpen] = useState(false);
  const create = useCreateEvaluation();
  const update = useUpdateEvaluation();
  const submitEval = useSubmitEvaluation();

  const period = initial?.period ?? periodProp ?? `${t("evaluations.new.yearPrefix")} ${new Date().getFullYear()}`;
  const mode = initial?.mode ?? modeProp ?? "BOTH";
  const kpiWeight = initial?.kpiWeight ?? evalSettings?.defaultKpiWeight ?? 60;
  const [sharedScores, setSharedScores] = useState<Record<string, number>>(initial?.sharedScores ?? {});
  const [jobScores, setJobScores] = useState<Record<string, number>>(initial?.jobScores ?? {});
  const [kpis, setKpis] = useState<{ name: string; achievement: number | "" }[]>(
    initial?.kpis ?? [],
  );
  const [kpisSeeded, setKpisSeeded] = useState(Boolean(initial));
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Seed KPI rows from the job's saved KPIs on first load
  if (!kpisSeeded && data) {
    setKpisSeeded(true);
    if (data.kpis.length > 0) {
      setKpis(data.kpis.map((k) => ({ name: k.name, achievement: "" })));
    }
    // Initialize all sections as collapsed
    const init: Record<string, boolean> = { kpis: true };
    Object.keys(data.shared).forEach((cat) => { init[cat] = true; });
    if (data.jobCompetencies.length > 0) init["job"] = true;
    setCollapsed(init);
  }

  const showShared = mode === "SHARED" || mode === "BOTH";
  const showJob = mode === "SPECIFIC" || mode === "BOTH";

  const live = calculateLiveScore({ mode, kpiWeight, sharedScores, jobScores, kpis, ratingLabels: RATING_LABELS });

  const setShared = (key: string, v: number) =>
    setSharedScores((s) => ({ ...s, [key]: v }));
  const setJob = (key: string, v: number) =>
    setJobScores((s) => ({ ...s, [key]: v }));

  const toggleSection = (key: string) =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  const expandAll = () =>
    setCollapsed((c) => Object.fromEntries(Object.keys(c).map((k) => [k, false])));
  const collapseAll = () =>
    setCollapsed((c) => Object.fromEntries(Object.keys(c).map((k) => [k, true])));

  async function save(thenSubmit: boolean) {
    if (!period.trim()) {
      toast({ title: t("evaluations.new.periodRequired"), variant: "destructive" });
      return;
    }

    const filteredShared: Record<string, number> = showShared ? sharedScores : {};
    const filteredJob: Record<string, number> = showJob ? jobScores : {};
    const kpiList = kpis
      .filter((k) => k.name.trim() && k.achievement !== "")
      .map((k) => ({ name: k.name.trim(), achievement: Number(k.achievement) }));

    setSaving(true);
    try {
      let resultId: string;
      if (evaluationId) {
        await update.mutateAsync({
          id: evaluationId,
          data: { period, mode, kpiWeight, sharedScores: filteredShared, jobScores: filteredJob, kpis: kpiList },
        });
        resultId = evaluationId;
      } else {
        const result = await create.mutateAsync({
          data: {
            employeeId,
            period,
            mode,
            kpiWeight,
            sharedScores: filteredShared,
            jobScores: filteredJob,
            kpis: kpiList,
            templateId,
            evalType,
          },
        });
        resultId = result.id;
      }

      if (thenSubmit) {
        await submitEval.mutateAsync({ id: resultId });
        toast({ title: t("evaluations.new.savedSubmitted") });
      } else {
        toast({ title: t("evaluations.new.savedDraft") });
      }

      qc.invalidateQueries({ queryKey: getListEvaluationsQueryKey() });
      navigate(`/evaluations/${resultId}`);
    } catch {
      toast({ title: t("evaluations.new.saveFailed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (hasEmployee && isLoading) return <Skeleton className="h-64 w-full" />;
  if (hasEmployee && !data) return <p className="text-muted-foreground py-6 text-center">{t("evaluations.new.loadFailed")}</p>;

  return (
    <div className="space-y-4 relative">
      {/* Fixed side button — مرجع المعايير */}
      <button
        onClick={() => setGuideOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-[9999] bg-primary text-primary-foreground rounded-l-lg shadow-xl hover:opacity-90 transition-opacity px-2 py-6"
        title="مرجع معايير التقييم"
      >
        <span className="text-xs font-bold" style={{ writingMode: "vertical-rl" }}>مرجع المعايير</span>
      </button>
      <CriteriaGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* Employee header card */}
      <Card className="bg-gradient-to-l from-[hsl(219_62%_15%)] to-[hsl(212_67%_24%)] p-5 text-white">
        <div className="text-xs text-accent">{t("evaluations.new.formTitle")}</div>
        <div className="text-lg font-bold">{data?.employee?.name ?? "—"}</div>
        <div className="text-xs text-white/70">
          {data?.employee?.employeeNumber ?? ""}
          {data?.employee?.jobName ? ` · ${data.employee.jobName}` : ""}
          {data?.employee?.departmentName ? ` · ${data.employee.departmentName}` : ""}
        </div>
      </Card>

      {/* KPI Weight slider — read-only, controlled from admin settings */}
      <Card className="p-4">
        <div className="space-y-1.5">
          <Label>
            {t("evaluations.new.weightsLabel", { kpiW: String(kpiWeight), compW: String(100 - kpiWeight) })}
          </Label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={kpiWeight}
            disabled
            className="w-full accent-[hsl(var(--primary))] opacity-60 cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground">يتم التحكم من إعدادات التقييم في لوحة الإدارة</p>
        </div>
      </Card>

      {/* Expand / Collapse all */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={expandAll} className="gap-1.5 text-xs">
          <ChevronsUpDown className="size-3.5" />
          فرد الكل
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll} className="gap-1.5 text-xs">
          <ChevronsUpDown className="size-3.5" />
          طي الكل
        </Button>
      </div>

      {/* KPIs */}
      <Card className="p-4">
        <button
          type="button"
          onClick={() => toggleSection("kpis")}
          className="mb-1 flex w-full items-center justify-between flex-row-reverse"
        >
          <div className="flex items-center gap-2">
            {collapsed["kpis"] ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronUp className="size-4 text-muted-foreground" />}
          </div>
          <h2 className="text-sm font-bold">{t("evaluations.new.kpiSection")}</h2>
        </button>
        {!collapsed["kpis"] && (
          <>
            <div className="mb-3 flex items-center justify-start">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setKpis((k) => [...k, { name: "", achievement: "" }])}
              >
                <Plus className="size-4" /> {t("evaluations.new.kpiIndicator")}
              </Button>
            </div>
        {kpis.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {t("evaluations.new.noKpis")}
          </p>
        )}
        <div className="space-y-2">
          {kpis.map((k, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder={t("evaluations.new.kpiPlaceholder")}
                value={k.name}
                onChange={(e) =>
                  setKpis((arr) =>
                    arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                  )
                }
              />
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="%"
                className="w-24"
                value={k.achievement}
                onChange={(e) =>
                  setKpis((arr) =>
                    arr.map((x, j) =>
                      j === i
                        ? { ...x, achievement: e.target.value === "" ? "" : Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-destructive"
                onClick={() => setKpis((arr) => arr.filter((_, j) => j !== i))}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
          </>
        )}
      </Card>

      {/* Shared competencies by category */}
      {showShared && data &&
        Object.entries(data.shared).map(([category, items]) => (
          <Card key={category} className="p-4">
            <button
              type="button"
              onClick={() => toggleSection(category)}
              className="flex w-full items-center justify-between flex-row-reverse"
            >
              <div className="flex items-center gap-2">
                {collapsed[category] ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronUp className="size-4 text-muted-foreground" />}
                <span className="text-xs text-muted-foreground">{items.length} جدارة</span>
              </div>
              <h2 className="text-sm font-bold">{category}</h2>
            </button>
            {!collapsed[category] && (
              <div className="mt-2">
                {items.map((item) => (
                  <RatingRow
                    key={item.key}
                    label={item.name}
                    value={sharedScores[item.key]}
                    onChange={(v) => setShared(item.key, v)}
                    ratingLabels={RATING_LABELS}
                  />
                ))}
              </div>
            )}
          </Card>
        ))}

      {/* Job-specific competencies */}
      {showJob && data && data.jobCompetencies.length > 0 && (
        <Card className="p-4">
          <button
            type="button"
            onClick={() => toggleSection("job")}
            className="flex w-full items-center justify-between flex-row-reverse"
          >
            <div className="flex items-center gap-2">
              {collapsed["job"] ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronUp className="size-4 text-muted-foreground" />}
              <span className="text-xs text-muted-foreground">{data.jobCompetencies.length} جدارة</span>
            </div>
            <h2 className="text-sm font-bold">
              {t("evaluations.new.jobCompetencies", { job: data.employee?.jobName ?? t("evaluations.new.jobUnknown") })}
            </h2>
          </button>
          {!collapsed["job"] && (
            <div className="mt-2">
              {data.jobCompetencies.map((c) => (
                <RatingRow
                  key={c.key}
                  label={c.name}
                  value={jobScores[c.key]}
                  onChange={(v) => setJob(c.key, v)}
                  ratingLabels={RATING_LABELS}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Live score + action buttons */}
      <Card className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-xs text-muted-foreground">{t("evaluations.new.totalScore")}</div>
            <div className="text-2xl font-extrabold text-primary">
              {live.totalScore ?? "—"} / 100
            </div>
          </div>
          <div className="text-sm">
            <div className="text-muted-foreground">{t("evaluations.new.ratingLabel")}</div>
            <div className="font-bold">{live.ratingLabel ?? "—"}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            KPIs: {live.kpiScore?.toFixed(0) ?? "—"} · {t("evaluations.new.compLabel")}{" "}
            {live.competencyScore?.toFixed(0) ?? "—"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={saving} onClick={() => save(false)}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t("evaluations.new.saveDraft")}
          </Button>
          <Button disabled={saving || live.totalScore === null} onClick={() => save(true)}>
            <Send className="size-4" />
            {t("evaluations.new.saveSubmit")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ───── Main page component (single-step flow) ───── */

export default function NewEvaluationPage() {
  const [evalType, setEvalType] = useState<"EMPLOYEE" | "MANAGER">("EMPLOYEE");
  const [employeeId, setEmployeeId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const { t } = useTranslation();
  const [period, setPeriod] = useState(() => localStorage.getItem("favPeriod") || "");
  const [mode, setMode] = useState("BOTH");
  const [favPeriod, setFavPeriod] = useState(() => localStorage.getItem("favPeriod") || "");

  const isFavPeriod = period !== "" && favPeriod === period;
  const toggleFavPeriod = () => {
    if (isFavPeriod) {
      localStorage.removeItem("favPeriod");
      setFavPeriod("");
    } else if (period) {
      localStorage.setItem("favPeriod", period);
      setFavPeriod(period);
    }
  };

  // Fetch eval settings for periods
  const { data: evalSettings } = useQuery<{ evaluationPeriods?: string[] }>({
    queryKey: ["eval-settings-top"],
    queryFn: async () => {
      const uid = localStorage.getItem("selectedUserId");
      const h: Record<string, string> = { "Content-Type": "application/json" };
      if (uid) h["X-User-Id"] = uid;
      const r = await fetch("/api/settings/evaluation", { headers: h });
      if (!r.ok) return {};
      return r.json();
    },
  });
  const savedPeriods = evalSettings?.evaluationPeriods ?? [];

  // Fetch all templates
  const { data: allTemplates } = useQuery<{ id: string; name: string; evalType?: string; isDefault?: boolean }[]>({
    queryKey: ["eval-templates-all"],
    queryFn: async () => {
      const uid = localStorage.getItem("selectedUserId");
      const h: Record<string, string> = { "Content-Type": "application/json" };
      if (uid) h["X-User-Id"] = uid;
      const r = await fetch("/api/admin/templates", { headers: h });
      if (!r.ok) return [];
      return r.json();
    },
  });

  // Fetch employees filtered by evalType — only when a template is selected
  const { data: employees } = useQuery<{ id: string; name: string; employeeNumber: string }[]>({
    queryKey: ["employees-for-eval", evalType, selectedTemplateId],
    queryFn: async () => {
      const uid = localStorage.getItem("selectedUserId");
      const h: Record<string, string> = { "Content-Type": "application/json" };
      if (uid) h["X-User-Id"] = uid;
      const r = await fetch(`/api/employees?evalType=${evalType}`, { headers: h });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: Boolean(selectedTemplateId),
  });

  // Reset employee when type changes
  const handleTypeChange = (newType: "EMPLOYEE" | "MANAGER") => {
    setEvalType(newType);
    setEmployeeId("");
  };

  // Group templates by type
  const employeeTemplates = allTemplates?.filter((t) => !t.evalType || t.evalType === "EMPLOYEE") ?? [];
  const managerTemplates = allTemplates?.filter((t) => t.evalType === "MANAGER") ?? [];
  const currentTemplates = evalType === "EMPLOYEE" ? employeeTemplates : managerTemplates;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">{t("evaluations.new.title")}</h1>

      {/* Top selectors — 2 per row */}
      <Card className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
        {/* Template */}
        <div className="space-y-1.5">
          <Label className="font-bold">نموذج التقييم</Label>
          {allTemplates && allTemplates.length > 0 ? (
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedTemplateId}
              onChange={(e) => {
                const tpl = allTemplates?.find((t) => t.id === e.target.value);
                setSelectedTemplateId(e.target.value);
                if (tpl) {
                  const newType = (tpl.evalType === "MANAGER" ? "MANAGER" : "EMPLOYEE") as "EMPLOYEE" | "MANAGER";
                  if (newType !== evalType) handleTypeChange(newType);
                }
              }}
            >
              <option value="">— {t("evaluations.new.selectPlaceholder")} —</option>
              {employeeTemplates.length > 0 && (
                <optgroup label={t("evaluations.evalTypeEmployee")}>
                  {employeeTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </optgroup>
              )}
              {managerTemplates.length > 0 && (
                <optgroup label={t("evaluations.evalTypeManager")}>
                  {managerTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          ) : (
            <p className="text-sm text-destructive">لا توجد نماذج تقييم. يرجى إنشاء نموذج من لوحة الإدارة أولاً.</p>
          )}
        </div>

        {/* Employee */}
        <div className="space-y-1.5">
          <Label className="font-bold">{t("evaluations.new.selectEmployee")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">{t("evaluations.new.selectPlaceholder")}</option>
            {employees?.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.employeeNumber})
              </option>
            ))}
          </select>
          {employees && employees.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("evaluations.new.noEmployees")}</p>
          )}
        </div>

        {/* Period */}
        <div className="space-y-1.5">
          <Label className="font-bold">{t("evaluations.new.periodLabel")}</Label>
          <div className="flex items-center gap-1.5">
            {savedPeriods.length > 0 ? (
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="">{t("evaluations.new.selectPlaceholder")}</option>
                {savedPeriods.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder={t("evaluations.new.periodLabel")} className="flex-1" />
            )}
            <button
              type="button"
              onClick={toggleFavPeriod}
              disabled={!period}
              className="shrink-0 p-1.5 rounded-md hover:bg-accent disabled:opacity-30 transition-colors"
              title={isFavPeriod ? "إلغاء التثبيت" : "تثبيت كافتراضي"}
            >
              <Star className={`w-5 h-5 ${isFavPeriod ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
            </button>
          </div>
        </div>

        {/* Scope */}
        <SelectField
          label={t("evaluations.new.scopeLabel")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "BOTH", label: t("evaluations.new.scopeAll") },
            { value: "SHARED", label: t("evaluations.new.scopeShared") },
            { value: "SPECIFIC", label: t("evaluations.new.scopeJob") },
          ]}
        />
      </Card>

      {/* Form body — visible only when all required fields are filled */}
      {employeeId && selectedTemplateId && period ? (
        <EvaluationFormBody key={`${employeeId}_${selectedTemplateId}`} employeeId={employeeId} evalType={evalType} initialTemplateId={selectedTemplateId || undefined} period={period} mode={mode} />
      ) : (
        <Card className="p-6 text-center text-muted-foreground text-sm">
          يرجى تعبئة جميع الحقول أعلاه للمتابعة
        </Card>
      )}
    </div>
  );
}
