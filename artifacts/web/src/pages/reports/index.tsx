import { useReportEvaluations } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Reports() {
  const { data: reports, isLoading } = useReportEvaluations();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">التقارير</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>تقرير التقييمات</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الموظف</TableHead>
                  <TableHead className="text-right">الإدارة</TableHead>
                  <TableHead className="text-right">الوظيفة</TableHead>
                  <TableHead className="text-right">النتيجة النهائية</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports?.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.employeeName}</TableCell>
                    <TableCell>{row.departmentName}</TableCell>
                    <TableCell>{row.jobName}</TableCell>
                    <TableCell>{row.totalScore ? `${row.totalScore}%` : "-"}</TableCell>
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