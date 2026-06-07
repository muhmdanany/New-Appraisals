import { useListEvaluations } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Evaluations() {
  const { data: evaluations, isLoading } = useListEvaluations();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">التقييمات</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>قائمة التقييمات</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الموظف</TableHead>
                  <TableHead className="text-right">الفترة</TableHead>
                  <TableHead className="text-right">النتيجة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations?.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell>{ev.employeeName}</TableCell>
                    <TableCell>{ev.period}</TableCell>
                    <TableCell>{ev.totalScore ? `${ev.totalScore}%` : "-"}</TableCell>
                    <TableCell>{ev.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}