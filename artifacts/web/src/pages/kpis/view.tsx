import { useParams } from "wouter";
import { useGetKpiSet, getGetKpiSetQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function JobKpis() {
  const { jobId } = useParams();
  const { data: kpiSet, isLoading } = useGetKpiSet(jobId!, { query: { enabled: !!jobId, queryKey: getGetKpiSetQueryKey(jobId!) } });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">مؤشرات الأداء</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>المؤشرات</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="space-y-8">
              {kpiSet?.groups?.map((group) => (
                <div key={group.id} className="space-y-4">
                  <h3 className="text-xl font-semibold bg-muted p-2 rounded">{group.competencyName}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المؤشر</TableHead>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="text-right">المستهدف</TableHead>
                        <TableHead className="text-right">الوزن</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.kpis.map((kpi) => (
                        <TableRow key={kpi.id}>
                          <TableCell>{kpi.name}</TableCell>
                          <TableCell>{kpi.description}</TableCell>
                          <TableCell>{kpi.target}</TableCell>
                          <TableCell>{kpi.weight ? `${kpi.weight}%` : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}