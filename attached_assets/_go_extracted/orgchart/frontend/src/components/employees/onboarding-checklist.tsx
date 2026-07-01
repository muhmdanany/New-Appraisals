import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

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
  completedAt: string | null;
  displayOrder: number;
};

type Instance = {
  id: number;
  startedAt: string;
  tasks: Task[];
};

export function OnboardingChecklist({
  orgId,
  employeeId,
  canEdit,
}: {
  orgId: number;
  employeeId: number;
  canEdit: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(
      `${API_BASE}/organizations/${orgId}/employees/${employeeId}/onboarding`,
      { credentials: "include" },
    )
      .then((r) => r.json())
      .then((data) => setInstance(data?.instance ?? null))
      .catch(() => setInstance(null))
      .finally(() => setLoading(false));
  }, [orgId, employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (task: Task) => {
    const newStatus = task.status === "done" ? "pending" : "done";
    const res = await fetch(
      `${API_BASE}/organizations/${orgId}/onboarding/tasks/${task.id}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      },
    );
    if (res.ok) {
      load();
    } else {
      toast({
        title: t("onboarding.errors.updateFailed"),
        variant: "destructive",
      });
    }
  };

  const startInstance = async () => {
    setCreating(true);
    try {
      const res = await fetch(
        `${API_BASE}/organizations/${orgId}/employees/${employeeId}/onboarding/instantiate`,
        { method: "POST", credentials: "include" },
      );
      if (res.ok) {
        toast({ title: t("onboarding.toasts.started") });
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title:
            data?.message ||
            t("onboarding.errors.noDefaultTemplate"),
          variant: "destructive",
        });
      }
    } finally {
      setCreating(false);
    }
  };

  const dateLocale = i18n.language === "ar" ? "ar-SA" : "en-US";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (loading) {
    return (
      <div className="mt-6 pt-4 border-t border-border">
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="mt-6 pt-4 border-t border-border" data-testid="onboarding-checklist">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">{t("onboarding.title")}</h4>
      </div>

      {!instance ? (
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground mb-2">
            {t("onboarding.noInstance")}
          </p>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={startInstance}
              disabled={creating}
              data-testid="button-start-onboarding"
            >
              <Plus className="h-3.5 w-3.5 me-1" />
              {creating
                ? t("common.saving")
                : t("onboarding.startOnboarding")}
            </Button>
          )}
        </div>
      ) : instance.tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          {t("onboarding.noTasksInInstance")}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t("onboarding.progress", {
                done: instance.tasks.filter((tk) => tk.status === "done").length,
                total: instance.tasks.length,
              })}
            </span>
          </div>
          {instance.tasks.map((task) => {
            const isDone = task.status === "done";
            const due = task.dueDate ? new Date(task.dueDate) : null;
            const overdue = !!due && !isDone && due < today;
            return (
              <div
                key={task.id}
                className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50"
                data-testid={`onboarding-task-${task.id}`}
              >
                <Checkbox
                  checked={isDone}
                  disabled={!canEdit}
                  onCheckedChange={() => toggle(task)}
                  className="mt-0.5"
                  data-testid={`onboarding-task-toggle-${task.id}`}
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
                        {t("onboarding.due")}:{" "}
                        {due.toLocaleDateString(dateLocale, {
                          month: "short",
                          day: "numeric",
                        })}
                        {overdue && ` (${t("onboarding.overdue")})`}
                      </span>
                    )}
                    {task.assigneeName && (
                      <span className="text-muted-foreground">
                        {t("onboarding.assignee")}: {task.assigneeName}
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
  );
}
