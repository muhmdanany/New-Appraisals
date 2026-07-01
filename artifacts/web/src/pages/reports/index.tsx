import { useReportEvaluations } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, Download } from "lucide-react";

export default function Reports() {
  const { data: reports, isLoading } = useReportEvaluations();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">التقارير</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 ml-2" />
            طباعة
          </Button>
          <Button variant="outline" onClick={() => {
            if (!reports?.length) return;
            const headers = ["الموظف", "الرقم الوظيفي", "القسم", "الوظيفة", "الفترة", "الدرجة", "الحالة"];
            const csv = [headers.join(","), ...reports.map((r: any) =>
              [r.employeeName, r.employeeNumber, r.department, r.jobTitle, r.period, r.totalScore, r.status].join(",")
            )].join("\n");
            const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "تقرير_التقييمات.csv"; a.click();
            URL.revokeObjectURL(url);
          }}>
            <Download className="w-4 h-4 ml-2" />
            تصدير CSV
          </Button>
        </div>
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