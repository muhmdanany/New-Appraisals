import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  ShieldCheck,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  Download,
  Building2,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface AdminActivityEntry {
  id: number;
  organizationId: number;
  organizationName: string | null;
  userId: number | null;
  userName: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

interface AdminActivityResponse {
  entries: AdminActivityEntry[];
  total: number;
  page: number;
  pageSize: number;
}

interface AdminAction {
  key: string;
  entityType: string;
  action: string;
  category: string;
}

interface OrgOption {
  id: number;
  name: string;
}

const categoryColors: Record<string, string> = {
  organization: "bg-purple-100 text-purple-700 border-purple-200",
  policy: "bg-amber-100 text-amber-700 border-amber-200",
  integration: "bg-cyan-100 text-cyan-700 border-cyan-200",
  compliance: "bg-emerald-100 text-emerald-700 border-emerald-200",
  sso: "bg-indigo-100 text-indigo-700 border-indigo-200",
  webhook: "bg-pink-100 text-pink-700 border-pink-200",
  api_token: "bg-blue-100 text-blue-700 border-blue-200",
  audit: "bg-rose-100 text-rose-700 border-rose-200",
  platform: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function AdminActivityPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSystemAdmin = !!user?.isSystemAdmin;

  const [actor, setActor] = useState("");
  const [orgId, setOrgId] = useState<string>("all");
  const [actionKey, setActionKey] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [actions, setActions] = useState<AdminAction[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [data, setData] = useState<AdminActivityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildFilterParams = () => {
    const params = new URLSearchParams();
    if (actor.trim()) params.set("actor", actor.trim());
    if (orgId !== "all") params.set("orgId", orgId);
    if (actionKey !== "all") params.set("action", actionKey);
    if (dateFrom) params.set("dateFrom", new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      params.set("dateTo", end.toISOString());
    }
    return params;
  };

  useEffect(() => {
    if (!isSystemAdmin) return;
    fetch(`${API_BASE}/admin/activity/actions`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { actions: [] }))
      .then((d: { actions: AdminAction[] }) => setActions(d.actions ?? []))
      .catch(() => setActions([]));
    fetch(`${API_BASE}/admin/activity/orgs`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { organizations: [] }))
      .then((d: { organizations: OrgOption[] }) => setOrgs(d.organizations ?? []))
      .catch(() => setOrgs([]));
  }, [isSystemAdmin]);

  useEffect(() => {
    if (!isSystemAdmin) return;
    setIsLoading(true);
    setError(null);
    const params = buildFilterParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    fetch(`${API_BASE}/admin/activity?${params.toString()}`, {
      credentials: "include",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: AdminActivityResponse) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSystemAdmin, actor, orgId, actionKey, dateFrom, dateTo, page]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = buildFilterParams();
      const res = await fetch(
        `${API_BASE}/admin/activity/export?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `admin-activity-${today}.csv`;
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

  const totalPages = useMemo(() => {
    if (!data || data.total === 0) return 1;
    return Math.max(1, Math.ceil(data.total / data.pageSize));
  }, [data]);

  const actionsByCategory = useMemo(() => {
    const groups: Record<string, AdminAction[]> = {};
    for (const a of actions) {
      (groups[a.category] = groups[a.category] || []).push(a);
    }
    return groups;
  }, [actions]);

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

  const renderDetails = (entry: AdminActivityEntry) => {
    const d = entry.details || {};
    const parts: string[] = [];
    if (typeof d.name === "string" && d.name) parts.push(d.name);
    if (
      d.changed &&
      typeof d.changed === "object" &&
      !Array.isArray(d.changed)
    ) {
      const keys = Object.keys(d.changed as Record<string, unknown>);
      if (keys.length > 0) parts.push(keys.join(", "));
    }
    if (typeof d.reason === "string" && d.reason) {
      parts.push(`"${d.reason}"`);
    }
    if (typeof d.count === "number") {
      parts.push(t("adminActivity.entriesCount", { count: d.count as number }));
    }
    if (parts.length === 0) {
      // Fall back to first 2 keys for visibility.
      const keys = Object.keys(d).slice(0, 2);
      if (keys.length === 0) return <span className="text-muted-foreground">—</span>;
      return (
        <span className="text-xs text-muted-foreground truncate max-w-[260px] inline-block">
          {keys.map((k) => `${k}: ${formatValue(d[k])}`).join(" · ")}
        </span>
      );
    }
    return <span className="text-sm text-foreground">{parts.join(" — ")}</span>;
  };

  if (!isSystemAdmin) {
    return (
      <div className="p-8 text-muted-foreground" data-testid="admin-activity-not-authorized">
        {t("adminActivity.notAuthorized")}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto" data-testid="admin-activity-page">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1
              className="text-2xl font-bold text-foreground flex items-center gap-2"
              data-testid="text-page-title"
            >
              <ShieldCheck className="h-6 w-6 text-primary" />
              {t("adminActivity.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("adminActivity.subtitle")}
            </p>
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
              {t("adminActivity.export")}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-card border border-border rounded-xl shadow-sm">
          <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={t("adminActivity.actorPlaceholder")}
                value={actor}
                onChange={(e) => {
                  setPage(1);
                  setActor(e.target.value);
                }}
                className="h-9 w-[200px]"
                data-testid="input-actor"
              />
            </div>

            <Select
              value={orgId}
              onValueChange={(v) => {
                setPage(1);
                setOrgId(v);
              }}
            >
              <SelectTrigger className="h-9 w-[200px]" data-testid="select-org">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("adminActivity.allOrgs")}</SelectItem>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={actionKey}
              onValueChange={(v) => {
                setPage(1);
                setActionKey(v);
              }}
            >
              <SelectTrigger className="h-9 w-[260px]" data-testid="select-action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("adminActivity.allActions")}</SelectItem>
                {Object.keys(actionsByCategory)
                  .sort()
                  .map((cat) => (
                    <div key={cat}>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                        {t(`adminActivity.categories.${cat}`, { defaultValue: cat })}
                      </div>
                      {actionsByCategory[cat].map((a) => (
                        <SelectItem key={a.key} value={a.key}>
                          {t(`adminActivity.actions.${a.key}`, {
                            defaultValue: `${a.entityType} · ${a.action}`,
                          })}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {t("adminActivity.dateFrom")}
              </span>
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
              <span className="text-xs text-muted-foreground">
                {t("adminActivity.dateTo")}
              </span>
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
              <p className="text-lg font-medium">{t("adminActivity.empty")}</p>
              <p className="text-sm mt-1">{t("adminActivity.emptyDesc")}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("adminActivity.action")}</TableHead>
                    <TableHead>{t("adminActivity.organization")}</TableHead>
                    <TableHead>{t("adminActivity.actor")}</TableHead>
                    <TableHead>{t("adminActivity.details")}</TableHead>
                    <TableHead>{t("adminActivity.when")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.map((entry) => {
                    const key = `${entry.entityType}:${entry.action}`;
                    const def = actions.find((a) => a.key === key);
                    const colorClass =
                      (def && categoryColors[def.category]) ||
                      "bg-gray-100 text-gray-700 border-gray-200";
                    return (
                      <TableRow
                        key={entry.id}
                        data-testid={`admin-activity-row-${entry.id}`}
                      >
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${colorClass}`}>
                            {t(`adminActivity.actions.${key}`, {
                              defaultValue: `${entry.entityType} · ${entry.action}`,
                            })}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate max-w-[200px]">
                              {entry.organizationName || (
                                <span className="text-muted-foreground">
                                  #{entry.organizationId}
                                </span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {entry.userName || (
                              <span className="text-muted-foreground">
                                {t("adminActivity.system")}
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>{renderDetails(entry)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDateTime(entry.createdAt)}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="p-4 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t("adminActivity.page", { page, total: totalPages })}
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
                    {t("adminActivity.prev")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    data-testid="button-next-page"
                  >
                    {t("adminActivity.next")}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
