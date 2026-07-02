import { Link } from "wouter";
import { useListJobs, useListKpis } from "@workspace/api-client-react";
import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft } from "lucide-react";

export default function Kpis() {
  const { t } = useTranslation();
  const { data: jobs, isLoading } = useListJobs();
  const { data: kpis } = useListKpis();
  const countByJob = new Map((kpis ?? []).map((k) => [k.jobId, k.kpiCount]));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">{t("kpis.title")}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("kpis.byJob")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">{t("kpis.job")}</TableHead>
                  <TableHead className="text-right">{t("kpis.department")}</TableHead>
                  <TableHead className="text-right">{t("kpis.count")}</TableHead>
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
                          <span className="text-muted-foreground text-sm">{t("kpis.noKpis")}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/kpis/${job.id}`}>
                          <a className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                            {count > 0 ? t("kpis.viewEdit") : t("kpis.addKpis")}
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
