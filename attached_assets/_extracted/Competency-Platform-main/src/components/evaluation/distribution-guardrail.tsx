"use client";

import { TriangleAlert, Check, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  BELL_CATEGORY_LABELS,
  getPolicyForAchievement,
  calculateShiftedPolicy,
  POLICY_EXCLUSION_THRESHOLD,
  type PolicySet,
} from "@/server/services/bell-curve";

export interface DistributionData {
  departmentName: string;
  employeeCount: number;
  counts: number[];
  evaluatedCount: number;
  achievement: number;
  policy: PolicySet;
}

/**
 * Advisory panel: shows the department's running rating distribution vs. the
 * (shifted) policy, including the in-progress evaluation's band, and suggests
 * rebalancing when a category exceeds its quota. Never blocks.
 */
export function DistributionGuardrail({
  data,
  currentBand,
}: {
  data: DistributionData;
  /** Band index (0..4) of the in-progress evaluation to fold into the preview. */
  currentBand?: number | null;
}) {
  const counts = [...data.counts];
  if (currentBand !== null && currentBand !== undefined) counts[currentBand] = (counts[currentBand] ?? 0) + 1;
  const total = data.evaluatedCount + (currentBand !== null && currentBand !== undefined ? 1 : 0);
  if (total === 0) return null;

  const pct = counts.map((c) => Math.round((c / total) * 100));
  const excluded = data.employeeCount < POLICY_EXCLUSION_THRESHOLD;
  const original = getPolicyForAchievement(data.achievement, data.policy);
  const { shifted } = calculateShiftedPolicy(pct, original);
  const overBands = excluded ? [] : [4, 3, 2, 1, 0].filter((i) => (pct[i] ?? 0) > (shifted[i] ?? 0));

  const tone = excluded ? "info" : overBands.length > 0 ? "warn" : "ok";

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold">موازنة توزيع التقديرات — {data.departmentName}</h3>
        <span className="text-[11px] text-muted-foreground">{total} تقييم في الفترة</span>
      </div>

      <div className="space-y-1.5">
        {[4, 3, 2, 1, 0].map((i) => {
          const over = overBands.includes(i);
          const allowed = shifted[i] ?? 0;
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 text-muted-foreground">{BELL_CATEGORY_LABELS[i]}</span>
              <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className={cn("h-full rounded", over ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${Math.min(pct[i] ?? 0, 100)}%` }}
                />
              </div>
              <span className={cn("w-28 shrink-0 text-left font-semibold", over && "text-destructive")}>
                {pct[i] ?? 0}% / {allowed}%
              </span>
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "mt-3 flex items-start gap-3 rounded-md border p-3 text-xs",
          tone === "warn"
            ? "border-warning/40 bg-warning/5"
            : tone === "info"
              ? "border-primary/30 bg-primary/5"
              : "border-success/40 bg-success/5",
        )}
      >
        {tone === "warn" ? (
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        ) : tone === "info" ? (
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        ) : (
          <Check className="mt-0.5 size-4 shrink-0 text-success" />
        )}
        <div className="space-y-1">
          {tone === "info" && (
            <p className="text-muted-foreground">
              هذه الإدارة مستثناة من سياسة التوزيع الإجباري (أقل من {POLICY_EXCLUSION_THRESHOLD} موظفين).
            </p>
          )}
          {tone === "ok" && <p className="font-medium text-success">التوزيع الحالي متوافق مع السياسة المعتمدة.</p>}
          {tone === "warn" && (
            <>
              <p className="font-bold text-warning">تنبيه: التوزيع يتجاوز السياسة المعتمدة</p>
              <ul className="list-disc space-y-0.5 pr-4 text-muted-foreground">
                {overBands.map((i) => (
                  <li key={i}>
                    فئة «{BELL_CATEGORY_LABELS[i]}» تتجاوز الحصة ({pct[i]}% مقابل {shifted[i] ?? 0}% المسموح) — يُنصح بمراجعة بعض التقييمات في هذه الفئة وخفضها للفئة الأدنى.
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                هذا تنبيه إرشادي فقط ولا يمنع الحفظ؛ سيظهر التجاوز للمدير المعتمِد عند المراجعة.
              </p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
