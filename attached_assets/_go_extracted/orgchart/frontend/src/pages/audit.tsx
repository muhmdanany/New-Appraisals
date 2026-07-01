import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldCheck, Calendar, Filter, ChevronLeft, ChevronRight, Download, Lock, LockOpen } from "lucide-react";
import { MergedFromImportDetails } from "@/components/merged-from-import-details";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface AuditEntry {
  id: number;
  userId: number | null;
  userName: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
  legalHold?: boolean;
  legalHoldReason?: string | null;
  legalHoldAt?: string | null;
  legalHoldBy?: number | null;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  auditRetentionDays?: number;
  legalHoldCount?: number;
}

interface AuditArchive {
  name: string;
  url: string;
  createdAt: string;
}

const ENTITY_TYPES = ["employee", "department", "administration", "organization", "import", "audit_log"] as const;
const ACTIONS = [
  "created",
  "updated",
  "deleted",
  "moved",
  "import",
  "merged_from_import",
  "audit_retention_changed",
  "legal_hold_placed",
  "legal_hold_released",
] as const;

const actionColors: Record<string, string> = {
  created: "bg-green-100 text-green-700 border-green-200",
  updated: "bg-blue-100 text-blue-700 border-blue-200",
  deleted: "bg-red-100 text-red-700 border-red-200",
  moved: "bg-amber-100 text-amber-700 border-amber-200",
  import: "bg-purple-100 text-purple-700 border-purple-200",
  merged_from_import: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

export default function AuditPage() {
  const { t } = useTranslation();
  const { selectedOrgId } = useOrg();
  const { hasPermission } = useAuth();
  const canView = hasPermission("audit", "view");
  const canEditHold = hasPermission("audit", "edit");

  const [entityType, setEntityType] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [data, setData] = useState<AuditResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [archives, setArchives] = useState<AuditArchive[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [holdDialogMode, setHoldDialogMode] = useState<"place" | "release" | null>(null);
  const [holdReason, setHoldReason] = useState("");
  const [isSavingHold, setIsSavingHold] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const buildFilterParams = () => {
    const params = new URLSearchParams();
    if (entityType !== "all") params.set("entityType", entityType);
    if (action !== "all") params.set("action", action);
    if (dateFrom) params.set("dateFrom", new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      params.set("dateTo", end.toISOString());
    }
    return params;
  };

  const handleExport = async () => {
    if (!selectedOrgId) return;
    setIsExporting(true);
    try {
      const params = buildFilterParams();
      const res = await fetch(
        `${API_BASE}/organizations/${selectedOrgId}/audit/export?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `audit-log-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!selectedOrgId || !canView) return;
    setIsLoading(true);
    setError(null);
    const params = buildFilterParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    fetch(`${API_BASE}/organizations/${selectedOrgId}/audit?${params.toString()}`, {
      credentials: "include",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: AuditResponse) => {
        setData(d);
        setSelectedIds(new Set());
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [selectedOrgId, entityType, action, dateFrom, dateTo, page, canView, refreshTick]);

  const toggleId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePageSelection = () => {
    if (!data) return;
    const pageIds = data.entries.map((e) => e.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const openHoldDialog = (mode: "place" | "release") => {
    setHoldReason("");
    setHoldDialogMode(mode);
  };

  const submitHold = async () => {
    if (!selectedOrgId || !holdDialogMode || selectedIds.size === 0) return;
    setIsSavingHold(true);
    try {
      const res = await fetch(`${API_BASE}/organizations/${selectedOrgId}/audit/legal-hold`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          hold: holdDialogMode === "place",
          reason: holdDialogMode === "place" && holdReason.trim() ? holdReason.trim() : null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHoldDialogMode(null);
      setRefreshTick((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSavingHold(false);
    }
  };

  const selectionStats = useMemo(() => {
    if (!data) return { selected: 0, allHeld: false, anyHeld: false, anyUnheld: false };
    const sel = data.entries.filter((e) => selectedIds.has(e.id));
    const anyHeld = sel.some((e) => e.legalHold);
    const anyUnheld = sel.some((e) => !e.legalHold);
    return {
      selected: selectedIds.size,
      allHeld: sel.length > 0 && !anyUnheld,
      anyHeld,
      anyUnheld,
    };
  }, [data, selectedIds]);

  useEffect(() => {
    if (!selectedOrgId || !canView) return;
    fetch(`${API_BASE}/organizations/${selectedOrgId}/audit/archives`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : { archives: [] }))
      .then((d: { archives: AuditArchive[] }) => setArchives(d.archives ?? []))
      .catch(() => setArchives([]));
  }, [selectedOrgId, canView]);

  const handleDownloadArchive = async (archive: AuditArchive) => {
    if (!selectedOrgId) return;
    try {
      const res = await fetch(
        `${API_BASE}/organizations/${selectedOrgId}/audit/archives/${encodeURIComponent(archive.name)}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = archive.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const totalPages = useMemo(() => {
    if (!data || data.total === 0) return 1;
    return Math.max(1, Math.ceil(data.total / data.pageSize));
  }, [data]);

  const formatDateTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const formatValue = (v: unknown): string => {
    if (v === null || v === undefined || v === "") return "∅";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  const renderDetails = (entry: AuditEntry) => {
    const d = entry.details || {};
    const name = d.name ? String(d.name) : "";

    if (entry.action === "merged_from_import") {
      return <MergedFromImportDetails details={d} formatValue={formatValue} />;
    }

    if (entry.entityType === "import") {
      const imported = d.imported ?? 0;
      const skipped = d.skipped ?? 0;
      return (
        <span className="text-sm text-foreground">
          {name ? `${name} — ` : ""}+{String(imported)} / ~{String(skipped)}
        </span>
      );
    }

    if (
      entry.action === "updated" &&
      d.changed &&
      typeof d.changed === "object"
    ) {
      const changed = d.changed as Record<string, unknown>;
      const keys = Object.keys(changed);
      return (
        <div className="space-y-1">
          {name && (
            <div className="text-sm font-medium text-foreground">{name}</div>
          )}
          {keys.length === 0 ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            <div className="flex flex-col gap-0.5">
              {keys.map((k) => {
                const entryVal = changed[k];
                let from: unknown;
                let to: unknown;
                if (
                  entryVal &&
                  typeof entryVal === "object" &&
                  ("from" in (entryVal as object) || "to" in (entryVal as object))
                ) {
                  from = (entryVal as { from?: unknown }).from;
                  to = (entryVal as { to?: unknown }).to;
                } else {
                  to = entryVal;
                }
                return (
                  <div key={k} className="flex items-center gap-1.5 text-xs">
                    <span className="font-medium text-muted-foreground">{k}:</span>
                    {from !== undefined && (
                      <>
                        <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 line-through max-w-[180px] truncate">
                          {formatValue(from)}
                        </span>
                        <span className="text-muted-foreground">→</span>
                      </>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 max-w-[180px] truncate">
                      {formatValue(to)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return <span className="text-sm text-foreground">{name || "—"}</span>;
  };

  if (!selectedOrgId) {
    return <div className="p-8 text-muted-foreground">{t("common.selectOrg")}</div>;
  }

  if (!canView) {
    return (
      <div className="p-8 text-muted-foreground">
        {t("settings.error")}: {t("audit.subtitle")}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
              {t("audit.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("audit.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              {data?.total ?? 0}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || !data || data.total === 0}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4" />
              {t("audit.export")}
            </Button>
          </div>
        </div>
        {data?.legalHoldCount && data.legalHoldCount > 0 ? (
          <div
            className="mt-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900/50 px-4 py-2.5 text-sm text-blue-900 dark:text-blue-200"
            data-testid="banner-legal-hold"
          >
            <Lock className="h-4 w-4" />
            <span>{t("audit.legalHoldBanner", { count: data.legalHoldCount })}</span>
          </div>
        ) : null}
        {data?.auditRetentionDays && data.auditRetentionDays > 0 ? (
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 px-4 py-2.5 text-sm"
            data-testid="banner-audit-retention"
          >
            <span className="text-amber-900 dark:text-amber-200">
              {t("audit.retentionBanner", { days: data.auditRetentionDays })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || !data || data.total === 0}
              data-testid="button-export-before-change"
            >
              <Download className="h-4 w-4" />
              {t("audit.exportBeforeChange")}
            </Button>
          </div>
        ) : null}

        {archives.length > 0 ? (
          <div
            className="mt-4 rounded-lg border border-border bg-card px-4 py-3"
            data-testid="section-audit-archives"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-foreground">
                {t("audit.archivesTitle")}
              </h2>
              <span className="text-xs text-muted-foreground">
                {t("audit.archivesSubtitle")}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {archives.map((a) => (
                <li
                  key={a.name}
                  className="flex items-center justify-between py-2"
                  data-testid={`audit-archive-${a.name}`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{a.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.createdAt
                        ? formatDateTime(a.createdAt)
                        : t("audit.archiveTimestampUnknown")}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadArchive(a)}
                    data-testid={`button-download-archive-${a.name}`}
                  >
                    <Download className="h-4 w-4" />
                    {t("audit.downloadArchive")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="p-6">
        <div className="bg-card border border-border rounded-xl shadow-sm">
          <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select
                value={entityType}
                onValueChange={(v) => {
                  setPage(1);
                  setEntityType(v);
                }}
              >
                <SelectTrigger className="h-9 w-[160px]" data-testid="select-entity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("audit.allEntities")}</SelectItem>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`audit.entity.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Select
              value={action}
              onValueChange={(v) => {
                setPage(1);
                setAction(v);
              }}
            >
              <SelectTrigger className="h-9 w-[160px]" data-testid="select-action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("audit.allActions")}</SelectItem>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {t(`audit.actions.${a}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">{t("audit.dateFrom")}</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setPage(1);
                  setDateFrom(e.target.value);
                }}
                className="h-9 w-[150px]"
                data-testid="input-date-from"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">{t("audit.dateTo")}</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setPage(1);
                  setDateTo(e.target.value);
                }}
                className="h-9 w-[150px]"
                data-testid="input-date-to"
              />
            </div>

            {canEditHold && selectionStats.selected > 0 ? (
              <div
                className="ms-auto flex items-center gap-2 rounded-md bg-muted px-2 py-1"
                data-testid="bulk-hold-bar"
              >
                <span className="text-xs text-muted-foreground">
                  {t("audit.legalHoldSelected", { count: selectionStats.selected })}
                </span>
                {selectionStats.anyUnheld ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openHoldDialog("place")}
                    data-testid="button-place-hold"
                  >
                    <Lock className="h-4 w-4" />
                    {t("audit.legalHoldPlace")}
                  </Button>
                ) : null}
                {selectionStats.anyHeld ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openHoldDialog("release")}
                    data-testid="button-release-hold"
                  >
                    <LockOpen className="h-4 w-4" />
                    {t("audit.legalHoldRelease")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-12 text-center text-sm text-destructive">{error}</div>
          ) : !data || data.entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 opacity-20 mb-4" />
              <p className="text-lg font-medium">{t("audit.empty")}</p>
              <p className="text-sm mt-1">{t("audit.emptyDesc")}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {canEditHold ? (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            data.entries.length > 0 &&
                            data.entries.every((e) => selectedIds.has(e.id))
                          }
                          onCheckedChange={togglePageSelection}
                          aria-label={t("audit.selectAll")}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                    ) : null}
                    <TableHead>{t("audit.action")}</TableHead>
                    <TableHead>{t("audit.entityType")}</TableHead>
                    <TableHead>{t("audit.details")}</TableHead>
                    <TableHead>{t("audit.user")}</TableHead>
                    <TableHead>{t("audit.when")}</TableHead>
                    <TableHead>{t("audit.legalHold")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.map((entry) => {
                    const colorClass =
                      actionColors[entry.action] ||
                      "bg-gray-100 text-gray-700 border-gray-200";
                    return (
                      <TableRow
                        key={entry.id}
                        data-testid={`audit-row-${entry.id}`}
                        className={entry.legalHold ? "bg-blue-50/40 dark:bg-blue-950/20" : undefined}
                      >
                        {canEditHold ? (
                          <TableCell className="w-10">
                            <Checkbox
                              checked={selectedIds.has(entry.id)}
                              onCheckedChange={() => toggleId(entry.id)}
                              aria-label={t("audit.selectRow")}
                              data-testid={`checkbox-row-${entry.id}`}
                            />
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${colorClass}`}>
                            {t(`audit.actions.${entry.action}`, { defaultValue: entry.action })}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium capitalize">
                            {t(`audit.entity.${entry.entityType}`, {
                              defaultValue: entry.entityType,
                            })}
                          </span>
                        </TableCell>
                        <TableCell>{renderDetails(entry)}</TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {entry.userName || (
                              <span className="text-muted-foreground">{t("audit.system")}</span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDateTime(entry.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.legalHold ? (
                            <Badge
                              variant="outline"
                              className="gap-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900/50"
                              title={entry.legalHoldReason || undefined}
                              data-testid={`badge-hold-${entry.id}`}
                            >
                              <Lock className="h-3 w-3" />
                              {t("audit.legalHoldOn")}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="p-4 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t("audit.page", { page, total: totalPages })}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t("audit.prev")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    data-testid="button-next-page"
                  >
                    {t("audit.next")}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={holdDialogMode !== null} onOpenChange={(o) => !o && setHoldDialogMode(null)}>
        <DialogContent data-testid="dialog-legal-hold">
          <DialogHeader>
            <DialogTitle>
              {holdDialogMode === "place"
                ? t("audit.legalHoldPlace")
                : t("audit.legalHoldRelease")}
            </DialogTitle>
            <DialogDescription>
              {holdDialogMode === "place"
                ? t("audit.legalHoldConfirmPlace", { count: selectedIds.size })
                : t("audit.legalHoldConfirmRelease", { count: selectedIds.size })}
            </DialogDescription>
          </DialogHeader>
          {holdDialogMode === "place" ? (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground" htmlFor="hold-reason">
                {t("audit.legalHoldReasonLabel")}
              </label>
              <Input
                id="hold-reason"
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder={t("audit.legalHoldReasonPlaceholder")}
                data-testid="input-hold-reason"
                maxLength={500}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldDialogMode(null)} disabled={isSavingHold}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={submitHold}
              disabled={isSavingHold || selectedIds.size === 0}
              data-testid="button-confirm-hold"
            >
              {holdDialogMode === "place" ? (
                <>
                  <Lock className="h-4 w-4" />
                  {t("audit.legalHoldPlace")}
                </>
              ) : (
                <>
                  <LockOpen className="h-4 w-4" />
                  {t("audit.legalHoldRelease")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

