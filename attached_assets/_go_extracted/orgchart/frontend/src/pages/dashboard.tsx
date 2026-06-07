import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AskBox } from "@/components/ask-box";
import { useOrg } from "@/lib/org-context";
import { useTranslation } from "react-i18next";
import {
  useGetOrgDashboard,
  useGetRecentActivity,
  useGetDepartmentStats,
  useListEmployees,
  useListSuggestions,
  useGetCelebrations,
  getGetOrgDashboardQueryKey,
  getGetRecentActivityQueryKey,
  getGetDepartmentStatsQueryKey,
  getListEmployeesQueryKey,
  getListSuggestionsQueryKey,
  getGetCelebrationsQueryKey,
} from "@workspace/api-client-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Cake, PartyPopper } from "lucide-react";
import { daysSinceOpened, openPositionUrgency } from "@/pages/org-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Building2,
  TrendingUp,
  UserPlus,
  Layers,
  GitBranch,
  Clock,
  Activity,
  Briefcase,
  ChevronRight,
  Lightbulb,
  AlertOctagon,
  AlertTriangle,
  Info as InfoIcon,
  GitMerge,
} from "lucide-react";
import { MergedFromImportDetails } from "@/components/merged-from-import-details";
import { OnboardingTasksWidget } from "@/components/dashboard/onboarding-tasks-widget";
import { OffboardingTasksWidget } from "@/components/dashboard/offboarding-tasks-widget";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function Dashboard() {
  const { selectedOrgId } = useOrg();
  const { t, i18n } = useTranslation();

  const { data: dashboard, isLoading: dashLoading } = useGetOrgDashboard(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: getGetOrgDashboardQueryKey(selectedOrgId!) } }
  );

  const { data: activities, isLoading: actLoading } = useGetRecentActivity(
    selectedOrgId!,
    { limit: 10 },
    { query: { enabled: !!selectedOrgId, queryKey: getGetRecentActivityQueryKey(selectedOrgId!, { limit: 10 }) } }
  );

  const { data: deptStats, isLoading: deptLoading } = useGetDepartmentStats(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: getGetDepartmentStatsQueryKey(selectedOrgId!) } }
  );

  const { data: openPositions, isLoading: openLoading } = useListEmployees(
    selectedOrgId!,
    { openOnly: true },
    {
      query: {
        enabled: !!selectedOrgId,
        queryKey: getListEmployeesQueryKey(selectedOrgId!, { openOnly: true }),
      },
    },
  );

  const { data: suggestionsData, isLoading: sugLoading } = useListSuggestions(
    selectedOrgId!,
    { query: { enabled: !!selectedOrgId, queryKey: getListSuggestionsQueryKey(selectedOrgId!) } }
  );

  const [celebRange, setCelebRange] = useState<"week" | "month">("week");
  const { data: celebrations, isLoading: celebLoading } = useGetCelebrations(
    selectedOrgId!,
    { range: celebRange },
    {
      query: {
        enabled: !!selectedOrgId,
        queryKey: getGetCelebrationsQueryKey(selectedOrgId!, { range: celebRange }),
      },
    },
  );

  const [, setLocation] = useLocation();

  // Read an optional ?ask= deep link so the command palette can route a
  // natural-language question here and have the AskBox auto-run it.
  const [initialAsk, setInitialAsk] = useState<string | undefined>(undefined);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ask = params.get("ask");
    if (ask) {
      setInitialAsk(ask);
      params.delete("ask");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  const openCounts = useMemo(() => {
    const list = openPositions ?? [];
    let warning = 0;
    let critical = 0;
    for (const p of list) {
      const u = openPositionUrgency(daysSinceOpened(p.openSinceDate));
      if (u === "warning") warning += 1;
      else if (u === "critical") critical += 1;
    }
    return { total: list.length, warning, critical };
  }, [openPositions]);

  if (!selectedOrgId) {
    return <div className="p-8 text-muted-foreground">{t("dashboard.selectOrgToDash")}</div>;
  }

  const dateLocale = i18n.language === "ar" ? "ar-SA" : "en-US";

  const statCards = [
    { label: t("dashboard.totalEmployees"), value: dashboard?.totalEmployees ?? 0, icon: Users, color: "text-blue-600" },
    { label: t("dashboard.activeEmployees"), value: dashboard?.activeEmployees ?? 0, icon: TrendingUp, color: "text-green-600" },
    { label: t("dashboard.departments"), value: dashboard?.totalDepartments ?? 0, icon: Building2, color: "text-purple-600" },
    { label: t("dashboard.newThisMonth"), value: dashboard?.newHiresThisMonth ?? 0, icon: UserPlus, color: "text-amber-600" },
    { label: t("dashboard.avgTeamSize"), value: dashboard?.avgTeamSize ?? 0, icon: Layers, color: "text-indigo-600" },
    { label: t("dashboard.reportingDepth"), value: dashboard?.maxDepth ?? 0, icon: GitBranch, color: "text-rose-600" },
  ];

  const activityIcons: Record<string, string> = {
    employee_added: "bg-green-100 text-green-700",
    employee_updated: "bg-blue-100 text-blue-700",
    employee_removed: "bg-red-100 text-red-700",
    employee_moved: "bg-amber-100 text-amber-700",
    merged_from_import: "bg-indigo-100 text-indigo-700",
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("dashboard.subtitle")}</p>
        </div>

        <AskBox initialQuestion={initialAsk} compact />

        <Card
          role="button"
          tabIndex={0}
          onClick={() => setLocation("/open-positions")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setLocation("/open-positions");
            }
          }}
          className="cursor-pointer hover-elevate active-elevate-2 transition-all"
          aria-label={t("dashboard.viewOpenPositions")}
          data-testid="card-open-positions"
        >
          <CardContent className="p-4">
            {openLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{t("dashboard.openPositions")}</span>
                    </div>
                    <div className="flex items-baseline gap-3 mt-0.5">
                      <span
                        className="text-2xl font-bold text-foreground"
                        data-testid="text-stat-open-positions"
                      >
                        {openCounts.total}
                      </span>
                      {openCounts.total > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 text-amber-700 dark:text-amber-400"
                            data-testid="badge-open-warning"
                          >
                            {t("dashboard.openPositionsOver30", { count: openCounts.warning })}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-destructive/40 text-destructive"
                            data-testid="badge-open-critical"
                          >
                            {t("dashboard.openPositionsOver60", { count: openCounts.critical })}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180 flex-shrink-0" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onClick={() => setLocation("/suggestions")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setLocation("/suggestions");
            }
          }}
          className="cursor-pointer hover-elevate active-elevate-2 transition-all"
          aria-label={t("suggestions.cardCta")}
          data-testid="card-suggestions"
        >
          <CardContent className="p-4">
            {sugLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t("suggestions.cardTitle")}
                      </span>
                    </div>
                    {(() => {
                      const list = suggestionsData?.suggestions ?? [];
                      if (list.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground mt-1" data-testid="text-suggestions-card-empty">
                            {t("suggestions.cardEmpty")}
                          </p>
                        );
                      }
                      const critical = list.filter(s => s.severity === "critical").length;
                      const warning = list.filter(s => s.severity === "warning").length;
                      const info = list.filter(s => s.severity === "info").length;
                      const top = list.slice(0, 3);
                      return (
                        <>
                          <div className="flex items-baseline gap-3 mt-0.5 flex-wrap">
                            <span
                              className="text-2xl font-bold text-foreground"
                              data-testid="text-stat-suggestions"
                            >
                              {list.length}
                            </span>
                            <div className="flex items-center gap-2 text-xs">
                              {critical > 0 && (
                                <Badge
                                  variant="outline"
                                  className="border-destructive/40 text-destructive gap-1"
                                  data-testid="badge-suggestions-critical"
                                >
                                  <AlertOctagon className="h-3 w-3" />
                                  {critical}
                                </Badge>
                              )}
                              {warning > 0 && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-500/40 text-amber-700 dark:text-amber-400 gap-1"
                                  data-testid="badge-suggestions-warning"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  {warning}
                                </Badge>
                              )}
                              {info > 0 && (
                                <Badge
                                  variant="outline"
                                  className="border-blue-500/40 text-blue-700 dark:text-blue-400 gap-1"
                                  data-testid="badge-suggestions-info"
                                >
                                  <InfoIcon className="h-3 w-3" />
                                  {info}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <ul className="mt-2 space-y-0.5">
                            {top.map((s) => (
                              <li
                                key={s.key}
                                className="text-xs text-muted-foreground truncate"
                                data-testid={`text-suggestion-preview-${s.key}`}
                              >
                                • {s.title}
                              </li>
                            ))}
                          </ul>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180 flex-shrink-0" />
              </div>
            )}
          </CardContent>
        </Card>

        <OnboardingTasksWidget orgId={selectedOrgId} />

        <OffboardingTasksWidget orgId={selectedOrgId} />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                {dashLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                      <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground" data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
                      {stat.value}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t("dashboard.employeesByDept")}</CardTitle>
            </CardHeader>
            <CardContent>
              {dashLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : dashboard?.departmentBreakdown && dashboard.departmentBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dashboard.departmentBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="departmentName"
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="employeeCount"
                      name={t("dashboard.employees")}
                      radius={[4, 4, 0, 0]}
                    >
                      {dashboard.departmentBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  {t("dashboard.noDepartmentsYet")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t("dashboard.deptDistribution")}</CardTitle>
            </CardHeader>
            <CardContent>
              {dashLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : dashboard?.departmentBreakdown && dashboard.departmentBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={dashboard.departmentBreakdown}
                      dataKey="employeeCount"
                      nameKey="departmentName"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ departmentName, percent }) =>
                        `${departmentName} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {dashboard.departmentBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  {t("dashboard.noDataYet")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <PartyPopper className="h-4 w-4 text-pink-600" />
                {t("dashboard.celebrations.title")}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{t("dashboard.celebrations.subtitle")}</p>
            </div>
            <Tabs value={celebRange} onValueChange={(v) => setCelebRange(v as "week" | "month")}>
              <TabsList data-testid="tabs-celebrations-range">
                <TabsTrigger value="week" data-testid="tab-celebrations-week">{t("dashboard.celebrations.tabWeek")}</TabsTrigger>
                <TabsTrigger value="month" data-testid="tab-celebrations-month">{t("dashboard.celebrations.tabMonth")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {celebLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            ) : (
              (() => {
                const birthdays = celebrations?.birthdays ?? [];
                const anniversaries = celebrations?.anniversaries ?? [];
                const showYear = celebrations?.showBirthdayYear ?? false;

                const formatDay = (iso: string, isToday: boolean): string => {
                  if (isToday) return t("dashboard.celebrations.today");
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const target = new Date(iso + "T00:00:00");
                  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
                  if (diff === 1) return t("dashboard.celebrations.tomorrow");
                  if (diff > 1) return t("dashboard.celebrations.inDays", { count: diff });
                  return new Date(iso + "T00:00:00").toLocaleDateString(dateLocale, { month: "short", day: "numeric" });
                };

                const formatBirthdayLabel = (item: { monthDay: string; year: number | null }): string => {
                  const [m, d] = item.monthDay.split("-");
                  const fmt = new Date(2000, parseInt(m, 10) - 1, parseInt(d, 10)).toLocaleDateString(dateLocale, {
                    month: "long",
                    day: "numeric",
                  });
                  return showYear && item.year ? `${fmt} ${item.year}` : fmt;
                };

                const initials = (name: string) =>
                  name
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase() ?? "")
                    .join("");

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div data-testid="section-celebrations-birthdays">
                      <div className="flex items-center gap-2 mb-3">
                        <Cake className="h-4 w-4 text-pink-600" />
                        <h3 className="text-sm font-semibold text-foreground">
                          {t("dashboard.celebrations.birthdays")}
                        </h3>
                        <Badge variant="secondary" className="text-xs">{birthdays.length}</Badge>
                      </div>
                      {birthdays.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">{t("dashboard.celebrations.empty")}</p>
                      ) : (
                        <ul className="space-y-2 max-h-64 overflow-y-auto">
                          {birthdays.map((b) => (
                            <li
                              key={`bd-${b.employeeId}-${b.eventDate}`}
                              className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                              data-testid={`celebration-birthday-${b.employeeId}`}
                            >
                              <Avatar className="h-9 w-9 flex-shrink-0">
                                {b.avatarUrl ? <AvatarImage src={b.avatarUrl} alt={b.employeeName} /> : null}
                                <AvatarFallback className="text-xs">{initials(b.employeeName)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{b.employeeName}</p>
                                <p className="text-xs text-muted-foreground truncate">{b.title}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className={`text-xs font-medium ${b.isToday ? "text-pink-600" : "text-foreground"}`}>
                                  {formatDay(b.eventDate, b.isToday)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{formatBirthdayLabel(b)}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      {!showYear && birthdays.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-2">
                          {t("dashboard.celebrations.privacyHint")}
                        </p>
                      )}
                    </div>

                    <div data-testid="section-celebrations-anniversaries">
                      <div className="flex items-center gap-2 mb-3">
                        <PartyPopper className="h-4 w-4 text-amber-600" />
                        <h3 className="text-sm font-semibold text-foreground">
                          {t("dashboard.celebrations.anniversaries")}
                        </h3>
                        <Badge variant="secondary" className="text-xs">{anniversaries.length}</Badge>
                      </div>
                      {anniversaries.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">{t("dashboard.celebrations.empty")}</p>
                      ) : (
                        <ul className="space-y-2 max-h-64 overflow-y-auto">
                          {anniversaries.map((a) => {
                            const years = a.yearsCount ?? 0;
                            const yearsLabel =
                              years === 1
                                ? t("dashboard.celebrations.oneYearOfService")
                                : t("dashboard.celebrations.yearsOfService", { count: years });
                            return (
                              <li
                                key={`anv-${a.employeeId}-${a.eventDate}`}
                                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                                data-testid={`celebration-anniversary-${a.employeeId}`}
                              >
                                <Avatar className="h-9 w-9 flex-shrink-0">
                                  {a.avatarUrl ? <AvatarImage src={a.avatarUrl} alt={a.employeeName} /> : null}
                                  <AvatarFallback className="text-xs">{initials(a.employeeName)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{a.employeeName}</p>
                                  <p className="text-xs text-muted-foreground truncate">{a.title}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className={`text-xs font-medium ${a.isToday ? "text-amber-600" : "text-foreground"}`}>
                                    {formatDay(a.eventDate, a.isToday)}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">{yearsLabel}</p>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4" />
                {t("dashboard.recentActivity")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {actLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : activities && activities.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {activities.map((activity) => {
                    const isMerge = activity.type === "merged_from_import";
                    return (
                      <div key={activity.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${activityIcons[activity.type] || "bg-gray-100 text-gray-700"}`}>
                          {isMerge ? <GitMerge className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          {isMerge && activity.details ? (
                            <MergedFromImportDetails
                              details={activity.details as Record<string, unknown>}
                              compact
                            />
                          ) : (
                            <p className="text-sm text-foreground">{activity.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(activity.timestamp).toLocaleDateString(dateLocale, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">{t("dashboard.noRecentActivity")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t("dashboard.deptStats")}</CardTitle>
            </CardHeader>
            <CardContent>
              {deptLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : deptStats && deptStats.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {deptStats.map((stat) => (
                    <div key={stat.departmentId} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stat.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">{stat.departmentName}</p>
                          <Badge variant="secondary" className="text-xs">
                            {stat.totalEmployees} {stat.totalEmployees !== 1 ? t("dashboard.employees_plural") : t("dashboard.employee")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{t("dashboard.activeCount", { count: stat.activeEmployees })}</span>
                          {stat.avgTenure > 0 && <span>{t("dashboard.avgTenure", { years: stat.avgTenure })}</span>}
                          {stat.headName && <span>{t("dashboard.head", { name: stat.headName })}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">{t("dashboard.noDepartments")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
