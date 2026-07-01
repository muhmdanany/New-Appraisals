import { useReportBellCurve } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function BellCurve() {
  const { data: report, isLoading } = useReportBellCurve();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">التوزيع الطبيعي</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>توزيع التقييمات على الإدارات</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الإدارة</TableHead>
                  <TableHead className="text-right">عدد الموظفين</TableHead>
                  <TableHead className="text-right">المقيمين</TableHead>
                  <TableHead className="text-right">نسبة الإنجاز</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report?.departments?.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell>{dept.name}</TableCell>
                    <TableCell>{dept.employeeCount}</TableCell>
                    <TableCell>{dept.evaluatedCount}</TableCell>
                    <TableCell>{dept.achievement.toFixed(1)}%</TableCell>
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