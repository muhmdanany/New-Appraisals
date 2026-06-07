import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type InstanceSummary = {
  instanceId: number;
  employeeId: number;
  employeeName: string;
  employeeTitle: string;
  startedAt: string;
  deletedAt: string | null;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
};

type Task = {
  id: number;
  instanceId: number;
  employeeId: number;
  title: string;
  description: string;
  dueDate: string | null;
  assigneeUserId: number | null;
  assigneeName: string | null;
  status: "pending" | "done";
  displayOrder: number;
};

type Instance = {
  id: number;
  startedAt: string;
  employeeId: number;
  tasks: Task[];
};

export default function OffboardingPage() {
  const { t, i18n } = useTranslation();
  const { selectedOrgId } = useOrg();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [instances, setInstances] = useState<InstanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, Instance | "loading" | undefined>>({});

  const canEdit = hasPermission("employees", "edit");
  const canView = hasPermission("employees", "view");

  const load = useCallback(() => {
    if (!selectedOrgId) return;
    setLoading(true);
    fetch(`${API_BASE}/organizations/${selectedOrgId}/offboarding/instances`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) =>
        setInstances(Array.isArray(data?.instances) ? data.instances : []),
      )
      .catch(() => setInstances([]))
      .finally(() => setLoading(false));
  }, [selectedOrgId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadInstance = async (employeeId: number) => {
    if (!selectedOrgId) return;
    setExpanded((prev) => ({ ...prev, [employeeId]: "loading" }));
    try {
      const res = await fetch(
        `${API_BASE}/organizations/${selectedOrgId}/employees/${employeeId}/offboarding`,
        { credentials: "include" },
      );
      const data = await res.json();
      setExpanded((prev) => ({ ...prev, [employeeId]: data?.instance ?? undefined }));
    } catch {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[employeeId];
        return next;
      });
    }
  };

  const toggleExpanded = (employeeId: number) => {
    if (expanded[employeeId] !== undefined) {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[employeeId];
        return next;
      });
    } else {
      loadInstance(employeeId);
    }
  };

  const toggleTask = async (employeeId: number, task: Task) => {
    if (!selectedOrgId) return;
    const newStatus = task.status === "done" ? "pending" : "done";
    const res = await fetch(
      `${API_BASE}/organizations/${selectedOrgId}/offboarding/tasks/${task.id}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      },
    );
    if (res.ok) {
      // Refresh both the summary list and the expanded panel.
      load();
      loadInstance(employeeId);
    } else {
      toast({
        title: t("offboarding.errors.updateFailed"),
        variant: "destructive",
      });
    }
  };

  const dateLocale = i18n.language === "ar" ? "ar-SA" : "en-US";
  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(dateLocale, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  if (!canView) {
    return (
      <div className="flex-1 p-6">
        <p className="text-sm text-muted-foreground">{t("common.noAccess")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
        <div>
          <h1
            className="text-2xl font-bold text-foreground flex items-center gap-2"
            data-testid="text-offboarding-title"
          >
            <LogOut className="h-6 w-6" />
            {t("offboarding.adminTitle")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("offboarding.adminSubtitle")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t("offboarding.allInstancesTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : instances.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("offboarding.noInstances")}
              </p>
            ) : (
              <div className="space-y-2">
                {instances.map((inst) => {
                  const exp = expanded[inst.employeeId];
                  const isOpen = exp !== undefined;
                  const progressLabel = t("offboarding.progress", {
                    done: inst.doneTasks,
                    total: inst.totalTasks,
                  });
                  return (
                    <div
                      key={inst.instanceId}
                      className="border rounded-lg"
                      data-testid={`offboarding-instance-${inst.instanceId}`}
                    >
                      <button
                        onClick={() => toggleExpanded(inst.employeeId)}
                        className="w-full flex items-center gap-3 p-3 text-start hover:bg-muted/50 transition-colors"
                        data-testid={`button-toggle-instance-${inst.instanceId}`}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {inst.employeeName}
                            </span>
                            {inst.employeeTitle && (
                              <span className="text-xs text-muted-foreground">
                                · {inst.employeeTitle}
                              </span>
                            )}
                            {inst.deletedAt && (
                              <Badge variant="outline" className="text-xs">
                                {t("offboarding.softDeletedOn", {
                                  date: fmtDate(inst.deletedAt),
                                })}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {progressLabel}
                            {" · "}
                            {t("offboarding.startedOn", {
                              date: fmtDate(inst.startedAt),
                            })}
                          </p>
                        </div>
                        {inst.overdueTasks > 0 && (
                          <Badge variant="destructive">
                            {t("offboarding.overdueCount", {
                              count: inst.overdueTasks,
                            })}
                          </Badge>
                        )}
                      </button>
                      {isOpen && (
                        <div className="border-t p-3 bg-muted/20">
                          {exp === "loading" ? (
                            <Skeleton className="h-16 w-full" />
                          ) : exp === undefined ? null : exp.tasks.length ===
                            0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              {t("offboarding.noTasksInInstance")}
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {exp.tasks.map((task) => {
                                const isDone = task.status === "done";
                                const due = task.dueDate
                                  ? new Date(task.dueDate)
                                  : null;
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const overdue =
                                  !!due && !isDone && due < today;
                                return (
                                  <div
                                    key={task.id}
                                    className="flex items-start gap-2 p-2 rounded-md hover:bg-background/60"
                                    data-testid={`offboarding-instance-task-${task.id}`}
                                  >
                                    <Checkbox
                                      checked={isDone}
                                      disabled={!canEdit}
                                      onCheckedChange={() =>
                                        toggleTask(inst.employeeId, task)
                                      }
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p
                                        className={`text-sm ${
                                          isDone
                                            ? "line-through text-muted-foreground"
                                            : "text-foreground"
                                        }`}
                                      >
                                        {task.title}
                                      </p>
                                      {task.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {task.description}
                                        </p>
                                      )}
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs">
                                        {due && (
                                          <span
                                            className={
                                              overdue
                                                ? "text-destructive font-medium"
                                                : "text-muted-foreground"
                                            }
                                          >
                                            {t("offboarding.due")}:{" "}
                                            {due.toLocaleDateString(dateLocale, {
                                              month: "short",
                                              day: "numeric",
                                            })}
                                            {overdue &&
                                              ` (${t("offboarding.overdue")})`}
                                          </span>
                                        )}
                                        {task.assigneeName && (
                                          <span className="text-muted-foreground">
                                            {t("offboarding.assignee")}:{" "}
                                            {task.assigneeName}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
