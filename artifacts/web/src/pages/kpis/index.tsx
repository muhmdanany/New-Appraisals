import { useListKpis } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Kpis() {
  const { data: kpis, isLoading } = useListKpis();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">مؤشرات الأداء</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>مؤشرات الأداء حسب الوظيفة</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الوظيفة</TableHead>
                  <TableHead className="text-right">الإدارة</TableHead>
                  <TableHead className="text-right">عدد المؤشرات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpis?.map((kpi) => (
                  <TableRow key={kpi.jobId}>
                    <TableCell>{kpi.jobName}</TableCell>
                    <TableCell>{kpi.departmentName}</TableCell>
                    <TableCell>{kpi.kpiCount}</TableCell>
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