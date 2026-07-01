import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, ChevronRight } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type MyTask = {
  id: number;
  employeeId: number;
  employeeName: string;
  title: string;
  dueDate: string | null;
  status: string;
};

export function OnboardingTasksWidget({ orgId }: { orgId: number }) {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    fetch(`${API_BASE}/organizations/${orgId}/onboarding/my-tasks`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => setTasks(Array.isArray(data?.tasks) ? data.tasks : []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [orgId]);

  const dateLocale = i18n.language === "ar" ? "ar-SA" : "en-US";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueCount = tasks.filter(
    (tk) => tk.dueDate && new Date(tk.dueDate) < today,
  ).length;

  return (
    <Card data-testid="card-my-onboarding-tasks">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          {t("onboarding.myTasksTitle")}
          {tasks.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {tasks.length}
            </Badge>
          )}
          {overdueCount > 0 && (
            <Badge variant="destructive">
              {t("onboarding.overdueCount", { count: overdueCount })}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("onboarding.noOpenTasks")}
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {tasks.map((tk) => {
              const due = tk.dueDate ? new Date(tk.dueDate) : null;
              const overdue = !!due && due < today;
              return (
                <button
                  key={tk.id}
                  onClick={() => setLocation(`/employees`)}
                  className="w-full text-start flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                  data-testid={`my-onboarding-task-${tk.id}`}
                >
                  <ClipboardList className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {tk.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {tk.employeeName}
                      {due && (
                        <>
                          {" · "}
                          <span
                            className={
                              overdue ? "text-destructive font-medium" : ""
                            }
                          >
                            {t("onboarding.due")}:{" "}
                            {due.toLocaleDateString(dateLocale, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
