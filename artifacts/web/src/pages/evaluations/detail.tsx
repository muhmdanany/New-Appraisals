import { useParams } from "wouter";
import { useGetEvaluation, getGetEvaluationQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function EvaluationDetail() {
  const { id } = useParams();
  const { data: evaluation, isLoading } = useGetEvaluation(id!, { query: { enabled: !!id, queryKey: getGetEvaluationQueryKey(id!) } });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">تفاصيل التقييم</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>معلومات التقييم</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div><strong>الموظف:</strong> {evaluation?.employeeName}</div>
              <div><strong>الفترة:</strong> {evaluation?.period}</div>
              <div><strong>الحالة:</strong> {evaluation?.status}</div>
              <div><strong>النتيجة النهائية:</strong> {evaluation?.totalScore}%</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}