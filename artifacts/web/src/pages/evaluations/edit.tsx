import { useParams } from "wouter";
import { Link } from "wouter";
import {
  useGetEvaluation,
  getGetEvaluationQueryKey,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EvaluationFormBody, type EvaluationInitial } from "./new";

const isSharedKey = (refKey: string) => /^[blt]\d+$/.test(refKey);

export default function EditEvaluationPage() {
  const { id } = useParams();
  const { data: ev, isLoading } = useGetEvaluation(id!, {
    query: { enabled: !!id, queryKey: getGetEvaluationQueryKey(id!) },
  });

  if (isLoading || !ev) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (ev.status !== "DRAFT" && ev.status !== "REJECTED") {
    return (
      <Card className="space-y-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          لا يمكن تعديل هذا التقييم في حالته الحالية.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/evaluations/${id}`}>العودة للتقييم</Link>
        </Button>
      </Card>
    );
  }

  const sharedScores: Record<string, number> = {};
  const jobScores: Record<string, number> = {};
  const kpis: { name: string; achievement: number }[] = [];

  for (const item of ev.items ?? []) {
    if (item.kind === "KPI") {
      kpis.push({ name: item.label, achievement: item.score ?? 0 });
    } else if (isSharedKey(item.refKey ?? "")) {
      sharedScores[item.refKey ?? ""] = item.score ?? 0;
    } else {
      jobScores[item.refKey ?? ""] = item.score ?? 0;
    }
  }

  const initial: EvaluationInitial = {
    period: ev.period ?? "",
    mode: ev.mode ?? "BOTH",
    kpiWeight: ev.kpiWeight ?? 60,
    sharedScores,
    jobScores,
    kpis,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">تعديل التقييم</h1>
      <EvaluationFormBody
        employeeId={ev.employeeId ?? ""}
        evaluationId={id}
        initial={initial}
      />
    </div>
  );
}
