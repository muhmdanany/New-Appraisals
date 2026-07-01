import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOrg } from "@/lib/org-context";
import {
  useListEmployees,
  useListDepartments,
  useListAdministrations,
  useUpdateEmployee,
  useDeleteEmployee,
  getListEmployeesQueryKey,
  getGetOrgChartQueryKey,
  getGetOrgDashboardQueryKey,
  getGetRecentActivityQueryKey,
  getGetDepartmentStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Briefcase, Building2, Landmark, Trash2, UserCheck } from "lucide-react";
import { daysSinceOpened, openPositionUrgency } from "@/pages/org-chart";

interface FillForm {
  firstName: string;
  lastName: string;
  email: string;
}

export default function OpenPositions() {
  const { t } = useTranslation();
  const { selectedOrgId } = useOrg();
  const queryClient = useQueryClient();
  const [fillTarget, setFillTarget] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [fillForm, setFillForm] = useState<FillForm>({ firstName: "", lastName: "", email: "" });
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const posParam = params.get("positionId");
    if (posParam && /^\d+$/.test(posParam)) {
      setHighlightedId(parseInt(posParam, 10));
    }
  }, []);

  const { data: openPositions, isLoading } = useListEmployees(
    selectedOrgId!,
    { openOnly: true },
    {
      query: {
        enabled: !!selectedOrgId,
        queryKey: getListEmployeesQueryKey(selectedOrgId!, { openOnly: true }),
      },
    },
  );
  const { data: departments } = useListDepartments(selectedOrgId!, {
    query: { enabled: !!selectedOrgId, queryKey: ["departments", selectedOrgId] as const },
  });
  const { data: administrations } = useListAdministrations(selectedOrgId!, {
    query: { enabled: !!selectedOrgId, queryKey: ["administrations", selectedOrgId] as const },
  });

  const deptById = useMemo(() => new Map((departments ?? []).map((d) => [d.id, d])), [departments]);
  const adminById = useMemo(() => new Map((administrations ?? []).map((a) => [a.id, a])), [administrations]);

  const invalidateAll = () => {
    if (!selectedOrgId) return;
    queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey(selectedOrgId) });
    queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey(selectedOrgId, { openOnly: true }) });
    queryClient.invalidateQueries({ queryKey: getGetOrgChartQueryKey(selectedOrgId) });
    queryClient.invalidateQueries({ queryKey: getGetOrgDashboardQueryKey(selectedOrgId) });
    queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey(selectedOrgId) });
    queryClient.invalidateQueries({ queryKey: getGetDepartmentStatsQueryKey(selectedOrgId) });
  };

  const updateMutation = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setFillTarget(null);
        setFillForm({ firstName: "", lastName: "", email: "" });
      },
    },
  });

  const deleteMutation = useDeleteEmployee({
    mutation: { onSuccess: invalidateAll },
  });

  const handleFill = () => {
    if (!fillTarget || !fillForm.firstName.trim() || !fillForm.lastName.trim()) return;
    if (!selectedOrgId) return;
    updateMutation.mutate({
      orgId: selectedOrgId,
      id: fillTarget.id,
      data: {
        firstName: fillForm.firstName.trim(),
        lastName: fillForm.lastName.trim(),
        email: fillForm.email.trim(),
        isOpenPosition: false,
      },
    });
  };

  useEffect(() => {
    if (highlightedId == null || !openPositions) return undefined;
    const el = document.querySelector(`[data-testid="card-open-position-${highlightedId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlightedId(null), 3000);
    return () => clearTimeout(t);
  }, [highlightedId, openPositions]);

  const list = openPositions ?? [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-6 pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
              {t("openPositions.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("openPositions.subtitle")}</p>
          </div>
          <div className="text-sm text-muted-foreground" data-testid="text-open-position-count">
            {t("openPositions.count", { count: list.length })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">{t("openPositions.empty")}</p>
            <p className="text-sm mt-1">{t("openPositions.emptyDesc")}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => {
              const days = daysSinceOpened(p.openSinceDate);
              const urgency = openPositionUrgency(days);
              const dept = p.departmentId ? deptById.get(p.departmentId) : null;
              const admin = p.administrationId ? adminById.get(p.administrationId) : null;
              return (
                <div
                  key={p.id}
                  className={`bg-card border-2 border-dashed rounded-xl p-4 transition-shadow ${
                    urgency === "critical"
                      ? "border-destructive/60"
                      : urgency === "warning"
                        ? "border-amber-500/60"
                        : "border-muted-foreground/40"
                  } ${highlightedId === p.id ? "ring-2 ring-primary shadow-lg" : ""}`}
                  data-testid={`card-open-position-${p.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold flex-shrink-0">
                      ?
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground italic">
                        {t("orgChart.openPositions.openPosition")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {admin && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Landmark className="h-3 w-3" style={{ color: admin.color || undefined }} />
                        <span className="truncate">{admin.name}</span>
                      </div>
                    )}
                    {dept && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Building2 className="h-3 w-3" style={{ color: dept.color || undefined }} />
                        <span className="truncate">{dept.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                        urgency === "critical"
                          ? "bg-destructive/10 text-destructive border-destructive/30"
                          : urgency === "warning"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {t("orgChart.openPositions.openForDays", { count: days })}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-4 pt-3 border-t">
                    <Button
                      size="sm"
                      onClick={() => {
                        setFillTarget({ id: p.id, title: p.title });
                        setFillForm({ firstName: "", lastName: "", email: "" });
                      }}
                      data-testid={`button-fill-${p.id}`}
                    >
                      <UserCheck className="h-4 w-4 me-1" />
                      {t("orgChart.openPositions.fillPosition")}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="ms-auto" data-testid={`button-delete-${p.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("openPositions.confirmDelete")}</AlertDialogTitle>
                          <AlertDialogDescription>{t("openPositions.confirmDeleteDesc")}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("confirmDialog.cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => selectedOrgId && deleteMutation.mutate({ orgId: selectedOrgId, id: p.id })}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t("orgChart.deleteBtn")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!fillTarget} onOpenChange={(open) => { if (!open) setFillTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("orgChart.openPositions.fillPosition")} — {fillTarget?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("orgChart.firstName")}</Label>
                <Input
                  value={fillForm.firstName}
                  onChange={(e) => setFillForm((f) => ({ ...f, firstName: e.target.value }))}
                  data-testid="input-fill-first-name"
                />
              </div>
              <div>
                <Label>{t("orgChart.lastName")}</Label>
                <Input
                  value={fillForm.lastName}
                  onChange={(e) => setFillForm((f) => ({ ...f, lastName: e.target.value }))}
                  data-testid="input-fill-last-name"
                />
              </div>
            </div>
            <div>
              <Label>{t("orgChart.emailLabel")}</Label>
              <Input
                type="email"
                value={fillForm.email}
                onChange={(e) => setFillForm((f) => ({ ...f, email: e.target.value }))}
                data-testid="input-fill-email"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFillTarget(null)}>
                {t("orgChart.cancelBtn")}
              </Button>
              <Button
                onClick={handleFill}
                disabled={!fillForm.firstName.trim() || !fillForm.lastName.trim() || updateMutation.isPending}
                data-testid="button-confirm-fill"
              >
                {updateMutation.isPending ? t("orgChart.savingChanges") : t("openPositions.confirmFill")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
