"use client";

import { useState } from "react";
import { Target, Check } from "lucide-react";

import { api } from "@/trpc/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { KpiBuilder } from "./kpi-builder";

export default function KpisPage() {
  const { data: jobs, isLoading } = api.kpi.list.useQuery();
  const [jobId, setJobId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">مؤشرات الأداء (KPIs)</h1>
        <p className="text-sm text-muted-foreground">بناء مؤشرات الأداء لكل وظيفة — يدوياً أو بالذكاء الاصطناعي</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Job list */}
        <Card className="h-fit p-2">
          {isLoading ? (
            <p className="p-4 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
          ) : !jobs?.length ? (
            <p className="p-4 text-center text-sm text-muted-foreground">لا توجد وظائف. أضف وظائف أولاً.</p>
          ) : (
            <ul className="space-y-1">
              {jobs.map((j) => (
                <li key={j.id}>
                  <button
                    onClick={() => setJobId(j.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-right text-sm transition-colors",
                      jobId === j.id ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted",
                    )}
                  >
                    <span className="truncate">
                      {j.name}
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        {j.department ?? "—"} · {j.competencyCount} جدارة
                      </span>
                    </span>
                    {j.hasKpis ? (
                      <Badge variant="success" className="shrink-0 gap-1">
                        <Check className="size-3" /> {j.kpiCount}
                      </Badge>
                    ) : (
                      <Badge variant="muted" className="shrink-0">—</Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Builder */}
        <Card className="p-4">
          {jobId ? (
            <KpiBuilder key={jobId} jobId={jobId} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
              <Target className="size-10 opacity-30" />
              <p className="text-sm">اختر وظيفة من القائمة لعرض أو بناء مؤشراتها.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
