import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { BranchHeadcount, OrgChartNode, TFn } from "@/lib/org-chart/types";

interface BranchSummarySheetProps {
  branchSummaryNodeId: number | null;
  branchSummaryNode: OrgChartNode | null;
  branchSummaryStats: BranchHeadcount | null;
  isFilterActive: boolean;
  onClose: () => void;
  onExport: () => void;
  t: TFn;
}

export function BranchSummarySheet({
  branchSummaryNodeId,
  branchSummaryNode,
  branchSummaryStats,
  isFilterActive,
  onClose,
  onExport,
  t,
}: BranchSummarySheetProps) {
  return (
    <Sheet open={branchSummaryNodeId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto" data-testid="sheet-branch-summary">
        <SheetHeader>
          <SheetTitle>
            {branchSummaryNode
              ? t("orgChart.branchSummaryTitle", {
                  name: `${branchSummaryNode.firstName} ${branchSummaryNode.lastName}`.trim(),
                })
              : t("orgChart.branchSummaryFallbackTitle")}
          </SheetTitle>
        </SheetHeader>
        {branchSummaryNode && branchSummaryStats && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              data-testid="button-branch-summary-export"
            >
              <Download className="h-4 w-4 me-1.5" />
              {t("orgChart.branchSummaryExport")}
            </Button>
          </div>
        )}
        {branchSummaryNode && branchSummaryStats && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("orgChart.branchSummaryTotalLabel")}
                </p>
                <p className="mt-1 text-2xl font-bold" data-testid="branch-summary-total">
                  {branchSummaryStats.total}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t("orgChart.branchSummaryDirectReports", {
                    count: branchSummaryNode.children?.length ?? 0,
                  })}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("orgChart.branchSummaryOpenLabel")}
                </p>
                <p
                  className={`mt-1 text-2xl font-bold ${
                    branchSummaryStats.open > 0 ? "text-amber-600 dark:text-amber-400" : ""
                  }`}
                  data-testid="branch-summary-open"
                >
                  {branchSummaryStats.open}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {branchSummaryStats.total > 0
                    ? t("orgChart.branchSummaryOpenPct", {
                        pct: Math.round((branchSummaryStats.open / branchSummaryStats.total) * 100),
                      })
                    : t("orgChart.branchSummaryOpenNone")}
                </p>
                {branchSummaryStats.avgVacantDays !== null && (
                  <p className="text-[11px] text-muted-foreground mt-0.5" data-testid="branch-summary-avg-vacant">
                    {t("orgChart.branchSummaryAvgVacantDays", { count: branchSummaryStats.avgVacantDays })}
                  </p>
                )}
              </div>
            </div>

            {branchSummaryStats.vacancies.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">{t("orgChart.branchSummaryVacanciesHeader")}</h3>
                <div className="space-y-1.5" data-testid="branch-summary-vacancy-list">
                  {branchSummaryStats.vacancies.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between gap-2 text-sm rounded-md border bg-muted/20 px-2.5 py-1.5"
                      data-testid={`branch-summary-vacancy-${v.id}`}
                    >
                      <span className="truncate min-w-0">
                        <span className="font-medium">
                          {v.title || v.name || t("orgChart.branchSummaryVacancyUntitled")}
                        </span>
                        {v.title && v.name && (
                          <span className="text-muted-foreground"> · {v.name}</span>
                        )}
                      </span>
                      <span
                        className="text-xs flex-shrink-0 text-amber-600 dark:text-amber-400 font-medium"
                        data-testid={`branch-summary-vacancy-days-${v.id}`}
                      >
                        {t("orgChart.branchSummaryVacancyDays", { count: v.days })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold mb-2">{t("orgChart.branchSummaryByDept")}</h3>
              {branchSummaryStats.byDept.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("orgChart.branchSummaryNoBreakdown")}</p>
              ) : (
                <div className="space-y-2" data-testid="branch-summary-dept-list">
                  {branchSummaryStats.byDept.map((d) => {
                    const pct = branchSummaryStats.total > 0
                      ? Math.round((d.count / branchSummaryStats.total) * 100)
                      : 0;
                    return (
                      <div
                        key={d.id ?? "none"}
                        className="space-y-1"
                        data-testid={`branch-summary-dept-${d.id ?? "none"}`}
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 truncate min-w-0">
                            <span
                              className="h-2 w-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: d.color || "hsl(var(--muted-foreground))" }}
                            />
                            <span className="truncate">{d.name}</span>
                          </span>
                          <span className="text-muted-foreground text-xs flex-shrink-0 ms-2">
                            {d.count} · {pct}%
                          </span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {isFilterActive && (
              <p className="text-[11px] text-muted-foreground italic">
                {t("orgChart.branchSummaryFilteredHint")}
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
