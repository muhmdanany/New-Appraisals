import { useMemo, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import {
  useGetEmployeeTimeline,
  getGetEmployeeTimelineQueryKey,
  useListEmployees,
  getListEmployeesQueryKey,
  useCreateEmployeeTimelineNote,
  useUpdateEmployeeTimelineNote,
  useDeleteEmployeeTimelineNote,
  type EmployeeTimelineEntry,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Download,
  Filter,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  UserCircle,
  X,
} from "lucide-react";

const ACTIONS = ["created", "updated", "deleted", "moved", "note"] as const;

const actionColors: Record<string, string> = {
  created: "bg-green-100 text-green-700 border-green-200",
  updated: "bg-blue-100 text-blue-700 border-blue-200",
  deleted: "bg-red-100 text-red-700 border-red-200",
  moved: "bg-amber-100 text-amber-700 border-amber-200",
  note: "bg-purple-100 text-purple-700 border-purple-200",
};

const actionDotColors: Record<string, string> = {
  created: "bg-green-500",
  updated: "bg-blue-500",
  deleted: "bg-red-500",
  moved: "bg-amber-500",
  note: "bg-purple-500",
};

type NoteFormState = {
  open: boolean;
  noteId: number | null;
  body: string;
  date: string;
  category: string;
};

const emptyForm = (): NoteFormState => ({
  open: false,
  noteId: null,
  body: "",
  date: new Date().toISOString().slice(0, 10),
  category: "",
});

export default function EmployeeTimelinePage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/employees/:id/timeline");
  const employeeId = params ? parseInt(params.id, 10) : NaN;
  const { selectedOrgId } = useOrg();
  const { hasPermission, user } = useAuth();
  const canView = hasPermission("employees", "view");
  const canEditNotes = hasPermission("employees", "edit");
  const isAdmin = hasPermission("employees", "delete");
  const queryClient = useQueryClient();

  const [action, setAction] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [noteForm, setNoteForm] = useState<NoteFormState>(emptyForm());
  const [noteError, setNoteError] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const p: { action?: string; dateFrom?: string; dateTo?: string } = {};
    if (action !== "all") p.action = action;
    if (dateFrom) p.dateFrom = new Date(dateFrom).toISOString();
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      p.dateTo = end.toISOString();
    }
    return p;
  }, [action, dateFrom, dateTo]);

  const enabled = !!selectedOrgId && Number.isFinite(employeeId) && canView;

  const timelineKey = useMemo(
    () =>
      enabled
        ? getGetEmployeeTimelineQueryKey(
            selectedOrgId!,
            employeeId,
            queryParams,
          )
        : [],
    [enabled, selectedOrgId, employeeId, queryParams],
  );

  const { data, isLoading, error } = useGetEmployeeTimeline(
    selectedOrgId!,
    employeeId,
    queryParams,
    {
      query: {
        enabled,
        queryKey: timelineKey,
      },
    },
  );

  const { data: employees } = useListEmployees(
    selectedOrgId!,
    {},
    {
      query: {
        enabled: !!selectedOrgId,
        queryKey: getListEmployeesQueryKey(selectedOrgId!, {}),
      },
    },
  );

  const employee = useMemo(
    () => employees?.find((e) => e.id === employeeId) ?? null,
    [employees, employeeId],
  );

  const invalidateTimeline = () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/organizations", selectedOrgId, "employees", employeeId, "timeline"],
      exact: false,
    });
    // Also refetch active key to be safe.
    if (timelineKey.length) {
      queryClient.invalidateQueries({ queryKey: timelineKey });
    }
  };

  const createNote = useCreateEmployeeTimelineNote({
    mutation: {
      onSuccess: () => invalidateTimeline(),
    },
  });
  const updateNote = useUpdateEmployeeTimelineNote({
    mutation: {
      onSuccess: () => invalidateTimeline(),
    },
  });
  const deleteNote = useDeleteEmployeeTimelineNote({
    mutation: {
      onSuccess: () => invalidateTimeline(),
    },
  });

  const formatDateTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(i18n.language, {
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

  const openAddNote = () => {
    setNoteError(null);
    setNoteForm({ ...emptyForm(), open: true });
  };

  const openEditNote = (entry: EmployeeTimelineEntry) => {
    const d = (entry.details || {}) as Record<string, unknown>;
    const noteId =
      typeof d.noteId === "number" ? d.noteId : Math.abs(entry.id);
    setNoteError(null);
    setNoteForm({
      open: true,
      noteId,
      body: typeof d.body === "string" ? d.body : "",
      date: entry.createdAt.slice(0, 10),
      category: typeof d.category === "string" ? d.category : "",
    });
  };

  const closeNoteForm = () => {
    setNoteForm(emptyForm());
    setNoteError(null);
  };

  const submitNote = async () => {
    const body = noteForm.body.trim();
    if (!body) {
      setNoteError(t("timeline.notes.bodyRequired"));
      return;
    }
    setNoteError(null);
    const noteDate = new Date(noteForm.date);
    if (isNaN(noteDate.getTime())) {
      noteDate.setTime(Date.now());
    }
    const payload = {
      body,
      noteDate: noteDate.toISOString(),
      category: noteForm.category.trim(),
    };
    try {
      if (noteForm.noteId == null) {
        await createNote.mutateAsync({
          orgId: selectedOrgId!,
          id: employeeId,
          data: payload,
        });
      } else {
        await updateNote.mutateAsync({
          orgId: selectedOrgId!,
          id: employeeId,
          noteId: noteForm.noteId,
          data: payload,
        });
      }
      closeNoteForm();
    } catch (err) {
      setNoteError(
        err instanceof Error ? err.message : t("timeline.notes.saveError"),
      );
    }
  };

  const handleDeleteNote = async (entry: EmployeeTimelineEntry) => {
    const d = (entry.details || {}) as Record<string, unknown>;
    const noteId = typeof d.noteId === "number" ? d.noteId : Math.abs(entry.id);
    if (!window.confirm(t("timeline.notes.deleteConfirm"))) return;
    try {
      await deleteNote.mutateAsync({
        orgId: selectedOrgId!,
        id: employeeId,
        noteId,
      });
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : t("timeline.notes.deleteError"),
      );
    }
  };

  const noteCanModify = (entry: EmployeeTimelineEntry): boolean => {
    if (entry.action !== "note") return false;
    if (isAdmin) return true;
    const d = (entry.details || {}) as Record<string, unknown>;
    const authorId =
      typeof d.authorUserId === "number"
        ? d.authorUserId
        : typeof entry.userId === "number"
          ? entry.userId
          : null;
    return user != null && authorId === user.id;
  };

  const renderDetails = (entry: EmployeeTimelineEntry) => {
    const d = entry.details || {};

    if (entry.action === "note") {
      const body = typeof d.body === "string" ? d.body : "";
      const category = typeof d.category === "string" ? d.category : "";
      return (
        <div className="space-y-1.5">
          {category && (
            <Badge
              variant="outline"
              className="text-[11px] bg-purple-50 text-purple-700 border-purple-200"
            >
              {category}
            </Badge>
          )}
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {body || t("timeline.noDetails")}
          </p>
        </div>
      );
    }

    const name = d.name ? String(d.name) : "";

    if (
      entry.action === "updated" &&
      d.changed &&
      typeof d.changed === "object"
    ) {
      const changed = d.changed as Record<string, unknown>;
      const keys = Object.keys(changed);
      if (keys.length === 0) {
        return (
          <p className="text-sm text-muted-foreground">
            {name || t("timeline.noDetails")}
          </p>
        );
      }
      return (
        <div className="space-y-1.5">
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
              <div
                key={k}
                className="flex items-center gap-1.5 text-xs flex-wrap"
              >
                <span className="font-medium text-muted-foreground">
                  {t(`timeline.fields.${k}`, { defaultValue: k })}:
                </span>
                {from !== undefined && (
                  <>
                    <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 line-through max-w-[220px] truncate">
                      {formatValue(from)}
                    </span>
                    <span className="text-muted-foreground">→</span>
                  </>
                )}
                <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 max-w-[220px] truncate">
                  {formatValue(to)}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    if (entry.action === "moved") {
      const parts: string[] = [];
      if ("managerId" in d)
        parts.push(`${t("timeline.fields.managerId")}: ${formatValue(d.managerId)}`);
      if ("departmentId" in d)
        parts.push(
          `${t("timeline.fields.departmentId")}: ${formatValue(d.departmentId)}`,
        );
      if ("administrationId" in d)
        parts.push(
          `${t("timeline.fields.administrationId")}: ${formatValue(d.administrationId)}`,
        );
      return (
        <p className="text-sm text-foreground">
          {parts.length > 0 ? parts.join(" · ") : name || t("timeline.noDetails")}
        </p>
      );
    }

    return (
      <p className="text-sm text-foreground">
        {name || t("timeline.noDetails")}
      </p>
    );
  };

  const handleExportPdf = async () => {
    if (!data || !employee) return;
    setIsExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;
      const pageH = 297;
      const margin = 15;
      let y = margin;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text(t("timeline.pdfTitle"), margin, y);
      y += 8;

      pdf.setFontSize(13);
      pdf.text(`${employee.firstName} ${employee.lastName}`, margin, y);
      y += 6;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(`${employee.title} — ${employee.email}`, margin, y);
      y += 8;
      pdf.setDrawColor(220);
      pdf.line(margin, y, pageW - margin, y);
      y += 6;

      pdf.setFontSize(9);
      pdf.text(
        `${t("timeline.pdfGenerated")}: ${new Date().toLocaleString(i18n.language)}`,
        margin,
        y,
      );
      y += 8;

      pdf.setFontSize(11);
      const lineHeight = 5;
      const writeLine = (text: string, indent = 0, bold = false) => {
        if (y > pageH - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.setFont("helvetica", bold ? "bold" : "normal");
        const lines = pdf.splitTextToSize(text, pageW - margin * 2 - indent);
        for (const line of lines) {
          if (y > pageH - margin) {
            pdf.addPage();
            y = margin;
          }
          pdf.text(line, margin + indent, y);
          y += lineHeight;
        }
      };

      for (const entry of data.entries) {
        writeLine(
          `${formatDateTime(entry.createdAt)} — ${t(`timeline.actions.${entry.action}`, { defaultValue: entry.action })}`,
          0,
          true,
        );
        const who = entry.userName || t("timeline.system");
        writeLine(`${t("timeline.by")}: ${who}`, 4);
        const d = entry.details || {};
        if (entry.action === "note") {
          if (typeof d.category === "string" && d.category) {
            writeLine(`[${d.category}]`, 4);
          }
          if (typeof d.body === "string" && d.body) {
            writeLine(d.body, 4);
          }
        } else if (entry.action === "updated" && d.changed && typeof d.changed === "object") {
          const changed = d.changed as Record<string, unknown>;
          for (const k of Object.keys(changed)) {
            const v = changed[k] as { from?: unknown; to?: unknown } | unknown;
            const label = t(`timeline.fields.${k}`, { defaultValue: k });
            if (v && typeof v === "object" && ("from" in (v as object) || "to" in (v as object))) {
              const fv = (v as { from?: unknown }).from;
              const tv = (v as { to?: unknown }).to;
              writeLine(`${label}: ${formatValue(fv)} → ${formatValue(tv)}`, 4);
            } else {
              writeLine(`${label}: ${formatValue(v)}`, 4);
            }
          }
        } else if (entry.action === "moved") {
          for (const k of ["managerId", "departmentId", "administrationId"]) {
            if (k in d)
              writeLine(
                `${t(`timeline.fields.${k}`)}: ${formatValue((d as Record<string, unknown>)[k])}`,
                4,
              );
          }
        } else if (d.name) {
          writeLine(`${String(d.name)}`, 4);
        }
        y += 2;
      }

      pdf.save(`employee-${employee.id}-timeline.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  if (!selectedOrgId) {
    return <div className="p-8 text-muted-foreground">{t("common.selectOrg")}</div>;
  }

  if (!canView) {
    return <div className="p-8 text-muted-foreground">{t("settings.error")}</div>;
  }

  if (!Number.isFinite(employeeId)) {
    return <div className="p-8 text-muted-foreground">{t("timeline.invalidId")}</div>;
  }

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const isSavingNote = createNote.isPending || updateNote.isPending;

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <div className="p-6 pb-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/employees")}
              data-testid="button-back-employees"
            >
              <BackIcon className="h-4 w-4 me-1" />
              {t("timeline.backToEmployees")}
            </Button>
            <div>
              <h1
                className="text-2xl font-bold text-foreground"
                data-testid="text-page-title"
              >
                {t("timeline.title")}
              </h1>
              {employee ? (
                <p className="text-sm text-muted-foreground mt-1">
                  {employee.firstName} {employee.lastName} — {employee.title}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  {t("timeline.subtitle")}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEditNotes && (
              <Button
                variant="default"
                size="sm"
                onClick={openAddNote}
                disabled={noteForm.open}
                data-testid="button-add-note"
              >
                <Plus className="h-4 w-4 me-2" />
                {t("timeline.notes.add")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={isExporting || !data || data.entries.length === 0}
              data-testid="button-export-pdf"
            >
              <Download className="h-4 w-4 me-2" />
              {t("timeline.exportPdf")}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-card border border-border rounded-xl shadow-sm">
          <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger
                  className="h-9 w-[180px]"
                  data-testid="select-timeline-action"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("timeline.allActions")}</SelectItem>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {t(`timeline.actions.${a}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {t("timeline.dateFrom")}
              </span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 w-[150px]"
                data-testid="input-timeline-date-from"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {t("timeline.dateTo")}
              </span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 w-[150px]"
                data-testid="input-timeline-date-to"
              />
            </div>
          </div>

          {noteForm.open && (
            <div
              className="p-4 border-b border-border bg-muted/30 space-y-3"
              data-testid="note-form"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {noteForm.noteId == null
                    ? t("timeline.notes.addTitle")
                    : t("timeline.notes.editTitle")}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={closeNoteForm}
                  data-testid="button-close-note-form"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("timeline.notes.dateLabel")}
                  </label>
                  <Input
                    type="date"
                    value={noteForm.date}
                    onChange={(e) =>
                      setNoteForm((f) => ({ ...f, date: e.target.value }))
                    }
                    data-testid="input-note-date"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("timeline.notes.categoryLabel")}
                  </label>
                  <Input
                    value={noteForm.category}
                    onChange={(e) =>
                      setNoteForm((f) => ({ ...f, category: e.target.value }))
                    }
                    placeholder={t("timeline.notes.categoryPlaceholder")}
                    maxLength={64}
                    data-testid="input-note-category"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {t("timeline.notes.bodyLabel")}
                </label>
                <Textarea
                  value={noteForm.body}
                  onChange={(e) =>
                    setNoteForm((f) => ({ ...f, body: e.target.value }))
                  }
                  rows={4}
                  maxLength={5000}
                  placeholder={t("timeline.notes.bodyPlaceholder")}
                  data-testid="input-note-body"
                />
              </div>
              {noteError && (
                <p className="text-xs text-destructive" data-testid="note-error">
                  {noteError}
                </p>
              )}
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeNoteForm}
                  disabled={isSavingNote}
                  data-testid="button-cancel-note"
                >
                  {t("timeline.notes.cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={submitNote}
                  disabled={isSavingNote}
                  data-testid="button-save-note"
                >
                  {isSavingNote
                    ? t("timeline.notes.saving")
                    : t("timeline.notes.save")}
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-12 text-center text-sm text-destructive">
              {(error as Error).message}
            </div>
          ) : !data || data.entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Clock className="h-12 w-12 opacity-20 mb-4" />
              <p className="text-lg font-medium">{t("timeline.empty")}</p>
              <p className="text-sm mt-1">{t("timeline.emptyDesc")}</p>
            </div>
          ) : (
            <ol className="relative p-6">
              <span
                className="absolute top-6 bottom-6 w-px bg-border"
                style={{ [isRtl ? "right" : "left"]: "2.25rem" } as React.CSSProperties}
                aria-hidden
              />
              {data.entries.map((entry) => {
                const dot =
                  actionDotColors[entry.action] || "bg-gray-400";
                const badgeColor =
                  actionColors[entry.action] ||
                  "bg-gray-100 text-gray-700 border-gray-200";
                const isNote = entry.action === "note";
                const canModify = noteCanModify(entry);
                const key = isNote ? `note-${Math.abs(entry.id)}` : `audit-${entry.id}`;
                return (
                  <li
                    key={key}
                    className="relative ps-12 pb-8 last:pb-0"
                    data-testid={`timeline-entry-${entry.id}`}
                  >
                    <span
                      className={`absolute top-1 h-3 w-3 rounded-full ring-4 ring-background ${dot}`}
                      style={{ [isRtl ? "right" : "left"]: "1.85rem" } as React.CSSProperties}
                      aria-hidden
                    />
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-xs ${badgeColor} inline-flex items-center gap-1`}
                      >
                        {isNote && <StickyNote className="h-3 w-3" />}
                        {t(`timeline.actions.${entry.action}`, {
                          defaultValue: entry.action,
                        })}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <UserCircle className="h-3 w-3" />
                        {entry.userName || t("timeline.system")}
                      </span>
                      {isNote && canModify && (
                        <div className="flex items-center gap-1 ms-auto">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => openEditNote(entry)}
                            data-testid={`button-edit-note-${Math.abs(entry.id)}`}
                            title={t("timeline.notes.edit")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteNote(entry)}
                            data-testid={`button-delete-note-${Math.abs(entry.id)}`}
                            title={t("timeline.notes.delete")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {renderDetails(entry)}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
