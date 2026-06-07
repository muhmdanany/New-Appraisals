"use client";

import { api } from "@/trpc/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EVALUATION_STATUS_LABELS, EVALUATION_STATUS_VARIANT } from "@/lib/evaluation-status";

const BAND_COLORS = ["#1a7f4b", "#27ae60", "#2a6db5", "#b87d12", "#c0392b"];

export function DashboardAnalytics() {
  const { data, isLoading } = api.dashboard.analytics.useQuery();

  if (isLoading || !data) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">جارٍ تحميل التحليلات…</Card>;
  }

  const maxCount = Math.max(1, ...data.distribution.map((d) => d.count));
  const statusEntries = Object.entries(data.statusCounts);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Rating distribution */}
      <Card className="p-4 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">توزيع التقديرات (تقييمات معتمدة)</h2>
          <span className="text-xs text-muted-foreground">{data.finalizedCount} تقييم</span>
        </div>
        {data.finalizedCount === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">لا توجد تقييمات معتمدة بعد.</p>
        ) : (
          <div className="space-y-2.5">
            {data.distribution.map((d, i) => {
              const pct = Math.round((d.count / data.finalizedCount) * 100);
              return (
                <div key={d.label} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">{d.label}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded"
                      style={{ width: `${(d.count / maxCount) * 100}%`, background: BAND_COLORS[i], minWidth: d.count ? "0.5rem" : 0 }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-left text-xs font-semibold">
                    {d.count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Avg score + status breakdown */}
      <div className="space-y-4">
        <Card className="p-4 text-center">
          <div className="text-xs text-muted-foreground">متوسط الدرجة الإجمالية</div>
          <div className="mt-1 text-4xl font-extrabold text-primary">{data.avgScore ?? "—"}</div>
          <div className="text-xs text-muted-foreground">من 100</div>
        </Card>
        <Card className="p-4">
          <div className="mb-2 text-sm font-bold">حالات التقييمات</div>
          {statusEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد تقييمات.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {statusEntries.map(([status, count]) => (
                <Badge key={status} variant={EVALUATION_STATUS_VARIANT[status]}>
                  {EVALUATION_STATUS_LABELS[status] ?? status}: {count}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
