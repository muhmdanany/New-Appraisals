import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListLeaves,
  useCreateLeave,
  useUpdateLeave,
  useDeleteLeave,
  useListEmployees,
  useListDepartments,
  getListLeavesQueryKey,
  getListEmployeesQueryKey,
  getListDepartmentsQueryKey,
  type EmployeeLeave,
} from "@workspace/api-client-react";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarOff, ChevronLeft, ChevronRight, Plus, Trash2, Pencil } from "lucide-react";

type ViewMode = "month" | "week";

const TYPE_COLORS: Record<string, string> = {
  vacation: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  sick: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  remote: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  other: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

function fmtISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setDate(d.getDate() - d.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function LeavePage() {
  const { t, i18n } = useTranslation();
  const { selectedOrgId } = useOrg();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isRTL = i18n.language?.startsWith("ar");

  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [editing, setEditing] = useState<EmployeeLeave | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  const orgId = selectedOrgId ?? 0;
  const canView = hasPermission("leaves", "view");
  // Managers don't hold global leaves:create/edit/delete, but the server
  // grants them those actions for their direct/indirect reports. We
  // surface the UI affordances to anyone who can edit at least one
  // employee (managers + editors + admins) and let the server enforce
  // the per-target scope on submit.
  const canManageEmployees = hasPermission("employees", "edit");
  const canCreate = hasPermission("leaves", "create") || canManageEmployees;
  const canEdit = hasPermission("leaves", "edit") || canManageEmployees;
  const canDelete = hasPermission("leaves", "delete") || canManageEmployees;

  const range = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(anchor);
      return { start, end: addDays(start, 6), days: 7 };
    }
    const monthStart = startOfMonth(anchor);
    const gridStart = startOfWeek(monthStart);
    const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const gridEndCandidate = addDays(startOfWeek(monthEnd), 6);
    const days = Math.round((+gridEndCandidate - +gridStart) / 86400000) + 1;
    return { start: gridStart, end: gridEndCandidate, days };
  }, [anchor, view]);

  const leavesParams = {
    from: fmtISO(range.start),
    to: fmtISO(range.end),
    ...(departmentId !== "all" ? { departmentId: Number(departmentId) } : {}),
  };
  const { data: leaves, isLoading } = useListLeaves(
    orgId,
    leavesParams,
    {
      query: {
        enabled: !!orgId && canView,
        queryKey: getListLeavesQueryKey(orgId, leavesParams),
      },
    },
  );

  const { data: departments } = useListDepartments(orgId, {
    query: { enabled: !!orgId, queryKey: getListDepartmentsQueryKey(orgId) },
  });
  const { data: employees } = useListEmployees(orgId, undefined, {
    query: {
      enabled: !!orgId && (canCreate || canEdit),
      queryKey: getListEmployeesQueryKey(orgId),
    },
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/leaves`] });

  const errorMessage = (e: unknown): string => {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    if (e && typeof e === "object" && "message" in e) {
      const m = (e as { message?: unknown }).message;
      if (typeof m === "string") return m;
    }
    return "Request failed";
  };

  const createMut = useCreateLeave({
    mutation: {
      onSuccess: () => {
        invalidate();
        setCreating(false);
        toast({ title: t("leave.addLeave"), description: "✓" });
      },
      onError: (e) =>
        toast({ title: t("leave.addLeave"), description: errorMessage(e), variant: "destructive" }),
    },
  });
  const updateMut = useUpdateLeave({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEditing(null);
        toast({ title: t("leave.editLeave"), description: "✓" });
      },
      onError: (e) =>
        toast({ title: t("leave.editLeave"), description: errorMessage(e), variant: "destructive" }),
    },
  });
  const deleteMut = useDeleteLeave({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("leave.deleteLeave"), description: "✓" });
      },
      onError: (e) =>
        toast({ title: t("leave.deleteLeave"), description: errorMessage(e), variant: "destructive" }),
    },
  });

  if (!canView) {
    return (
      <div className="p-8 text-center text-muted-foreground" data-testid="leave-no-permission">
        {t("leave.noPermission")}
      </div>
    );
  }

  const days: Date[] = Array.from({ length: range.days }, (_, i) => addDays(range.start, i));
  const leavesByDay = new Map<string, EmployeeLeave[]>();
  for (const day of days) leavesByDay.set(fmtISO(day), []);
  for (const lv of leaves ?? []) {
    const f = new Date(lv.fromDate);
    const tEnd = new Date(lv.toDate);
    for (const day of days) {
      if (day >= new Date(f.getFullYear(), f.getMonth(), f.getDate()) &&
          day <= new Date(tEnd.getFullYear(), tEnd.getMonth(), tEnd.getDate())) {
        leavesByDay.get(fmtISO(day))!.push(lv);
      }
    }
  }

  const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

  const navigate = (delta: number) => {
    if (view === "week") setAnchor(addDays(anchor, delta * 7));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1));
  };

  const headerLabel = useMemo(() => {
    if (view === "week") {
      const a = startOfWeek(anchor);
      return `${a.toLocaleDateString(i18n.language, { month: "short", day: "numeric" })} – ${addDays(a, 6).toLocaleDateString(i18n.language, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return anchor.toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
  }, [anchor, view, i18n.language]);

  const today = new Date();

  return (
    <div className="p-4 md:p-6 space-y-4" dir={isRTL ? "rtl" : "ltr"} data-testid="leave-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarOff className="h-6 w-6" /> {t("leave.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("leave.subtitle")}</p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreating(true)} data-testid="button-add-leave">
            <Plus className="h-4 w-4 me-1" />
            {t("leave.addLeave")}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border overflow-hidden">
          <Button
            size="sm"
            variant={view === "month" ? "default" : "ghost"}
            className="rounded-none"
            onClick={() => setView("month")}
            data-testid="button-view-month"
          >
            {t("leave.monthView")}
          </Button>
          <Button
            size="sm"
            variant={view === "week" ? "default" : "ghost"}
            className="rounded-none"
            onClick={() => setView("week")}
            data-testid="button-view-week"
          >
            {t("leave.weekView")}
          </Button>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate(-1)} data-testid="button-prev">
          {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAnchor(new Date())} data-testid="button-today">
          {t("leave.today")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate(1)} data-testid="button-next">
          {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <div className="text-sm font-medium ms-2" data-testid="text-range-label">{headerLabel}</div>
        <div className="ms-auto">
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-[200px]" data-testid="select-department">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("leave.allDepartments")}</SelectItem>
              {(departments ?? []).map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground">
        {weekdayKeys.map((k) => (
          <div key={k} className="text-center py-1">{t(`leave.weekdays.${k}`)}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" data-testid="leave-grid">
        {days.map((day) => {
          const inMonth = view === "week" || day.getMonth() === anchor.getMonth();
          const iso = fmtISO(day);
          const dayLeaves = leavesByDay.get(iso) ?? [];
          const isToday = sameDay(day, today);
          return (
            <div
              key={iso}
              className={`min-h-[110px] rounded-md border p-1.5 flex flex-col gap-1 ${inMonth ? "bg-card" : "bg-muted/30 opacity-60"} ${isToday ? "ring-2 ring-primary" : ""}`}
              data-testid={`day-cell-${iso}`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className={isToday ? "font-bold text-primary" : ""}>{day.getDate()}</span>
                {dayLeaves.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1 text-[10px]">{dayLeaves.length}</Badge>
                )}
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayLeaves.slice(0, 3).map((lv) => (
                  <Tooltip key={lv.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => canEdit && setEditing(lv)}
                        className={`text-[10px] truncate text-start rounded border px-1 py-0.5 ${TYPE_COLORS[lv.type] ?? TYPE_COLORS.other} ${canEdit ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                        data-testid={`leave-pill-${lv.id}`}
                      >
                        {lv.employeeName}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs font-medium">{lv.employeeName}</div>
                      <div className="text-xs opacity-90">{t(`leave.types.${lv.type}`)}</div>
                      <div className="text-xs opacity-90">{t("leave.dateRange", { from: lv.fromDate, to: lv.toDate })}</div>
                      {lv.note && <div className="text-xs opacity-80 mt-1 max-w-[220px] whitespace-pre-wrap">{lv.note}</div>}
                    </TooltipContent>
                  </Tooltip>
                ))}
                {dayLeaves.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">+{dayLeaves.length - 3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && (leaves?.length ?? 0) === 0 && (
        <div className="text-center text-sm text-muted-foreground py-6" data-testid="leave-empty">
          {t("leave.empty")}
        </div>
      )}

      {(creating || editing) && (
        <LeaveDialog
          orgId={orgId}
          existing={editing}
          employees={(employees ?? []).map((e) => ({
            id: e.id,
            name: `${e.firstName} ${e.lastName}`,
          }))}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={(data) => {
            if (editing) {
              updateMut.mutate({
                orgId,
                id: editing.id,
                data: {
                  type: data.type,
                  fromDate: data.fromDate,
                  toDate: data.toDate,
                  note: data.note,
                },
              });
            } else {
              createMut.mutate({ orgId, data });
            }
          }}
          onDelete={
            editing && canDelete
              ? () => {
                  if (confirm(t("leave.confirmDelete"))) {
                    deleteMut.mutate(
                      { orgId, id: editing.id },
                      { onSuccess: () => setEditing(null) },
                    );
                  }
                }
              : undefined
          }
          submitting={createMut.isPending || updateMut.isPending}
        />
      )}
    </div>
  );
}

function LeaveDialog({
  existing,
  employees,
  onClose,
  onSubmit,
  onDelete,
  submitting,
}: {
  orgId: number;
  existing: EmployeeLeave | null;
  employees: { id: number; name: string }[];
  onClose: () => void;
  onSubmit: (data: { employeeId: number; type: string; fromDate: string; toDate: string; note: string | null }) => void;
  onDelete?: () => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const [employeeId, setEmployeeId] = useState<string>(
    existing ? String(existing.employeeId) : "",
  );
  const [type, setType] = useState<string>(existing?.type ?? "vacation");
  const [fromDate, setFromDate] = useState<string>(existing?.fromDate ?? fmtISO(new Date()));
  const [toDate, setToDate] = useState<string>(existing?.toDate ?? fmtISO(new Date()));
  const [note, setNote] = useState<string>(existing?.note ?? "");

  const canSubmit = !!employeeId && !!fromDate && !!toDate && fromDate <= toDate;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="dialog-leave">
        <DialogHeader>
          <DialogTitle>{existing ? t("leave.editLeave") : t("leave.addLeave")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">{t("leave.employee")}</label>
            <Select value={employeeId} onValueChange={setEmployeeId} disabled={!!existing}>
              <SelectTrigger data-testid="select-employee">
                <SelectValue placeholder={t("leave.employee")} />
              </SelectTrigger>
              <SelectContent>
                {existing && (
                  <SelectItem value={String(existing.employeeId)}>{existing.employeeName}</SelectItem>
                )}
                {!existing &&
                  employees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">{t("leave.type")}</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["vacation", "sick", "remote", "other"] as const).map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`leave.types.${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">{t("leave.fromDate")}</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} data-testid="input-from-date" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("leave.toDate")}</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} data-testid="input-to-date" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">{t("leave.note")}</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("leave.notePlaceholder") as string}
              data-testid="input-note"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {onDelete && (
            <Button variant="destructive" onClick={onDelete} className="me-auto" data-testid="button-delete-leave">
              <Trash2 className="h-4 w-4 me-1" />
              {t("leave.deleteLeave")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>{t("leave.cancel")}</Button>
          <Button
            disabled={!canSubmit || submitting}
            onClick={() =>
              onSubmit({
                employeeId: Number(employeeId),
                type,
                fromDate,
                toDate,
                note: note.trim() ? note : null,
              })
            }
            data-testid="button-save-leave"
          >
            <Pencil className="h-4 w-4 me-1" />
            {t("leave.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
