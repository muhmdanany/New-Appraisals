import { useState, useMemo } from "react";
import { useReportEvaluations } from "@workspace/api-client-react";
import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Search } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  "مسودة": "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  "قيد الاعتماد": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "معتمد": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "مرفوض": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "تم الإقرار": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "معترض عليه": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

export default function Reports() {
  const { t } = useTranslation();
  const { data: rows = [], isLoading } = useReportEvaluations();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");

  // Extract unique filter values
  const departments = useMemo(() => [...new Set((rows as any[]).map((r: any) => r.departmentName).filter(Boolean))].sort(), [rows]);
  const periods = useMemo(() => [...new Set((rows as any[]).map((r: any) => r.period).filter(Boolean))].sort(), [rows]);
  const statuses = useMemo(() => [...new Set((rows as any[]).map((r: any) => r.status).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    return (rows as any[]).filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (deptFilter !== "all" && r.departmentName !== deptFilter) return false;
      if (periodFilter !== "all" && r.period !== periodFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.employeeName?.toLowerCase().includes(q) ||
          r.employeeNumber?.toLowerCase().includes(q) ||
          r.jobName?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [rows, search, statusFilter, deptFilter, periodFilter]);

  const exportCSV = () => {
    const headers = [t("reports.exportHeaders.employeeName"), t("reports.exportHeaders.employeeNum"), t("reports.exportHeaders.department"), t("reports.exportHeaders.job"), t("reports.exportHeaders.period"), t("reports.exportHeaders.kpis"), t("reports.exportHeaders.competencies"), t("reports.exportHeaders.totalScore"), t("reports.exportHeaders.rating"), t("reports.exportHeaders.status"), t("reports.exportHeaders.evaluator"), t("reports.exportHeaders.approver"), t("reports.exportHeaders.date")];
    const csvRows = [headers.join(",")];
    for (const r of filtered) {
      csvRows.push([
        r.employeeName, r.employeeNumber, r.departmentName, r.jobName, r.period,
        r.kpiScore ?? "", r.competencyScore ?? "", r.totalScore ?? "", r.ratingLabel, r.status,
        r.evaluatorName, r.approver, r.date,
      ].map((v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t("reports.evalReports")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const data = filtered.map((r: any) => ({
        [t("reports.exportHeaders.employeeName")]: r.employeeName,
        [t("reports.exportHeaders.employeeNum")]: r.employeeNumber,
        [t("reports.exportHeaders.department")]: r.departmentName,
        [t("reports.exportHeaders.job")]: r.jobName,
        [t("reports.exportHeaders.period")]: r.period,
        [t("reports.exportHeaders.kpis")]: r.kpiScore,
        [t("reports.exportHeaders.competencies")]: r.competencyScore,
        [t("reports.exportHeaders.totalScore")]: r.totalScore,
        [t("reports.exportHeaders.rating")]: r.ratingLabel,
        [t("reports.exportHeaders.status")]: r.status,
        [t("reports.exportHeaders.evaluator")]: r.evaluatorName,
        [t("reports.exportHeaders.approver")]: r.approver,
        [t("reports.exportHeaders.date")]: r.date,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, t("reports.sheetName"));
      XLSX.writeFile(wb, `${t("reports.evalReports")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      exportCSV(); // Fallback to CSV if xlsx not available
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">{t("reports.title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 ml-2" />
            {t("common.exportCSV")}
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <FileSpreadsheet className="w-4 h-4 ml-2" />
            {t("common.exportExcel")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={t("reports.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("reports.statusFilter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("reports.allStatuses")}</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("reports.deptFilter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("reports.allDepts")}</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("reports.periodFilter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("reports.allPeriods")}</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("reports.evalReports")}</CardTitle>
            <span className="text-sm text-muted-foreground">{filtered.length} {t("reports.result")}</span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("reports.employee")}</TableHead>
                    <TableHead>{t("reports.employeeNum")}</TableHead>
                    <TableHead>{t("reports.department")}</TableHead>
                    <TableHead>{t("reports.job")}</TableHead>
                    <TableHead>{t("reports.period")}</TableHead>
                    <TableHead className="text-center">KPI</TableHead>
                    <TableHead className="text-center">{t("reports.competencies")}</TableHead>
                    <TableHead className="text-center">{t("reports.score")}</TableHead>
                    <TableHead>{t("reports.rating")}</TableHead>
                    <TableHead>{t("reports.status")}</TableHead>
                    <TableHead>{t("reports.evaluator")}</TableHead>
                    <TableHead>{t("reports.date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                        {t("common.noResults")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.employeeName}</TableCell>
                        <TableCell>{r.employeeNumber}</TableCell>
                        <TableCell>{r.departmentName}</TableCell>
                        <TableCell>{r.jobName}</TableCell>
                        <TableCell>{r.period}</TableCell>
                        <TableCell className="text-center">{r.kpiScore != null ? Math.round(r.kpiScore) : "—"}</TableCell>
                        <TableCell className="text-center">{r.competencyScore != null ? Math.round(r.competencyScore) : "—"}</TableCell>
                        <TableCell className="text-center font-semibold">{r.totalScore ?? "—"}</TableCell>
                        <TableCell>{r.ratingLabel || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[r.status] || ""}>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.evaluatorName}</TableCell>
                        <TableCell>{r.date}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
