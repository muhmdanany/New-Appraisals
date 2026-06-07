"use client";

import { useState } from "react";
import { ChartSpline, TriangleAlert, Check, Info } from "lucide-react";

import { api } from "@/trpc/react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  BELL_CATEGORY_LABELS,
  getAchievementCategory,
  getPolicyForAchievement,
  calculateShiftedPolicy,
  isDeptCompliant,
  POLICY_EXCLUSION_THRESHOLD,
  type PolicySet,
  type AchievementBand,
} from "@/server/services/bell-curve";

type Dept = {
  id: string;
  name: string;
  categories: number[];
  achievement: number;
  employeeCount: number;
  evaluatedCount: number;
};

const BAND_LABELS: Record<AchievementBand, string> = {
  above: "أعلى من المستهدف",
  achieved: "حققت المستهدف",
  below: "أقل من المستهدف",
};

/** Build a smooth path for a department's distribution over the standard curve canvas. */
function curvePath(categories: number[]): string {
  const xs = [450, 350, 250, 150, 50];
  const p = (i: number) => ({ x: xs[i] ?? 0, y: 180 - (categories[i] ?? 0) * 1.5 });
  const [a, b, c, d, e] = [p(0), p(1), p(2), p(3), p(4)];
  return `M500,180 C470,180 ${a.x + 20},${a.y} ${a.x},${a.y} C${b.x + 40},${b.y} ${b.x - 40},${b.y} ${c.x},${c.y} C${d.x + 40},${d.y} ${d.x - 40},${d.y} ${e.x},${e.y} C${e.x - 20},${e.y} 30,180 0,180`;
}

function FilterCard({
  label,
  hint,
  count,
  active,
  accent,
  onClick,
}: {
  label: string;
  hint: string;
  count: number;
  active: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-card p-4 text-right transition-all hover:shadow-md",
        active ? "border-primary ring-2 ring-ring/30" : "border-border",
      )}
      style={{ borderRightWidth: 4, borderRightColor: accent }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: accent }}>
          {label}
        </span>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-bold">{count}</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
    </button>
  );
}

const STANDARD_CURVE_LABELS = [
  { x: 40, y: 60, t: "10%" },
  { x: 150, y: 80, t: "40%" },
  { x: 300, y: 80, t: "40%" },
  { x: 410, y: 100, t: "5%" },
  { x: 465, y: 80, t: "5%" },
];

