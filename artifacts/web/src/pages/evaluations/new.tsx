import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListEmployees,
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
import { Loader2, Save, Send, Plus, X } from "lucide-react";

/* ───── Rating row (1–5 buttons matching Vercel UI) ───── */

const RATING_COLORS: Record<number, string> = {
  5: "#1a7f4b",
  4: "#27ae60",
  3: "#2a6db5",
  2: "#b87d12",
  1: "#c0392b",
};
const RATING_LABELS: Record<number, string> = {
  5: "متميز",
  4: "يتجاوز",
  3: "يحقق",
  2: "يحتاج تحسين",
  1: "دون المستوى",
};

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (v: number) => void;
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
              title={RATING_LABELS[n]}
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
}) {
  const { mode, kpiWeight, sharedScores, jobScores, kpis } = opts;
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
    if (totalScore >= 90) ratingLabel = "متميز";
    else if (totalScore >= 75) ratingLabel = "يتجاوز";
    else if (totalScore >= 60) ratingLabel = "يحقق";
    else if (totalScore >= 40) ratingLabel = "يحتاج تحسين";
    else ratingLabel = "دون المستوى";
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
}: {
  employeeId: string;
  evaluationId?: string;
  initial?: EvaluationInitial;
}) {
  const { data, isLoading } = useEvaluationFormData(
    { employeeId },
    { query: { queryKey: getEvaluationFormDataQueryKey({ employeeId }) } },
  );
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const create = useCreateEvaluation();
  const update = useUpdateEvaluation();
  const submitEval = useSubmitEvaluation();

  const [period, setPeriod] = useState(initial?.period ?? `العام ${new Date().getFullYear()}`);
  const [mode, setMode] = useState(initial?.mode ?? "BOTH");
  const [kpiWeight, setKpiWeight] = useState(initial?.kpiWeight ?? 60);
  const [sharedScores, setSharedScores] = useState<Record<string, number>>(initial?.sharedScores ?? {});
  const [jobScores, setJobScores] = useState<Record<string, number>>(initial?.jobScores ?? {});
  const [kpis, setKpis] = useState<{ name: string; achievement: number | "" }[]>(
    initial?.kpis ?? [],
  );
  const [kpisSeeded, setKpisSeeded] = useState(Boolean(initial));
  const [saving, setSaving] = useState(false);

  // Seed KPI rows from the job's saved KPIs on first load
  if (!kpisSeeded && data) {
    setKpisSeeded(true);
    if (data.kpis.length > 0) {
      setKpis(data.kpis.map((k) => ({ name: k.name, achievement: "" })));
    }
  }

  const showShared = mode === "SHARED" || mode === "BOTH";
  const showJob = mode === "SPECIFIC" || mode === "BOTH";

  const live = calculateLiveScore({ mode, kpiWeight, sharedScores, jobScores, kpis });

  const setShared = (key: string, v: number) =>
    setSharedScores((s) => ({ ...s, [key]: v }));
  const setJob = (key: string, v: number) =>
    setJobScores((s) => ({ ...s, [key]: v }));

  async function save(thenSubmit: boolean) {
    if (!period.trim()) {
      toast({ title: "الفترة مطلوبة", variant: "destructive" });
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
          },
        });
        resultId = result.id;
      }

      if (thenSubmit) {
        await submitEval.mutateAsync({ id: resultId });
        toast({ title: "تم الحفظ والإرسال للاعتماد" });
      } else {
        toast({ title: "تم حفظ المسودة" });
      }

      qc.invalidateQueries({ queryKey: getListEvaluationsQueryKey() });
      navigate(`/evaluations/${resultId}`);
    } catch {
      toast({ title: "تعذّر الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data) return <p className="text-muted-foreground py-6 text-center">تعذّر تحميل نموذج التقييم.</p>;

  return (
    <div className="space-y-4">
      {/* Employee header card */}
      <Card className="bg-gradient-to-l from-[hsl(219_62%_15%)] to-[hsl(212_67%_24%)] p-5 text-white">
        <div className="text-xs text-accent">نموذج تقييم الأداء الوظيفي</div>
        <div className="text-lg font-bold">{data.employee?.name}</div>
        <div className="text-xs text-white/70">
          {data.employee?.employeeNumber}
          {data.employee?.jobName ? ` · ${data.employee.jobName}` : ""}
          {data.employee?.departmentName ? ` · ${data.employee.departmentName}` : ""}
        </div>
      </Card>

      {/* Setup fields */}
      <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>الفترة</Label>
          <Input value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <SelectField
          label="نطاق التقييم"
          value={mode}
          onChange={setMode}
          options={[
            { value: "BOTH", label: "مشتركة + وظيفية" },
            { value: "SHARED", label: "المشتركة فقط" },
            { value: "SPECIFIC", label: "الوظيفية فقط" },
          ]}
        />
        <div className="space-y-1.5">
          <Label>
            وزن المؤشرات: {kpiWeight}% · الجدارات: {100 - kpiWeight}%
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

      {/* KPIs */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">مؤشرات الأداء (KPIs) — نسبة التحقق %</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setKpis((k) => [...k, { name: "", achievement: "" }])}
          >
            <Plus className="size-4" /> مؤشر
          </Button>
        </div>
        {kpis.length === 0 && (
          <p className="text-xs text-muted-foreground">
            لا توجد مؤشرات. أضف مؤشراً أو اعتمد على الجدارات.
          </p>
        )}
        <div className="space-y-2">
          {kpis.map((k, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="اسم المؤشر"
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
      </Card>

      {/* Shared competencies by category */}
      {showShared &&
        Object.entries(data.shared).map(([category, items]) => (
          <Card key={category} className="p-4">
            <h2 className="mb-2 text-sm font-bold">{category}</h2>
            {items.map((item) => (
              <RatingRow
                key={item.key}
                label={item.name}
                value={sharedScores[item.key]}
                onChange={(v) => setShared(item.key, v)}
              />
            ))}
          </Card>
        ))}

      {/* Job-specific competencies */}
      {showJob && data.jobCompetencies.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-bold">
            الجدارات الوظيفية — {data.employee?.jobName ?? "غير محدد"}
          </h2>
          {data.jobCompetencies.map((c) => (
            <RatingRow
              key={c.key}
              label={c.name}
              value={jobScores[c.key]}
              onChange={(v) => setJob(c.key, v)}
            />
          ))}
        </Card>
      )}

      {/* Live score + action buttons */}
      <Card className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-xs text-muted-foreground">الدرجة الإجمالية</div>
            <div className="text-2xl font-extrabold text-primary">
              {live.totalScore ?? "—"} / 100
            </div>
          </div>
          <div className="text-sm">
            <div className="text-muted-foreground">التقدير</div>
            <div className="font-bold">{live.ratingLabel ?? "—"}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            KPIs: {live.kpiScore?.toFixed(0) ?? "—"} · جدارات:{" "}
            {live.competencyScore?.toFixed(0) ?? "—"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={saving} onClick={() => save(false)}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            حفظ كمسودة
          </Button>
          <Button disabled={saving || live.totalScore === null} onClick={() => save(true)}>
            <Send className="size-4" />
            حفظ وإرسال للاعتماد
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ───── Main page component (two-step flow) ───── */

export default function NewEvaluationPage() {
  const { data: employees } = useListEmployees();
  const [employeeId, setEmployeeId] = useState("");
  const [started, setStarted] = useState(false);

  if (started && employeeId) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">تقييم جديد</h1>
        <EvaluationFormBody employeeId={employeeId} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">تقييم جديد</h1>
      <Card className="max-w-md space-y-4 p-5">
        <div className="space-y-1.5">
          <Label>اختر الموظف</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">— اختر —</option>
            {employees?.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.employeeNumber})
              </option>
            ))}
          </select>
          {employees && employees.length === 0 && (
            <p className="text-xs text-muted-foreground">لا يوجد موظفون ضمن نطاقك للتقييم.</p>
          )}
        </div>
        <Button disabled={!employeeId} onClick={() => setStarted(true)}>
          بدء التقييم
        </Button>
      </Card>
    </div>
  );
}
