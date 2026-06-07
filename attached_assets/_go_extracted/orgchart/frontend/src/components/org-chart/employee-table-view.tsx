import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  MapPin,
  Phone,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  useListEmployeesPaginated,
  getListEmployeesPaginatedQueryKey,
  type Employee,
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { resolvePhotoUrl } from "@/lib/photo-url";
import type { OrgChartNode, TFn } from "@/lib/org-chart/types";

export type SortColumn =
  | "name"
  | "title"
  | "department"
  | "manager"
  | "email"
  | "phone"
  | "location";
export type SortDir = "asc" | "desc";

interface EmployeeTableViewProps {
  orgId: number;
  totalEmployees: number;
  employees: Employee[];
  departments: { id: number; name: string; color: string | null }[];
  filteredIds: Set<number> | null;
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  onRowClick: (node: OrgChartNode) => void;
  onBulkDelete: (ids: number[]) => void;
  onBulkMove: (ids: number[]) => void;
  onBulkExport: (ids: number[]) => void;
  t: TFn;
}

const SERVER_THRESHOLD = 1000;

export function EmployeeTableView({
  orgId,
  totalEmployees,
  employees,
  departments,
  filteredIds,
  selectedIds,
  onSelectionChange,
  onRowClick,
  onBulkDelete,
  onBulkMove,
  onBulkExport,
  t,
}: EmployeeTableViewProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";
  const useServer = totalEmployees > SERVER_THRESHOLD;

  const [sortBy, setSortBy] = useState<SortColumn>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState<number>(50);
  const [pageIndex, setPageIndex] = useState<number>(0);

  // Reset to first page on sort/pageSize change
  useEffect(() => {
    setPageIndex(0);
  }, [sortBy, sortDir, pageSize, useServer, filteredIds === null ? "all" : "filtered"]);

  const deptById = useMemo(() => {
    const m = new Map<number, { name: string; color: string | null }>();
    for (const d of departments) m.set(d.id, { name: d.name, color: d.color });
    return m;
  }, [departments]);

  const managerById = useMemo(() => {
    const m = new Map<number, Employee>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  // Server-side path: query the paginated endpoint when we are above threshold
  // and no client-side filter is constraining the dataset.
  const usingServerNow = useServer && filteredIds === null;
  const paginatedQuery = useListEmployeesPaginated(
    orgId,
    {
      sortBy,
      sortDir,
      limit: pageSize,
      offset: pageIndex * pageSize,
    },
    {
      query: {
        enabled: usingServerNow,
        queryKey: getListEmployeesPaginatedQueryKey(orgId, {
          sortBy,
          sortDir,
          limit: pageSize,
          offset: pageIndex * pageSize,
        }),
      },
    },
  );

  // Client-side path: derive a sorted, paginated slice from the in-memory
  // employees, scoped by filteredIds when the user has the filter bar active.
  const clientSorted = useMemo(() => {
    if (usingServerNow) return [] as Employee[];
    const source = filteredIds
      ? employees.filter((e) => filteredIds.has(e.id))
      : employees;
    const collator = new Intl.Collator(i18n.language || undefined, {
      sensitivity: "base",
      numeric: true,
    });
    const dir = sortDir === "asc" ? 1 : -1;
    const fullName = (e: Employee) => `${e.lastName} ${e.firstName}`.trim();
    const managerName = (e: Employee) => {
      if (e.managerId == null) return "";
      const m = managerById.get(e.managerId);
      return m ? `${m.lastName} ${m.firstName}`.trim() : "";
    };
    const deptName = (e: Employee) =>
      e.departmentId != null ? deptById.get(e.departmentId)?.name ?? "" : "";
    const get = (e: Employee): string => {
      switch (sortBy) {
        case "title":
          return e.title;
        case "email":
          return e.email;
        case "phone":
          return e.phone ?? "";
        case "location":
          return e.location ?? "";
        case "department":
          return deptName(e);
        case "manager":
          return managerName(e);
        case "name":
        default:
          return fullName(e);
      }
    };
    const sorted = [...source].sort((a, b) => {
      const cmp = collator.compare(get(a), get(b));
      if (cmp !== 0) return cmp * dir;
      return a.id - b.id;
    });
    return sorted;
  }, [
    usingServerNow,
    employees,
    filteredIds,
    sortBy,
    sortDir,
    deptById,
    managerById,
    i18n.language,
  ]);

  const totalRows = usingServerNow
    ? paginatedQuery.data?.total ?? 0
    : clientSorted.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const rows = usingServerNow
    ? paginatedQuery.data?.items ?? []
    : clientSorted.slice(
        safePageIndex * pageSize,
        safePageIndex * pageSize + pageSize,
      );

  const isLoading = usingServerNow && paginatedQuery.isLoading;

  const toggleSort = useCallback(
    (col: SortColumn) => {
      if (sortBy === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(col);
        setSortDir("asc");
      }
    },
    [sortBy],
  );

  const allOnPageSelected =
    rows.length > 0 && rows.every((r: Employee) => selectedIds.has(r.id));
  const someOnPageSelected =
    rows.some((r: Employee) => selectedIds.has(r.id)) && !allOnPageSelected;

  const togglePageSelection = useCallback(() => {
    const next = new Set(selectedIds);
    if (allOnPageSelected) {
      for (const r of rows) next.delete(r.id);
    } else {
      for (const r of rows) next.add(r.id);
    }
    onSelectionChange(next);
  }, [allOnPageSelected, rows, selectedIds, onSelectionChange]);

  const toggleRow = useCallback(
    (id: number) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange(next);
    },
    [selectedIds, onSelectionChange],
  );

  const clearSelection = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  const employeeToNode = useCallback(
    (e: Employee): OrgChartNode => {
      const dept = e.departmentId != null ? deptById.get(e.departmentId) : null;
      return {
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        title: e.title,
        email: e.email,
        avatarUrl: e.avatarUrl ?? null,
        departmentId: e.departmentId ?? null,
        departmentName: dept?.name ?? null,
        departmentColor: dept?.color ?? null,
        administrationId: e.administrationId ?? null,
        administrationName: null,
        administrationColor: null,
        managerId: e.managerId ?? null,
        nationality: e.nationality ?? null,
        directReports: 0,
        isActive: e.isActive,
        isOpenPosition: e.isOpenPosition,
        openSinceDate: e.openSinceDate ?? null,
        children: [],
      };
    },
    [deptById],
  );

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortBy !== col)
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
    );
  };

  const headerCell = (col: SortColumn, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(col)}
      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
      data-testid={`table-sort-${col}`}
      aria-sort={
        sortBy === col
          ? sortDir === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <span>{label}</span>
      <SortIcon col={col} />
    </button>
  );

  const selectedCount = selectedIds.size;
  const startRow = totalRows === 0 ? 0 : safePageIndex * pageSize + 1;
  const endRow = Math.min(totalRows, safePageIndex * pageSize + rows.length);

  return (
    <div
      className="w-full h-full flex flex-col bg-card"
      dir={isRtl ? "rtl" : "ltr"}
      data-testid="employee-table-view"
    >
      {selectedCount > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/30 text-sm"
          data-testid="bulk-action-bar"
        >
          <span className="font-medium" data-testid="bulk-selected-count">
            {t("orgChart.table.selectedCount", { count: selectedCount })}
          </span>
          <div className="ms-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkMove([...selectedIds])}
              data-testid="bulk-move-button"
            >
              <Users className="h-4 w-4 me-1" />
              {t("orgChart.table.bulkMove")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkExport([...selectedIds])}
              data-testid="bulk-export-button"
            >
              <Download className="h-4 w-4 me-1" />
              {t("orgChart.table.bulkExport")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onBulkDelete([...selectedIds])}
              data-testid="bulk-delete-button"
            >
              <Trash2 className="h-4 w-4 me-1" />
              {t("orgChart.table.bulkDelete")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              data-testid="bulk-clear-button"
              aria-label={t("orgChart.table.clearSelection")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 border-b text-start w-10">
                <Checkbox
                  checked={
                    allOnPageSelected
                      ? true
                      : someOnPageSelected
                      ? "indeterminate"
                      : false
                  }
                  onCheckedChange={togglePageSelection}
                  data-testid="table-select-page"
                  aria-label={t("orgChart.table.selectPage")}
                />
              </th>
              <th className="px-3 py-2 border-b text-start min-w-[200px]">
                {headerCell("name", t("orgChart.table.name"))}
              </th>
              <th className="px-3 py-2 border-b text-start min-w-[160px]">
                {headerCell("title", t("orgChart.table.title"))}
              </th>
              <th className="px-3 py-2 border-b text-start min-w-[140px]">
                {headerCell("department", t("orgChart.table.department"))}
              </th>
              <th className="px-3 py-2 border-b text-start min-w-[160px]">
                {headerCell("manager", t("orgChart.table.manager"))}
              </th>
              <th className="px-3 py-2 border-b text-start min-w-[180px]">
                {headerCell("email", t("orgChart.table.email"))}
              </th>
              <th className="px-3 py-2 border-b text-start min-w-[140px]">
                {headerCell("phone", t("orgChart.table.phone"))}
              </th>
              <th className="px-3 py-2 border-b text-start min-w-[140px]">
                {headerCell("location", t("orgChart.table.location"))}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  <td colSpan={8} className="px-3 py-2 border-b">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-12 text-center text-muted-foreground"
                  data-testid="table-empty-state"
                >
                  {t("orgChart.table.empty")}
                </td>
              </tr>
            ) : (
              rows.map((e: Employee) => {
                const dept = e.departmentId != null ? deptById.get(e.departmentId) : null;
                const mgr = e.managerId != null ? managerById.get(e.managerId) : null;
                const isSelected = selectedIds.has(e.id);
                return (
                  <tr
                    key={e.id}
                    onClick={() => onRowClick(employeeToNode(e))}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      isSelected ? "bg-primary/5" : ""
                    }`}
                    data-testid={`table-row-${e.id}`}
                  >
                    <td
                      className="px-3 py-2 border-b align-middle"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(e.id)}
                        data-testid={`table-row-checkbox-${e.id}`}
                        aria-label={t("orgChart.table.selectRow")}
                      />
                    </td>
                    <td className="px-3 py-2 border-b align-middle">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-7 w-7 flex-shrink-0">
                          <AvatarImage src={resolvePhotoUrl(e.avatarUrl)} />
                          <AvatarFallback
                            className="text-[10px]"
                            style={{
                              backgroundColor: dept?.color ? `${dept.color}20` : undefined,
                              color: dept?.color || undefined,
                            }}
                          >
                            {(e.firstName[0] || "").toUpperCase()}
                            {(e.lastName[0] || "").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {e.firstName} {e.lastName}
                          </div>
                          {e.isOpenPosition && (
                            <div className="text-[10px] text-amber-600 uppercase tracking-wide">
                              {t("orgChart.table.openPosition")}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 border-b align-middle truncate">{e.title}</td>
                    <td className="px-3 py-2 border-b align-middle">
                      {dept ? (
                        <span className="inline-flex items-center gap-1.5">
                          {dept.color && (
                            <span
                              className="w-2 h-2 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: dept.color }}
                              aria-hidden
                            />
                          )}
                          <span className="truncate">{dept.name}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-b align-middle truncate">
                      {mgr ? (
                        `${mgr.firstName} ${mgr.lastName}`
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-b align-middle">
                      <a
                        href={`mailto:${e.email}`}
                        className="inline-flex items-center gap-1.5 text-primary hover:underline truncate"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                        <span className="truncate">{e.email}</span>
                      </a>
                    </td>
                    <td className="px-3 py-2 border-b align-middle">
                      {e.phone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                          <span className="truncate">{e.phone}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-b align-middle">
                      {e.location ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                          <span className="truncate">{e.location}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 px-4 py-2 border-t bg-card text-sm">
        <span data-testid="table-page-info" className="text-muted-foreground">
          {t("orgChart.table.pageInfo", {
            start: startRow,
            end: endRow,
            total: totalRows,
          })}
        </span>
        <div className="ms-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {t("orgChart.table.rowsPerPage")}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(parseInt(v, 10))}
            >
              <SelectTrigger className="h-8 w-[80px]" data-testid="table-page-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100, 200].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              disabled={safePageIndex === 0}
              data-testid="table-prev-page"
              aria-label={t("orgChart.table.prevPage")}
            >
              {isRtl ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
            <span className="text-xs text-muted-foreground px-2" data-testid="table-page-indicator">
              {t("orgChart.table.pageOf", {
                page: safePageIndex + 1,
                total: pageCount,
              })}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
              disabled={safePageIndex >= pageCount - 1}
              data-testid="table-next-page"
              aria-label={t("orgChart.table.nextPage")}
            >
              {isRtl ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
