import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Mail,
  Plus,
  Send,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  useListAnalyticsReportSubscriptions,
  useCreateAnalyticsReportSubscription,
  useUpdateAnalyticsReportSubscription,
  useDeleteAnalyticsReportSubscription,
  useSendAnalyticsReportSubscriptionNow,
  getListAnalyticsReportSubscriptionsQueryKey,
  type AnalyticsReportSubscription,
  type CreateAnalyticsReportSubscriptionBody,
  type UpdateAnalyticsReportSubscriptionBody,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface Props {
  orgId: number;
}

const WIDGETS = [
  "headcount",
  "span",
  "depth",
  "departments",
  "open-vs-filled",
  "growth",
  "attrition",
] as const;

const RANGES = [7, 30, 90, 180, 365] as const;
const CADENCES = ["weekly", "monthly"] as const;

interface FormState {
  name: string;
  widget: (typeof WIDGETS)[number];
  rangeDays: number;
  cadence: (typeof CADENCES)[number];
  recipients: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  widget: "headcount",
  rangeDays: 30,
  cadence: "weekly",
  recipients: "",
  active: true,
};

function formatDateTime(s?: string | null, locale = "en-US") {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

export function AnalyticsReportSubscriptionsButton({ orgId }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid="open-scheduled-reports"
      >
        <CalendarClock className="h-4 w-4 me-1.5" />
        {t("analytics.schedules.openButton")}
      </Button>
      <ReportSubscriptionsDialog orgId={orgId} open={open} onOpenChange={setOpen} />
    </>
  );
}

