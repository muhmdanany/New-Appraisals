import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import {
  useGetRecentActivity,
  getGetRecentActivityQueryKey,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Search,
  ClipboardList,
  UserPlus,
  UserMinus,
  Edit,
  Trash2,
  ArrowRightLeft,
  Calendar,
  Filter,
  Activity,
  FileDown,
  Briefcase,
  Loader2,
  AlertTriangle,
  Mail,
  Send,
  Save,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const typeIcons: Record<string, typeof UserPlus> = {
  created: UserPlus,
  updated: Edit,
  deleted: Trash2,
  moved: ArrowRightLeft,
  removed: UserMinus,
};

const typeColors: Record<string, string> = {
  created: "bg-green-100 text-green-700 border-green-200",
  updated: "bg-blue-100 text-blue-700 border-blue-200",
  deleted: "bg-red-100 text-red-700 border-red-200",
  moved: "bg-amber-100 text-amber-700 border-amber-200",
  removed: "bg-orange-100 text-orange-700 border-orange-200",
};

interface MonthlyCounts {
  joiners: number;
  leavers: number;
  moves: number;
  roleChanges: number;
  openedPositions: number;
  closedPositions: number;
}
interface JoinerRow {
  employeeId: number;
  name: string;
  title: string;
  department: string;
  date: string;
}
interface MoveRow {
  employeeId: number;
  name: string;
  fromDepartment?: string;
  toDepartment?: string;
  fromTitle?: string;
  toTitle?: string;
  fromManager?: string;
  toManager?: string;
  kind: string;
  date: string;
}
interface OpenPositionRow {
  employeeId: number;
  title: string;
  department: string;
  openSince: string;
  ageDays: number;
  urgency: "ok" | "warn" | "urgent";
}
interface MonthlyReport {
  organizationId: number;
  organizationName: string;
  organizationLogoUrl?: string;
  from: string;
  to: string;
  generatedAt: string;
  generatedByName: string;
  language: string;
  counts: MonthlyCounts;
  joiners: JoinerRow[];
  leavers: JoinerRow[];
  moves: MoveRow[];
  roleChanges: MoveRow[];
  openPositions: OpenPositionRow[];
}

type Preset = "thisMonth" | "lastMonth" | "lastQuarter" | "custom";

function presetRange(p: Preset): { from: string; to: string } {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = today.getMonth();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (p === "thisMonth") {
    return {
      from: fmt(new Date(yyyy, mm, 1)),
      to: fmt(new Date(yyyy, mm + 1, 0)),
    };
  }
  if (p === "lastMonth") {
    return {
      from: fmt(new Date(yyyy, mm - 1, 1)),
      to: fmt(new Date(yyyy, mm, 0)),
    };
  }
  if (p === "lastQuarter") {
    return {
      from: fmt(new Date(yyyy, mm - 3, 1)),
      to: fmt(new Date(yyyy, mm, 0)),
    };
  }
  return { from: "", to: "" };
}

const urgencyClasses: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  warn: "bg-amber-100 text-amber-700 border-amber-200",
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

interface ReportSchedule {
  id: number;
  organizationId: number;
  reportType: string;
  cadence: "monthly" | "weekly";
  recipients: string[];
  language: string;
  enabled: boolean;
  lastSentAt?: string | null;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
}

function ScheduleCard({ orgId }: { orgId: number }) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canEdit = hasPermission("organizations", "edit");

  const [schedule, setSchedule] = useState<ReportSchedule | null>(null);
  const [cadence, setCadence] = useState<"monthly" | "weekly">("monthly");
  const [recipientsText, setRecipientsText] = useState("");
  const [language, setLanguage] = useState("en");
  const [enabled, setEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applySchedule = (s: ReportSchedule | null) => {
    setSchedule(s);
    if (s) {
      setCadence(s.cadence);
      setRecipientsText(s.recipients.join("\n"));
      setLanguage(s.language || "en");
      setEnabled(s.enabled);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetch(
      `${API_BASE}/organizations/${orgId}/reports/monthly-changes/schedule`,
      { credentials: "include" },
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { schedule: ReportSchedule | null }) => applySchedule(d.schedule))
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [orgId]);

  const parseRecipients = (): string[] =>
    recipientsText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const save = async () => {
    setError(null);
    const recipients = parseRecipients();
    if (recipients.length === 0) {
      setError(t("reports.monthly.schedule.atLeastOneRecipient"));
      return;
    }
    if (recipients.some((r) => !/^.+@.+\..+$/.test(r))) {
      setError(t("reports.monthly.schedule.invalidEmail"));
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/organizations/${orgId}/reports/monthly-changes/schedule`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cadence, recipients, language, enabled }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      applySchedule(json.schedule);
      toast({ title: t("reports.monthly.schedule.saved") });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const sendNow = async () => {
    setError(null);
    setIsSending(true);
    try {
      const res = await fetch(
        `${API_BASE}/organizations/${orgId}/reports/monthly-changes/schedule/run`,
        { method: "POST", credentials: "include" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      toast({ title: t("reports.monthly.schedule.sent") });
      // Refresh to update lastSentAt.
      const r2 = await fetch(
        `${API_BASE}/organizations/${orgId}/reports/monthly-changes/schedule`,
        { credentials: "include" },
      );
      if (r2.ok) {
        const d2 = await r2.json();
        applySchedule(d2.schedule);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t("reports.monthly.schedule.confirmDelete"))) return;
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/organizations/${orgId}/reports/monthly-changes/schedule`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      applySchedule(null);
      setRecipientsText("");
      setCadence("monthly");
      setLanguage("en");
      setEnabled(true);
      toast({ title: t("reports.monthly.schedule.removed") });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const fmtDate = (s?: string | null) => {
    if (!s) return t("reports.monthly.schedule.never");
    try {
      return new Date(s).toLocaleString(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return s;
    }
  };

  return (
    <div
      className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3"
      data-testid="card-report-schedule"
    >
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">
          {t("reports.monthly.schedule.title")}
        </h3>
        {schedule && (
          <Badge variant="secondary" className="ms-auto">
            {schedule.enabled ? "ON" : "OFF"}
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {t("reports.monthly.schedule.description")}
      </p>

      {!canEdit && (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {t("reports.monthly.schedule.noPermission")}
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">
                {t("reports.monthly.schedule.cadence")}
              </label>
              <Select
                value={cadence}
                onValueChange={(v) => setCadence(v as "monthly" | "weekly")}
                disabled={!canEdit}
              >
                <SelectTrigger
                  className="h-9"
                  data-testid="select-schedule-cadence"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">
                    {t("reports.monthly.schedule.cadenceMonthly")}
                  </SelectItem>
                  <SelectItem value="weekly">
                    {t("reports.monthly.schedule.cadenceWeekly")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">
                {t("reports.monthly.schedule.language")}
              </label>
              <Select
                value={language}
                onValueChange={setLanguage}
                disabled={!canEdit}
              >
                <SelectTrigger
                  className="h-9"
                  data-testid="select-schedule-language"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              {t("reports.monthly.schedule.recipients")}
            </label>
            <Textarea
              value={recipientsText}
              onChange={(e) => setRecipientsText(e.target.value)}
              placeholder={t("reports.monthly.schedule.recipientsPlaceholder")}
              rows={4}
              disabled={!canEdit}
              data-testid="textarea-schedule-recipients"
            />
            <span className="text-xs text-muted-foreground">
              {t("reports.monthly.schedule.recipientsHint")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={!canEdit}
              data-testid="switch-schedule-enabled"
            />
            <span className="text-sm">
              {t("reports.monthly.schedule.enabled")}
            </span>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={save}
              disabled={!canEdit || isSaving}
              data-testid="button-save-schedule"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t("reports.monthly.schedule.save")}
            </Button>
            <Button
              variant="outline"
              onClick={sendNow}
              disabled={!canEdit || isSending || !schedule}
              data-testid="button-schedule-send-now"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t("reports.monthly.schedule.sendNow")}
            </Button>
            {schedule && (
              <Button
                variant="ghost"
                onClick={remove}
                disabled={!canEdit || isSaving}
                data-testid="button-schedule-delete"
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                {t("reports.monthly.schedule.delete")}
              </Button>
            )}
            <div className="ms-auto flex flex-col items-end text-xs text-muted-foreground">
              {schedule ? (
                <>
                  <span>
                    {t("reports.monthly.schedule.nextRun", {
                      date: fmtDate(schedule.nextRunAt),
                    })}
                  </span>
                  <span>
                    {t("reports.monthly.schedule.lastSent", {
                      date: fmtDate(schedule.lastSentAt),
                    })}
                  </span>
                </>
              ) : (
                <span>{t("reports.monthly.schedule.notConfigured")}</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MonthlyReportPanel() {
  const { selectedOrgId } = useOrg();
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const canView = hasPermission("audit", "view");

  const initial = presetRange("thisMonth");
  const [preset, setPreset] = useState<Preset>("thisMonth");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const r = presetRange(p);
      setFrom(r.from);
      setTo(r.to);
    }
  };

  useEffect(() => {
    if (!selectedOrgId || !canView || !from || !to) return;
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({ from, to, lang: i18n.language });
    fetch(
      `${API_BASE}/organizations/${selectedOrgId}/reports/monthly-changes?${params.toString()}`,
      { credentials: "include" },
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: MonthlyReport) => setReport(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [selectedOrgId, from, to, canView, i18n.language]);

  const downloadPDF = async () => {
    if (!selectedOrgId || !from || !to) return;
    setIsDownloading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to, lang: i18n.language });
      const res = await fetch(
        `${API_BASE}/organizations/${selectedOrgId}/reports/monthly-changes.pdf?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `monthly-changes-${from}_to_${to}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!canView) {
    return (
      <div className="p-8 text-muted-foreground">
        {t("reports.monthly.noPermission")}
      </div>
    );
  }

  const counters = report
    ? [
        {
          label: t("reports.monthly.joiners"),
          value: report.counts.joiners,
          color: "text-emerald-600",
          icon: UserPlus,
        },
        {
          label: t("reports.monthly.leavers"),
          value: report.counts.leavers,
          color: "text-red-600",
          icon: UserMinus,
        },
        {
          label: t("reports.monthly.moves"),
          value: report.counts.moves,
          color: "text-blue-600",
          icon: ArrowRightLeft,
        },
        {
          label: t("reports.monthly.roleChanges"),
          value: report.counts.roleChanges,
          color: "text-purple-600",
          icon: Edit,
        },
        {
          label: t("reports.monthly.openedPositions"),
          value: report.counts.openedPositions,
          color: "text-amber-600",
          icon: Briefcase,
        },
        {
          label: t("reports.monthly.closedPositions"),
          value: report.counts.closedPositions,
          color: "text-foreground",
          icon: Briefcase,
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      {selectedOrgId && <ScheduleCard orgId={selectedOrgId} />}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              {t("reports.monthly.preset")}
            </label>
            <Select
              value={preset}
              onValueChange={(v) => handlePreset(v as Preset)}
            >
              <SelectTrigger
                className="h-9 w-[180px]"
                data-testid="select-report-preset"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thisMonth">
                  {t("reports.monthly.presets.thisMonth")}
                </SelectItem>
                <SelectItem value="lastMonth">
                  {t("reports.monthly.presets.lastMonth")}
                </SelectItem>
                <SelectItem value="lastQuarter">
                  {t("reports.monthly.presets.lastQuarter")}
                </SelectItem>
                <SelectItem value="custom">
                  {t("reports.monthly.presets.custom")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              {t("reports.monthly.from")}
            </label>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setPreset("custom");
                setFrom(e.target.value);
              }}
              className="h-9 w-[160px]"
              data-testid="input-report-from"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              {t("reports.monthly.to")}
            </label>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setPreset("custom");
                setTo(e.target.value);
              }}
              className="h-9 w-[160px]"
              data-testid="input-report-to"
            />
          </div>

          <Button
            onClick={downloadPDF}
            disabled={isDownloading || !report || !from || !to}
            className="ms-auto"
            data-testid="button-generate-pdf"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            {t("reports.monthly.generatePdf")}
          </Button>
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      {isLoading || !report ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {counters.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.label}
                  className="bg-card border border-border rounded-xl p-4 shadow-sm"
                  data-testid={`counter-${c.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      {c.label}
                    </span>
                    <Icon className={`h-4 w-4 ${c.color}`} />
                  </div>
                  <div className={`text-3xl font-bold mt-2 ${c.color}`}>
                    {c.value}
                  </div>
                </div>
              );
            })}
          </div>

          <ReportTable
            title={t("reports.monthly.joiners")}
            empty={t("reports.monthly.noJoiners")}
            cols={[
              t("reports.monthly.col.name"),
              t("reports.monthly.col.title"),
              t("reports.monthly.col.department"),
              t("reports.monthly.col.date"),
            ]}
            rows={report.joiners.map((j) => [
              j.name,
              j.title,
              j.department,
              j.date,
            ])}
            testId="table-joiners"
          />

          <ReportTable
            title={t("reports.monthly.leavers")}
            empty={t("reports.monthly.noLeavers")}
            cols={[
              t("reports.monthly.col.name"),
              t("reports.monthly.col.title"),
              t("reports.monthly.col.department"),
              t("reports.monthly.col.date"),
            ]}
            rows={report.leavers.map((j) => [
              j.name,
              j.title,
              j.department,
              j.date,
            ])}
            testId="table-leavers"
          />

          <ReportTable
            title={t("reports.monthly.moves")}
            empty={t("reports.monthly.noMoves")}
            cols={[
              t("reports.monthly.col.name"),
              t("reports.monthly.col.kind"),
              t("reports.monthly.col.from"),
              t("reports.monthly.col.to"),
              t("reports.monthly.col.date"),
            ]}
            rows={report.moves.map((m) => {
              const isManager = m.kind === "manager";
              return [
                m.name,
                isManager
                  ? t("reports.monthly.kind.manager")
                  : t("reports.monthly.kind.department"),
                isManager ? (m.fromManager ?? "") : (m.fromDepartment ?? ""),
                isManager ? (m.toManager ?? "") : (m.toDepartment ?? ""),
                m.date,
              ];
            })}
            testId="table-moves"
          />

          {report.roleChanges.length > 0 && (
            <ReportTable
              title={t("reports.monthly.roleChanges")}
              empty={t("reports.monthly.noRoles")}
              cols={[
                t("reports.monthly.col.name"),
                t("reports.monthly.col.from"),
                t("reports.monthly.col.to"),
                t("reports.monthly.col.date"),
              ]}
              rows={report.roleChanges.map((m) => [
                m.name,
                m.fromTitle ?? "",
                m.toTitle ?? "",
                m.date,
              ])}
              testId="table-role-changes"
            />
          )}

          <div
            className="bg-card border border-border rounded-xl shadow-sm"
            data-testid="table-open-positions"
          >
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">
                {t("reports.monthly.openPositions")}
              </h3>
              <Badge variant="secondary" className="ms-auto">
                {report.openPositions.length}
              </Badge>
            </div>
            {report.openPositions.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {t("reports.monthly.noOpen")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("reports.monthly.col.title")}</TableHead>
                    <TableHead>{t("reports.monthly.col.department")}</TableHead>
                    <TableHead>{t("reports.monthly.col.openSince")}</TableHead>
                    <TableHead>{t("reports.monthly.col.age")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.openPositions.map((op) => (
                    <TableRow key={op.employeeId}>
                      <TableCell>{op.title}</TableCell>
                      <TableCell>{op.department}</TableCell>
                      <TableCell>{op.openSince}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${urgencyClasses[op.urgency]}`}
                        >
                          {op.ageDays} {t("reports.monthly.days")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ReportTable({
  title,
  empty,
  cols,
  rows,
  testId,
}: {
  title: string;
  empty: string;
  cols: string[];
  rows: string[][];
  testId: string;
}) {
  return (
    <div
      className="bg-card border border-border rounded-xl shadow-sm"
      data-testid={testId}
    >
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c) => (
                <TableHead key={c}>{c}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                {r.map((v, j) => (
                  <TableCell key={j}>{v || "—"}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ActivityLogPanel() {
  const { selectedOrgId } = useOrg();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: activity, isLoading } = useGetRecentActivity(
    selectedOrgId!,
    undefined,
    {
      query: {
        enabled: !!selectedOrgId,
        queryKey: getGetRecentActivityQueryKey(selectedOrgId!),
      },
    },
  );

  const filteredActivity = useMemo(() => {
    if (!activity) return [];
    let list = [...activity];
    if (typeFilter !== "all") list = list.filter((a) => a.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.description?.toLowerCase().includes(q) ||
          a.employeeName?.toLowerCase().includes(q) ||
          a.type?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [activity, search, typeFilter]);

  const activityTypes = useMemo(() => {
    if (!activity) return [];
    return Array.from(new Set(activity.map((a) => a.type)));
  }, [activity]);

  const formatDateTime = (d: string) =>
    new Date(d).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("reports.searchPlaceholder")}
            className="ps-9 h-9"
            data-testid="search-activity"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("reports.allTypes")}</SelectItem>
              {activityTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : filteredActivity.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ClipboardList className="h-12 w-12 opacity-20 mb-4" />
          <p className="text-lg font-medium">
            {activity?.length === 0 ? t("reports.noActivity") : t("reports.noMatch")}
          </p>
          <p className="text-sm mt-1">
            {activity?.length === 0
              ? t("reports.noActivityDesc")
              : t("reports.tryAdjusting")}
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[calc(100vh-340px)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>{t("reports.action")}</TableHead>
                <TableHead>{t("reports.description")}</TableHead>
                <TableHead>{t("reports.employee")}</TableHead>
                <TableHead>{t("reports.dateTime")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredActivity.map((entry) => {
                const IconComp = typeIcons[entry.type] || ClipboardList;
                const colorClass =
                  typeColors[entry.type] ||
                  "bg-gray-100 text-gray-700 border-gray-200";
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center ${colorClass}`}
                      >
                        <IconComp className="h-3.5 w-3.5" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${colorClass}`}>
                        {entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">
                        {entry.description}
                      </span>
                    </TableCell>
                    <TableCell>
                      {entry.employeeName ? (
                        <span className="text-sm font-medium">
                          {entry.employeeName}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateTime(entry.timestamp)}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
}

interface CoverageRow {
  employeeId: number;
  firstName: string;
  lastName: string;
  title: string;
  isCriticalRole: boolean;
  successorCount: number;
  successors: Array<{
    successorEmployeeId: number;
    successorFirstName: string;
    successorLastName: string;
    readiness: "ready_now" | "1_year" | "2_years";
  }>;
}

function SuccessionCoveragePanel() {
  const { selectedOrgId } = useOrg();
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canView = hasPermission("audit", "view");
  const [rows, setRows] = useState<CoverageRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!selectedOrgId || !canView) return;
    setIsLoading(true);
    setError(null);
    fetch(
      `${API_BASE}/organizations/${selectedOrgId}/reports/succession-coverage`,
      { credentials: "include" },
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: CoverageRow[]) => setRows(d || []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [selectedOrgId, canView]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (criticalOnly && !r.isCriticalRole) return false;
      if (!q) return true;
      const hay = `${r.firstName} ${r.lastName} ${r.title}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, criticalOnly, search]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const covered = filtered.filter((r) => r.successorCount > 0).length;
    return { total, covered, missing: total - covered };
  }, [filtered]);

  const downloadCsv = async () => {
    if (!selectedOrgId) return;
    try {
      const res = await fetch(
        `${API_BASE}/organizations/${selectedOrgId}/reports/succession-coverage.csv`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `succession-coverage-${selectedOrgId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!canView) {
    return (
      <div className="p-8 text-muted-foreground">{t("succession.noPermission")}</div>
    );
  }

  const readinessLabel = (r: "ready_now" | "1_year" | "2_years") =>
    t(`succession.readinessOpts.${r}`);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("reports.searchPlaceholder")}
            className="h-9 w-[260px]"
            data-testid="input-succession-search"
          />
          <label className="inline-flex items-center gap-2 text-sm">
            <Switch
              checked={criticalOnly}
              onCheckedChange={setCriticalOnly}
              data-testid="switch-critical-only"
            />
            <span>{t("succession.criticalOnly")}</span>
          </label>
          <div className="ms-auto flex items-center gap-3">
            <Badge variant="secondary">
              {t("succession.covered")}: {stats.covered}/{stats.total}
            </Badge>
            <Button
              onClick={downloadCsv}
              disabled={!rows}
              data-testid="button-download-succession-csv"
            >
              <FileDown className="h-4 w-4" />
              {t("succession.downloadCsv")}
            </Button>
          </div>
        </div>
        {error && (
          <div className="mt-3 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8">
            <Skeleton className="h-32 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {t("succession.noData")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("succession.employee")}</TableHead>
                <TableHead>{t("succession.role")}</TableHead>
                <TableHead>{t("succession.coverage")}</TableHead>
                <TableHead>{t("succession.successorsCol")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow
                  key={row.employeeId}
                  data-testid={`row-coverage-${row.employeeId}`}
                >
                  <TableCell className="font-medium">
                    {row.firstName} {row.lastName}
                    {row.isCriticalRole && (
                      <Badge
                        variant="outline"
                        className="ms-2 border-amber-500/40 text-amber-700 dark:text-amber-400"
                      >
                        {t("succession.criticalRole")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.title}
                  </TableCell>
                  <TableCell>
                    {row.successorCount > 0 ? (
                      <Badge variant="secondary">
                        {row.successorCount}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 text-amber-700 dark:text-amber-400"
                      >
                        {t("succession.notCovered")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.successors.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {row.successors.map((s) => (
                          <li key={s.successorEmployeeId}>
                            {s.successorFirstName} {s.successorLastName}{" "}
                            <span className="text-muted-foreground">
                              — {readinessLabel(s.readiness)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { selectedOrgId } = useOrg();
  const { t } = useTranslation();
  const { data: activity } = useGetRecentActivity(
    selectedOrgId ?? 0,
    undefined,
    {
      query: {
        enabled: !!selectedOrgId,
        queryKey: getGetRecentActivityQueryKey(selectedOrgId ?? 0),
      },
    },
  );

  if (!selectedOrgId) {
    return (
      <div className="p-8 text-muted-foreground">{t("common.selectOrg")}</div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold text-foreground"
              data-testid="text-page-title"
            >
              {t("reports.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("reports.subtitle")}
            </p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Activity className="h-3.5 w-3.5" />
            {t("reports.totalEntries", { count: activity?.length ?? 0 })}
          </Badge>
        </div>
      </div>

      <div className="p-6">
        <Tabs defaultValue="monthly">
          <TabsList>
            <TabsTrigger value="monthly" data-testid="tab-monthly-report">
              {t("reports.monthly.tabTitle")}
            </TabsTrigger>
            <TabsTrigger value="succession" data-testid="tab-succession-coverage">
              {t("succession.coverageTabTitle")}
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity-log">
              {t("reports.activityTabTitle")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="monthly" className="mt-4">
            <MonthlyReportPanel />
          </TabsContent>
          <TabsContent value="succession" className="mt-4">
            <SuccessionCoveragePanel />
          </TabsContent>
          <TabsContent value="activity" className="mt-4">
            <ActivityLogPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