export default function BellCurvePage() {
  const { data, isLoading } = api.report.bellCurve.useQuery();
  const [filter, setFilter] = useState<AchievementBand | null>(null);
  const [selectedId, setSelectedId] = useState("");

  const departments = (data?.departments ?? []) as Dept[];
  const policy = (data?.policy ?? null) as PolicySet | null;

  const counts = {
    above: departments.filter((d) => getAchievementCategory(d.achievement) === "above").length,
    achieved: departments.filter((d) => getAchievementCategory(d.achievement) === "achieved").length,
    below: departments.filter((d) => getAchievementCategory(d.achievement) === "below").length,
  };
  const compliant = policy
    ? departments.filter((d) => isDeptCompliant({ ...d, policies: policy })).length
    : 0;
  const nonCompliant = departments.length - compliant;

  const listed = filter
    ? departments.filter((d) => getAchievementCategory(d.achievement) === filter)
    : departments;
  const selected = departments.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">تحليل منحنى الجرس</h1>
        <p className="text-sm text-muted-foreground">
          توزيع تقديرات الإدارات الفعلي مقابل سياسة التوزيع المعتمدة
        </p>
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-muted-foreground">جارٍ التحميل…</Card>
      ) : !departments.length ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <ChartSpline className="size-10 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">لا توجد تقييمات معتمدة كافية لعرض التوزيع بعد.</p>
        </Card>
      ) : (
        <>
          {/* Achievement filter cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FilterCard label="أعلى من المستهدف" hint="الإنجاز > 100%" count={counts.above} accent="#1A7A5E"
              active={filter === "above"} onClick={() => setFilter(filter === "above" ? null : "above")} />
            <FilterCard label="حققت المستهدف" hint="الإنجاز 95% - 100%" count={counts.achieved} accent="#1B4F8A"
              active={filter === "achieved"} onClick={() => setFilter(filter === "achieved" ? null : "achieved")} />
            <FilterCard label="أقل من المستهدف" hint="الإنجاز < 95%" count={counts.below} accent="#C0392B"
              active={filter === "below"} onClick={() => setFilter(filter === "below" ? null : "below")} />
          </div>

          {/* Policy table + standard curve */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Card className="overflow-hidden lg:col-span-7">
              <div className="flex items-center justify-between bg-primary px-5 py-3 text-primary-foreground">
                <span className="text-xs font-bold">جدول سياسة التوزيع المعتمدة</span>
                <span className="text-[10px] opacity-80">{data?.policyName ?? "—"}</span>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-[10px] font-bold uppercase text-muted-foreground">
                      <th className="pb-2 text-right">فئة التقييم</th>
                      <th className="pb-2 text-center">أعلى من المستهدف</th>
                      <th className="pb-2 text-center">حققت المستهدف</th>
                      <th className="pb-2 text-center">أقل من المستهدف</th>
                    </tr>
                  </thead>
                  <tbody className="font-bold">
                    {[4, 3, 2, 1, 0].map((i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="py-2">{BELL_CATEGORY_LABELS[i]}</td>
                        <td className="py-2 text-center">{policy?.above[i] ?? 0}%</td>
                        <td className="py-2 text-center">{policy?.achieved[i] ?? 0}%</td>
                        <td className="py-2 text-center">{policy?.below[i] ?? 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="flex flex-col items-center justify-center p-5 lg:col-span-5">
              <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-primary">
                نموذج منحنى الجرس المعتمد
              </h4>
              <svg viewBox="0 0 500 200" className="h-full w-full min-h-[160px]">
                <path d="M0,180 C80,180 120,20 220,20 L380,20 C420,20 440,180 500,180" fill="none"
                  stroke="hsl(var(--primary))" strokeWidth={4} strokeLinecap="round" />
                {STANDARD_CURVE_LABELS.map((l, i) => (
                  <text key={i} x={l.x} y={l.y} fontSize={14} fontWeight="bold" fill="hsl(var(--foreground))" textAnchor="middle">
                    {l.t}
                  </text>
                ))}
                {[
                  { x: 40, t: "استثنائي" }, { x: 150, t: "فوق المتوقع" }, { x: 300, t: "حسب المتوقع" },
                  { x: 410, t: "دون المتوقع" }, { x: 465, t: "غير مرضي" },
                ].map((l, i) => (
                  <text key={i} x={l.x} y={196} fontSize={9} fontWeight="bold" fill="hsl(var(--muted-foreground))" textAnchor="middle">
                    {l.t}
                  </text>
                ))}
              </svg>
            </Card>
          </div>

          {/* Selector + analysis */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-4">
              <Card className="p-5">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-primary">اختر إدارة</label>
                <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                  <option value="">— اختر من القائمة —</option>
                  {listed.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.evaluatedCount})
                    </option>
                  ))}
                </Select>
              </Card>
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 text-center">
                  <p className="text-[9px] font-bold uppercase text-success">ملتزمة</p>
                  <h3 className="text-3xl font-extrabold text-success">{compliant}</h3>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-[9px] font-bold uppercase text-destructive">تجاوز</p>
                  <h3 className="text-3xl font-extrabold text-destructive">{nonCompliant}</h3>
                </Card>
              </div>
              {selected && (
                <Card className="p-5">
                  <h4 className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">
                    بصمة التوزيع (الفعلي)
                  </h4>
                  <svg viewBox="0 0 500 200" className="h-32 w-full">
                    <path d="M0,180 C80,180 120,20 220,20 L380,20 C420,20 440,180 500,180" fill="none"
                      stroke="hsl(var(--border))" strokeWidth={6} strokeLinecap="round" />
                    <path d={curvePath(selected.categories)} fill="none" stroke="hsl(var(--accent))" strokeWidth={4} strokeLinecap="round" />
                  </svg>
                </Card>
              )}
            </div>

            <div className="lg:col-span-8">
              {selected && policy ? (
                <DeptAnalysis dept={selected} policy={policy} />
              ) : (
                <Card className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 border-dashed text-center">
                  <ChartSpline className="size-10 text-muted-foreground opacity-30" />
                  <p className="text-sm text-muted-foreground">اختر إدارة لتحليل توزيعها ومقارنته بالسياسة.</p>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DeptAnalysis({ dept, policy }: { dept: Dept; policy: PolicySet }) {
  const excluded = dept.employeeCount < POLICY_EXCLUSION_THRESHOLD;
  const original = getPolicyForAchievement(dept.achievement, policy);
  const { shifted, notes, shiftArrows } = calculateShiftedPolicy(dept.categories, original);
  const achPct = (dept.achievement * 100).toFixed(1);

  let violations = 0;
  const rows = [4, 3, 2, 1, 0].map((i) => {
    const val = dept.categories[i] ?? 0;
    const pol = shifted[i] ?? 0;
    const polOrig = original[i] ?? 0;
    const mismatch = !excluded && val > pol;
    if (mismatch) violations += 1;
    return { i, val, pol, polOrig, mismatch, arrow: shiftArrows[i] };
  });

  return (
    <Card className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="mb-1 inline-block rounded-full bg-muted px-3 py-0.5 text-[10px] font-bold text-muted-foreground">
            {BAND_LABELS[getAchievementCategory(dept.achievement)]}
          </span>
          <h2 className="text-2xl font-extrabold text-foreground">{dept.name}</h2>
        </div>
        <div className="flex gap-3">
          <div className="min-w-[100px] rounded-lg border border-border px-4 py-2 text-center">
            <span className="block text-[9px] text-muted-foreground">المُقيَّمون</span>
            <span className="text-2xl font-extrabold text-primary">{dept.evaluatedCount}</span>
          </div>
          <div className="min-w-[100px] rounded-lg bg-primary px-4 py-2 text-center text-primary-foreground">
            <span className="block text-[9px] opacity-80">الإنجاز</span>
            <span className="text-2xl font-extrabold">{achPct}%</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-xs font-bold text-muted-foreground">
              <th className="pb-3 text-right">الفئة</th>
              <th className="pb-3 text-center">الفعلية</th>
              <th className="pb-3 text-center">المعتمدة (المعدّلة)</th>
              <th className="pb-3 text-center">الحالة</th>
            </tr>
          </thead>
          <tbody className="font-bold">
            {rows.map((r) => (
              <tr key={r.i} className="border-b border-border/60">
                <td className="py-3 text-right">
                  {BELL_CATEGORY_LABELS[r.i]}
                  {r.arrow && !excluded && <span className="block text-[10px] font-medium text-muted-foreground">إزاحة حصة</span>}
                </td>
                <td className={cn("py-3 text-center text-lg", r.mismatch ? "text-destructive" : "text-success")}>
                  {r.val}%
                </td>
                <td className="py-3 text-center">
                  <span className={cn("text-lg", !excluded && r.pol !== r.polOrig ? "font-extrabold text-primary" : "opacity-80")}>
                    {r.pol}%
                  </span>
                  {r.arrow === "up" && <span className="ms-1 text-success">↑</span>}
                  {r.arrow === "down" && <span className="ms-1 text-destructive">↓</span>}
                  {!excluded && r.pol !== r.polOrig && (
                    <div className="text-[11px] font-medium text-muted-foreground">الأصلية: {r.polOrig}%</div>
                  )}
                </td>
                <td className="py-3 text-center">
                  {excluded ? (
                    <span className="font-bold text-primary">مستثنى</span>
                  ) : r.mismatch ? (
                    <span className="inline-flex items-center justify-center gap-1 text-destructive">
                      <TriangleAlert className="size-4" /> تجاوز
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-1 text-success">
                      <Check className="size-4" /> مطابق
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status alert */}
      <div
        className={cn(
          "mt-6 flex items-center gap-4 rounded-lg border-2 p-5",
          excluded
            ? "border-primary/30 bg-primary/5"
            : violations > 0
              ? "border-destructive/30 bg-destructive/5"
              : "border-success/30 bg-success/5",
        )}
      >
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-lg text-primary-foreground",
            excluded ? "bg-primary" : violations > 0 ? "bg-destructive" : "bg-success",
          )}
        >
          {excluded ? <Info className="size-5" /> : violations > 0 ? <TriangleAlert className="size-5" /> : <Check className="size-5" />}
        </div>
        <div>
          <div className="font-bold text-foreground">
            {excluded
              ? "خارج نطاق السياسة (استثناء)"
              : violations > 0
                ? "تجاوز في سياسة التوزيع"
                : "توزيع متطابق (بالإزاحة المسموحة)"}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {excluded
              ? `لا تُطبَّق سياسة التوزيع الإجباري على الإدارات التي يقل عدد موظفيها عن ${POLICY_EXCLUSION_THRESHOLD}.`
              : violations > 0
                ? `هذا التوزيع غير معتمد ويحتوي على ${violations} فئة تجاوزت الحد المسموح.`
                : notes.length > 0
                  ? "ملاحظة: " + notes.join(" | ")
                  : "جميع النسب تتماشى مع السياسة المعتمدة."}
          </p>
        </div>
      </div>
    </Card>
  );
}