function ReportSubscriptionsDialog({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";

  const queryKey = getListAnalyticsReportSubscriptionsQueryKey(orgId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const { data: subs = [], isLoading } = useListAnalyticsReportSubscriptions(
    orgId,
    { query: { enabled: open, queryKey } },
  );

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<AnalyticsReportSubscription | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AnalyticsReportSubscription | null>(null);

  const createMutation = useCreateAnalyticsReportSubscription({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("analytics.schedules.createdToast") });
        resetForm();
      },
      onError: () => {
        toast({ variant: "destructive", title: t("analytics.schedules.saveFailed") });
      },
    },
  });

  const updateMutation = useUpdateAnalyticsReportSubscription({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("analytics.schedules.updatedToast") });
        resetForm();
      },
      onError: () => {
        toast({ variant: "destructive", title: t("analytics.schedules.saveFailed") });
      },
    },
  });

  const deleteMutation = useDeleteAnalyticsReportSubscription({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("analytics.schedules.deletedToast") });
        setPendingDelete(null);
      },
      onError: () => {
        toast({ variant: "destructive", title: t("analytics.schedules.deleteFailed") });
      },
    },
  });

  const sendNowMutation = useSendAnalyticsReportSubscriptionNow({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: t("analytics.schedules.sentToast") });
      },
      onError: () => {
        toast({ variant: "destructive", title: t("analytics.schedules.sendFailed") });
      },
    },
  });

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(false);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(sub: AnalyticsReportSubscription) {
    setEditing(sub);
    setForm({
      name: sub.name,
      widget: sub.widget,
      rangeDays: sub.rangeDays,
      cadence: sub.cadence,
      recipients: sub.recipients.join(", "),
      active: sub.active,
    });
    setShowForm(true);
  }

  function parseRecipients(s: string): string[] {
    return s
      .split(/[,;\n]/)
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
  }

  function handleSubmit() {
    const recipients = parseRecipients(form.recipients);
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: t("analytics.schedules.nameRequired") });
      return;
    }
    if (recipients.length === 0) {
      toast({ variant: "destructive", title: t("analytics.schedules.recipientsRequired") });
      return;
    }
    if (editing) {
      const data: UpdateAnalyticsReportSubscriptionBody = {
        name: form.name.trim(),
        widget: form.widget,
        rangeDays: form.rangeDays,
        cadence: form.cadence,
        recipients,
        active: form.active,
      };
      updateMutation.mutate({ orgId, id: editing.id, data });
    } else {
      const data: CreateAnalyticsReportSubscriptionBody = {
        name: form.name.trim(),
        widget: form.widget,
        rangeDays: form.rangeDays,
        cadence: form.cadence,
        recipients,
        active: form.active,
      };
      createMutation.mutate({ orgId, data });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="scheduled-reports-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            {t("analytics.schedules.title")}
          </DialogTitle>
          <DialogDescription>
            {t("analytics.schedules.description")}
          </DialogDescription>
        </DialogHeader>

        {!showForm && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={openCreate} data-testid="new-subscription-button">
                <Plus className="h-4 w-4 me-1.5" />
                {t("analytics.schedules.new")}
              </Button>
            </div>

            {isLoading ? (
              <div className="text-sm text-muted-foreground p-6 text-center">
                {t("common.loading", "Loading...")}
              </div>
            ) : subs.length === 0 ? (
              <div className="border border-dashed rounded-md p-8 text-center text-sm text-muted-foreground" data-testid="no-subscriptions">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {t("analytics.schedules.empty")}
              </div>
            ) : (
              <div className="space-y-2">
                {subs.map((sub) => (
                  <div
                    key={sub.id}
                    className="border rounded-md p-3 flex items-start gap-3"
                    data-testid={`subscription-${sub.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{sub.name}</span>
                        {!sub.active && (
                          <Badge variant="secondary" className="text-xs">
                            {t("analytics.schedules.paused")}
                          </Badge>
                        )}
                        {sub.lastStatus === "error" && (
                          <Badge variant="destructive" className="text-xs">
                            {t("analytics.schedules.lastError")}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <div>
                          {t(`analytics.schedules.widgets.${sub.widget}`)} ·{" "}
                          {t(`analytics.schedules.cadences.${sub.cadence}`)} ·{" "}
                          {t("analytics.schedules.lastNDays", { days: sub.rangeDays })}
                        </div>
                        <div className="truncate">
                          {t("analytics.schedules.toLabel")}: {sub.recipients.join(", ")}
                        </div>
                        <div>
                          {t("analytics.schedules.nextRun")}: {formatDateTime(sub.nextRunAt, locale)}
                          {sub.lastRunAt && (
                            <>
                              {" · "}
                              {t("analytics.schedules.lastRun")}: {formatDateTime(sub.lastRunAt, locale)}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title={t("analytics.schedules.sendNow")}
                        onClick={() => sendNowMutation.mutate({ orgId, id: sub.id })}
                        disabled={sendNowMutation.isPending}
                        data-testid={`send-now-${sub.id}`}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title={t("common.edit", "Edit")}
                        onClick={() => openEdit(sub)}
                        data-testid={`edit-subscription-${sub.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title={t("common.delete", "Delete")}
                        onClick={() => setPendingDelete(sub)}
                        data-testid={`delete-subscription-${sub.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showForm && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sub-name">{t("analytics.schedules.fields.name")}</Label>
              <Input
                id="sub-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("analytics.schedules.fields.namePlaceholder")}
                maxLength={100}
                data-testid="sub-name-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("analytics.schedules.fields.widget")}</Label>
                <Select
                  value={form.widget}
                  onValueChange={(v) => setForm((f) => ({ ...f, widget: v as FormState["widget"] }))}
                >
                  <SelectTrigger data-testid="sub-widget-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WIDGETS.map((w) => (
                      <SelectItem key={w} value={w}>{t(`analytics.schedules.widgets.${w}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("analytics.schedules.fields.cadence")}</Label>
                <Select
                  value={form.cadence}
                  onValueChange={(v) => setForm((f) => ({ ...f, cadence: v as FormState["cadence"] }))}
                >
                  <SelectTrigger data-testid="sub-cadence-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CADENCES.map((c) => (
                      <SelectItem key={c} value={c}>{t(`analytics.schedules.cadences.${c}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("analytics.schedules.fields.range")}</Label>
              <Select
                value={String(form.rangeDays)}
                onValueChange={(v) => setForm((f) => ({ ...f, rangeDays: Number(v) }))}
              >
                <SelectTrigger data-testid="sub-range-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RANGES.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {t("analytics.schedules.lastNDays", { days: d })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sub-recipients">{t("analytics.schedules.fields.recipients")}</Label>
              <Input
                id="sub-recipients"
                value={form.recipients}
                onChange={(e) => setForm((f) => ({ ...f, recipients: e.target.value }))}
                placeholder="alice@example.com, bob@example.com"
                data-testid="sub-recipients-input"
              />
              <p className="text-xs text-muted-foreground">
                {t("analytics.schedules.fields.recipientsHelp")}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="sub-active"
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
                data-testid="sub-active-switch"
              />
              <Label htmlFor="sub-active" className="cursor-pointer">
                {t("analytics.schedules.fields.active")}
              </Label>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={resetForm} data-testid="sub-cancel">
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="sub-save"
              >
                {editing ? t("common.save", "Save") : t("analytics.schedules.create")}
              </Button>
            </DialogFooter>
          </div>
        )}

        <AlertDialog open={pendingDelete != null} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
          <AlertDialogContent data-testid="subscription-delete-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("analytics.schedules.deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("analytics.schedules.deleteConfirm", { name: pendingDelete?.name ?? "" })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingDelete) {
                    deleteMutation.mutate({ orgId, id: pendingDelete.id });
                  }
                }}
                data-testid="confirm-delete-subscription"
              >
                {t("common.delete", "Delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
