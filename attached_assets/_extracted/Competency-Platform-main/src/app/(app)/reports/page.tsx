"use client";

import { Download, FileText, Loader2 } from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv";
import {
  COMPETENCY_TYPE_LABELS,
  COMPETENCY_LEVEL_LABELS,
  CONTRACT_TYPE_LABELS,
} from "@/lib/enums";

function ReportCard({
  title,
  description,
  count,
  loading,
  onExport,
}: {
  title: string;
  description: string;
  count?: number;
  loading?: boolean;
  onExport: () => void;
}) {
  return (
    <Card className="flex flex-col p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="size-5" />
        </div>
        <div>
          <div className="font-bold text-foreground">{title}</div>
          <div className="text-[11px] text-muted-foreground">{description}</div>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="text-sm text-muted-foreground">
          {loading ? "…" : `${count ?? 0} سجل`}
        </span>
        <Button variant="outline" size="sm" disabled={loading || !count} onClick={onExport}>
          <Download className="size-4" /> تصدير CSV
        </Button>
      </div>
    </Card>
  );
}

export default function ReportsPage() {
  const evaluations = api.report.evaluations.useQuery();
  const employees = api.employee.list.useQuery({ take: 500, skip: 0 });
  const jobs = api.job.list.useQuery({ take: 500, skip: 0 });
  const competencies = api.competency.list.useQuery({ take: 500, skip: 0 });
  const grades = api.grade.list.useQuery();
  const analytics = api.dashboard.analytics.useQuery();

  // Active bell-curve policy target % per band (policy is low→high; our bands are high→low).
  const policyDist = analytics.data?.policy?.distribution as
    | { labels?: string[]; achieved?: number[] }
    | null
    | undefined;
  const targets = policyDist?.achieved ? [...policyDist.achieved].reverse() : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">التقارير والتصدير</h1>
        <p className="text-sm text-muted-foreground">تصدير بيانات المنصة بصيغة CSV ومراجعة توزيع الأداء</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ReportCard
          title="التقييمات"
          description="جميع التقييمات ودرجاتها وحالاتها"
          count={evaluations.data?.length}
          loading={evaluations.isLoading}
          onExport={() => evaluations.data && downloadCsv("تقرير_التقييمات", evaluations.data)}
        />
        <ReportCard
          title="الموظفون"
          description="سجل الموظفين والهيكل الإداري"
          count={employees.data?.length}
          loading={employees.isLoading}
          onExport={() =>
            employees.data &&
            downloadCsv(
              "تقرير_الموظفين",
              employees.data.map((e) => ({
                "الرقم الوظيفي": e.employeeNumber,
                الاسم: e.name,
                الوظيفة: e.job?.name ?? "",
                الإدارة: e.department?.name ?? "",
                "المدير المباشر": e.manager?.name ?? "",
              })),
            )
          }
        />
        <ReportCard
          title="الوظائف"
          description="المسميات الوظيفية والجدارات"
          count={jobs.data?.length}
          loading={jobs.isLoading}
          onExport={() =>
            jobs.data &&
            downloadCsv(
              "تقرير_الوظائف",
              jobs.data.map((j) => ({
                المسمى: j.name,
                الإدارة: j.department?.name ?? "",
                الدرجة: j.grade?.num ?? "",
                "نوع العقد": CONTRACT_TYPE_LABELS[j.contractType],
                "عدد الجدارات": j._count.competencies,
              })),
            )
          }
        />
        <ReportCard
          title="الجدارات"
          description="الجدارات وأنواعها ومستوياتها"
          count={competencies.data?.length}
          loading={competencies.isLoading}
          onExport={() =>
            competencies.data &&
            downloadCsv(
              "تقرير_الجدارات",
              competencies.data.map((c) => ({
                الاسم: c.name,
                النوع: COMPETENCY_TYPE_LABELS[c.type],
                المستوى: COMPETENCY_LEVEL_LABELS[c.level],
                المؤشرات: c.indicators ?? "",
              })),
            )
          }
        />
        <ReportCard
          title="الدرجات"
          description="سلّم الدرجات الوظيفية"
          count={grades.data?.length}
          loading={grades.isLoading}
          onExport={() =>
            grades.data &&
            downloadCsv(
              "تقرير_الدرجات",
              grades.data.map((g) => ({
                الرقم: g.num,
                الاسم: g.name,
                "عدد المستويات": g.levels.length,
                "أيام الإجازة": g.leaveDays,
              })),
            )
          }
        />
      </div>

      {/* Bell-curve / rating distribution */}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-bold">منحنى التوزيع — الأداء الفعلي مقابل السياسة المعتمدة</h2>
        {analytics.isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto size-5 animate-spin" />
          </p>
        ) : !analytics.data || analytics.data.finalizedCount === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">لا توجد تقييمات معتمدة لعرض التوزيع.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التقدير</TableHead>
                <TableHead className="w-24 text-center">العدد الفعلي</TableHead>
                <TableHead className="w-24 text-center">النسبة الفعلية</TableHead>
                {targets && <TableHead className="w-28 text-center">المستهدف (السياسة)</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.data.distribution.map((d, i) => {
                const pct = Math.round((d.count / analytics.data!.finalizedCount) * 100);
                return (
                  <TableRow key={d.label}>
                    <TableCell className="font-medium">{d.label}</TableCell>
                    <TableCell className="text-center">{d.count}</TableCell>
                    <TableCell className="text-center font-semibold">{pct}%</TableCell>
                    {targets && <TableCell className="text-center text-muted-foreground">{targets[i] ?? "—"}%</TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {analytics.data?.policy && (
          <p className="mt-2 text-[11px] text-muted-foreground">السياسة المعتمدة: {analytics.data.policy.name}</p>
        )}
      </Card>
    </div>
  );
}
