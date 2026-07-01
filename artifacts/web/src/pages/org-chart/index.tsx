import { useReportOrgTree } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function OrgChart() {
  const { data: tree, isLoading } = useReportOrgTree();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">الهيكل التنظيمي</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>قائمة الموظفين في الهيكل</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الموظف</TableHead>
                  <TableHead className="text-right">الوظيفة</TableHead>
                  <TableHead className="text-right">الإدارة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tree?.map((node) => (
                  <TableRow key={node.id}>
                    <TableCell>{node.name}</TableCell>
                    <TableCell>{node.jobName}</TableCell>
                    <TableCell>{node.department}</TableCell>
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