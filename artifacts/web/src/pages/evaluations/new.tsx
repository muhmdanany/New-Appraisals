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
import { Loader2, Save, Send, Plus, X, BookOpen, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
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
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 last:border-0">
      <div className="min-w-[180px] flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
      </div>
      <div className="flex gap-1">
        {[5, 4, 3, 2, 1].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              title={ratingLabels[n]}
              onClick={() => onChange(n)}
              className="flex size-8 items-center justify-center rounded-md border text-xs font-bold transition-colors"
              style={
                active
                  ? { background: RATING_COLORS[n], borderColor: RATING_COLORS[n], color: "#fff" }
                  : { borderColor: RATING_COLORS[n], color: RATING_COLORS[n], background: "#fff" }
              }
            >
              {n}
            </button>
          );
        })}
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
}: {
  employeeId: string;
  evaluationId?: string;
  initial?: EvaluationInitial;
  initialTemplateId?: string;
  evalType?: string;
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

  // Auto-select default template if none chosen and templates available.
  if (!templateId && templates?.length && !evaluationId) {
    const def = templates.find((t) => t.isDefault);
    if (def) setTemplateId(def.id);
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
  const RATING_LABELS = getRatingLabels(t);
  const [guideOpen, setGuideOpen] = useState(false);
  const create = useCreateEvaluation();
  const update = useUpdateEvaluation();
  const submitEval = useSubmitEvaluation();

  const [period, setPeriod] = useState(initial?.period ?? `${t("evaluations.new.yearPrefix")} ${new Date().getFullYear()}`);
  const [mode, setMode] = useState(initial?.mode ?? "BOTH");
  const [kpiWeight, setKpiWeight] = useState(initial?.kpiWeight ?? 60);
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

      {/* Setup fields */}
      <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        {/* Template selector — only show when templates exist */}
        {templates && templates.length > 0 && !evaluationId && (
          <div className="space-y-1.5 sm:col-span-3">
            <Label>نموذج التقييم</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={templateId ?? ""}
              onChange={(e) => setTemplateId(e.target.value || undefined)}
            >
              <option value="">بدون نموذج (الجدارات الافتراضية)</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>{tpl.name}{tpl.isDefault ? " ⭐" : ""}</option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>{t("evaluations.new.periodLabel")}</Label>
          <Input value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
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
            onChange={(e) => setKpiWeight(Number(e.target.value))}
            className="w-full accent-[hsl(var(--primary))]"
          />
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
  const { t } = useTranslation();

  // Fetch employees filtered by evalType (role)
  const { data: employees } = useQuery<{ id: string; name: string; employeeNumber: string }[]>({
    queryKey: ["employees-for-eval", evalType],
    queryFn: async () => {
      const uid = localStorage.getItem("selectedUserId");
      const h: Record<string, string> = { "Content-Type": "application/json" };
      if (uid) h["X-User-Id"] = uid;
      const r = await fetch(`/api/employees?evalType=${evalType}`, { headers: h });
      if (!r.ok) return [];
      return r.json();
    },
  });

  // Reset employee when type changes
  const handleTypeChange = (newType: "EMPLOYEE" | "MANAGER") => {
    setEvalType(newType);
    setEmployeeId("");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">{t("evaluations.new.title")}</h1>

      {/* Evaluation type selector */}
      <Card className="p-4">
        <div className="space-y-3">
          <Label className="font-bold">{t("evaluations.selectEvalType")}</Label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleTypeChange("EMPLOYEE")}
              className={`flex-1 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${
                evalType === "EMPLOYEE"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/40"
              }`}
            >
              {t("evaluations.evalTypeEmployee")}
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("MANAGER")}
              className={`flex-1 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${
                evalType === "MANAGER"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/40"
              }`}
            >
              {t("evaluations.evalTypeManager")}
            </button>
          </div>
        </div>
      </Card>

      {/* Employee selector */}
      <Card className="p-4">
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
      </Card>

      {/* Form body — always visible, disabled until employee selected */}
      <div className={employeeId ? "" : "opacity-50 pointer-events-none"}>
        <EvaluationFormBody key={employeeId || "__empty"} employeeId={employeeId} evalType={evalType} />
      </div>
    </div>
  );
}
