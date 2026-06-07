"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Send, X } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { GuideSheet } from "@/components/evaluation/guide-sheet";
import { DistributionGuardrail } from "@/components/evaluation/distribution-guardrail";
import { calculateScore, type EvaluationMode } from "@/server/services/scoring";
import { scoreToBandIndex } from "@/server/services/bell-curve";

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

export type EvaluationInitial = {
  period: string;
  mode: EvaluationMode;
  kpiWeight: number;
  sharedScores: Record<string, number>;
  jobScores: Record<string, number>;
  kpis: { name: string; achievement: number; note?: string }[];
};

function RatingRow({
  label,
  indicators,
  value,
  onChange,
}: {
  label: string;
  indicators?: string | null;
  value?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 last:border-0">
      <div className="min-w-[180px] flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {indicators && <div className="text-[11px] text-muted-foreground">{indicators}</div>}
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

export function EvaluationForm({
  employeeId,
  evaluationId,
  initial,
}: {
  employeeId: string;
  evaluationId?: string;
  initial?: EvaluationInitial;
}) {
  const router = useRouter();
  const { data, isLoading } = api.evaluation.formData.useQuery({ employeeId });

  const [period, setPeriod] = useState(initial?.period ?? `العام ${new Date().getFullYear()}`);
  const [mode, setMode] = useState<EvaluationMode>(initial?.mode ?? "BOTH");
  const [kpiWeight, setKpiWeight] = useState(initial?.kpiWeight ?? 60);
  const [sharedScores, setSharedScores] = useState<Record<string, number>>(initial?.sharedScores ?? {});
  const [jobScores, setJobScores] = useState<Record<string, number>>(initial?.jobScores ?? {});
  const [kpis, setKpis] = useState<{ name: string; achievement: number | ""; note?: string }[]>(
    initial?.kpis ?? [],
  );
  const [kpisSeeded, setKpisSeeded] = useState(Boolean(initial));

  // Seed KPI rows from the job's saved KPIs on first load (create mode only).
  if (!kpisSeeded && data) {
    setKpisSeeded(true);
    if (data.kpis.length) setKpis(data.kpis.map((k) => ({ name: k.name, achievement: "" })));
  }

  const useShared = mode !== "SPECIFIC";
  const useJob = mode !== "SHARED";

  const live = useMemo(() => {
    const byPrefix = (p: string) =>
      Object.entries(sharedScores)
        .filter(([k]) => k.startsWith(p))
        .map(([, v]) => v);
    return calculateScore({
      mode,
      kpiWeight,
      behavioral: byPrefix("b"),
      leadership: byPrefix("l"),
      technical: byPrefix("t"),
      jobSpecific: Object.values(jobScores),
      kpis: kpis.filter((k) => k.achievement !== "").map((k) => Number(k.achievement)),
    });
  }, [mode, kpiWeight, sharedScores, jobScores, kpis]);

  const distribution = api.evaluation.departmentDistribution.useQuery(
    { employeeId, period, excludeEvaluationId: evaluationId },
    { enabled: Boolean(data) && period.trim().length > 0 },
  );

  const create = api.evaluation.create.useMutation();
  const update = api.evaluation.update.useMutation();
  const submit = api.evaluation.submit.useMutation();
  const [saving, setSaving] = useState(false);

  const setShared = (key: string, v: number) => setSharedScores((s) => ({ ...s, [key]: v }));
  const setJob = (key: string, v: number) => setJobScores((s) => ({ ...s, [key]: v }));

  async function save(thenSubmit: boolean) {
    const payload = {
      period,
      mode,
      kpiWeight,
      sharedScores: useShared ? sharedScores : {},
      jobScores: useJob ? jobScores : {},
      kpis: kpis
        .filter((k) => k.name.trim() && k.achievement !== "")
        .map((k) => ({ name: k.name.trim(), achievement: Number(k.achievement), note: k.note })),
    };
    setSaving(true);
    try {
      const id = evaluationId
        ? (await update.mutateAsync({ id: evaluationId, ...payload })).id
        : (await create.mutateAsync({ employeeId, ...payload })).id;
      if (thenSubmit) await submit.mutateAsync({ id });
      toast.success(thenSubmit ? "تم الحفظ والإرسال للاعتماد." : "تم حفظ المسودة.");
      router.push(`/evaluations/${id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر الحفظ.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !data) {
    return <div className="py-10 text-center text-muted-foreground">جارٍ التحميل…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <GuideSheet />
      </div>
      {/* Header */}
      <Card className="bg-gradient-to-l from-[hsl(219_62%_15%)] to-[hsl(212_67%_24%)] p-5 text-white">
        <div className="text-xs text-accent">نموذج تقييم الأداء الوظيفي</div>
        <div className="text-lg font-bold">{data.employee.name}</div>
        <div className="text-xs text-white/70">
          {data.employee.employeeNumber}
          {data.employee.job ? ` · ${data.employee.job.name}` : ""}
          {data.employee.department ? ` · ${data.employee.department}` : ""}
          {data.employee.grade ? ` · ${data.employee.grade}` : ""}
        </div>
      </Card>

      {/* Setup */}
      <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>الفترة</Label>
          <Input value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>نطاق التقييم</Label>
          <Select value={mode} onChange={(e) => setMode(e.target.value as EvaluationMode)}>
            <option value="BOTH">مشتركة + وظيفية</option>
            <option value="SHARED">المشتركة فقط</option>
            <option value="SPECIFIC">الوظيفية فقط</option>
          </Select>
        </div>
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

      {/* Distribution guardrail (advisory) */}
      {distribution.data && (
        <DistributionGuardrail
          data={distribution.data}
          currentBand={live.totalScore !== null ? scoreToBandIndex(live.totalScore) : null}
        />
      )}

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
        {kpis.length === 0 && <p className="text-xs text-muted-foreground">لا توجد مؤشرات. أضف مؤشراً أو اعتمد على الجدارات.</p>}
        <div className="space-y-2">
          {kpis.map((k, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="اسم المؤشر"
                value={k.name}
                onChange={(e) => setKpis((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
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
                      j === i ? { ...x, achievement: e.target.value === "" ? "" : Number(e.target.value) } : x,
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

      {/* Shared competencies */}
      {useShared && (
        <>
          <CompetencyCard title="الجدارات السلوكية المشتركة" items={data.shared.behavioral} scores={sharedScores} onSet={setShared} />
          <CompetencyCard title="الجدارات القيادية المشتركة" items={data.shared.leadership} scores={sharedScores} onSet={setShared} />
          <CompetencyCard title="الجدارات الفنية المشتركة" items={data.shared.technical} scores={sharedScores} onSet={setShared} />
        </>
      )}

      {/* Job-specific competencies */}
      {useJob && (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-bold">الجدارات الوظيفية — {data.employee.job?.name ?? "غير محدد"}</h2>
          {data.jobCompetencies.length ? (
            data.jobCompetencies.map((c) => (
              <RatingRow
                key={c.id}
                label={c.name}
                indicators={c.indicators}
                value={jobScores[c.id]}
                onChange={(v) => setJob(c.id, v)}
              />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">لا توجد جدارات مرتبطة بهذه الوظيفة.</p>
          )}
        </Card>
      )}

      {/* Live score + actions */}
      <Card className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-xs text-muted-foreground">الدرجة الإجمالية</div>
            <div className="text-2xl font-extrabold text-primary">{live.totalScore ?? "—"} / 100</div>
          </div>
          <div className="text-sm">
            <div className="text-muted-foreground">التقدير</div>
            <div className="font-bold">{live.ratingLabel ?? "—"}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            KPIs: {live.kpiScore?.toFixed(0) ?? "—"} · جدارات: {live.competencyScore?.toFixed(0) ?? "—"}
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

function CompetencyCard({
  title,
  items,
  scores,
  onSet,
}: {
  title: string;
  items: { key: string; name: string; indicators?: string | null }[];
  scores: Record<string, number>;
  onSet: (key: string, v: number) => void;
}) {
  if (!items.length) return null;
  return (
    <Card className="p-4">
      <h2 className="mb-2 text-sm font-bold">{title}</h2>
      {items.map((c) => (
        <RatingRow key={c.key} label={c.name} indicators={c.indicators} value={scores[c.key]} onChange={(v) => onSet(c.key, v)} />
      ))}
    </Card>
  );
}
