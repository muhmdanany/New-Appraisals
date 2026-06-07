"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EvaluationForm, type EvaluationInitial } from "../../evaluation-form";
import type { EvaluationMode } from "@/server/services/scoring";

const isSharedKey = (refKey: string) => /^[blt]\d+$/.test(refKey);

export default function EditEvaluationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: ev, isLoading } = api.evaluation.byId.useQuery({ id });

  if (isLoading || !ev) {
    return <div className="py-10 text-center text-muted-foreground">جارٍ التحميل…</div>;
  }

  if (ev.status !== "DRAFT" && ev.status !== "REJECTED") {
    return (
      <Card className="space-y-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">لا يمكن تعديل هذا التقييم في حالته الحالية.</p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/evaluations/${id}`}>العودة للتقييم</Link>
        </Button>
      </Card>
    );
  }

  const sharedScores: Record<string, number> = {};
  const jobScores: Record<string, number> = {};
  const kpis: { name: string; achievement: number; note?: string }[] = [];
  for (const item of ev.items) {
    if (item.kind === "KPI") {
      kpis.push({ name: item.label, achievement: item.score ?? 0, note: item.note ?? undefined });
    } else if (isSharedKey(item.refKey)) {
      sharedScores[item.refKey] = item.score ?? 0;
    } else {
      jobScores[item.refKey] = item.score ?? 0;
    }
  }

  const initial: EvaluationInitial = {
    period: ev.period,
    mode: ev.mode as EvaluationMode,
    kpiWeight: ev.kpiWeight,
    sharedScores,
    jobScores,
    kpis,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">تعديل التقييم</h1>
      <EvaluationForm employeeId={ev.employee.id} evaluationId={id} initial={initial} />
    </div>
  );
}
