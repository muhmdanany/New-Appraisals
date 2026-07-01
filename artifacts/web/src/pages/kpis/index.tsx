import { Link } from "wouter";
import { useListJobs, useListKpis } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft } from "lucide-react";

export default function Kpis() {
  const { data: jobs, isLoading } = useListJobs();
  const { data: kpis } = useListKpis();
  const countByJob = new Map((kpis ?? []).map((k) => [k.jobId, k.kpiCount]));

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
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs?.map((job) => {
                  const count = countByJob.get(job.id) ?? 0;
                  return (
                    <TableRow key={job.id}>
                      <TableCell>{job.name}</TableCell>
                      <TableCell>{job.departmentName}</TableCell>
                      <TableCell>
                        {count > 0 ? (
                          <Badge>{count}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">لا توجد مؤشرات</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/kpis/${job.id}`}>
                          <a className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                            {count > 0 ? "عرض / تعديل" : "إضافة مؤشرات"}
                            <ChevronLeft className="w-4 h-4" />
                          </a>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
