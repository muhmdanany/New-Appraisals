import { useDashboardStats, useDashboardAnalytics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Briefcase, Award, GraduationCap, ClipboardCheck, Target, Map, PieChart } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const RATING_COLORS = [
  "bg-emerald-500",   // متميز
  "bg-blue-500",      // يتجاوز التوقعات
  "bg-green-500",     // يحقق التوقعات
  "bg-amber-500",     // يحتاج تحسيناً
  "bg-red-500",       // دون المستوى
];

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: analytics, isLoading: analyticsLoading } = useDashboardAnalytics();

  const statCards = [
    { title: t("dashboard.employees"), value: stats?.employees, icon: Users, color: "text-blue-500" },
    { title: t("dashboard.jobs"), value: stats?.jobs, icon: Briefcase, color: "text-purple-500" },
    { title: t("dashboard.competencies"), value: stats?.competencies, icon: Award, color: "text-amber-500" },
    { title: t("dashboard.grades"), value: stats?.grades, icon: GraduationCap, color: "text-emerald-500" },
    { title: t("dashboard.evaluations"), value: stats?.evaluations, icon: ClipboardCheck, color: "text-indigo-500" },
    { title: t("dashboard.kpis"), value: stats?.kpis, icon: Target, color: "text-rose-500" },
    { title: t("dashboard.careerPaths"), value: stats?.careerPaths, icon: Map, color: "text-cyan-500" },
    { title: t("dashboard.departments"), value: stats?.departments, icon: PieChart, color: "text-orange-500" },
  ];

  const totalRatings = analytics?.ratingDistribution?.reduce((s: number, b: any) => s + b.count, 0) ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => (
          <Card key={i} className="hover-elevate transition-all border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <div className={`p-2 bg-muted rounded-md ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-bold text-foreground">{card.value || 0}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* متوسط الدرجة + التقييمات المعتمدة */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>{t("dashboard.evalSummary")}</CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">{t("dashboard.avgScore")}</p>
                    <div className="text-5xl font-bold text-primary">
                      {analytics?.averageScore ? Math.round(analytics.averageScore) : 0}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{t("dashboard.outOf100")}</p>
                  </div>
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  {analytics?.finalizedCount || 0} {t("dashboard.finalizedEval")}
                </div>
                {analytics?.activePolicyName && (
                  <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg flex items-center justify-between">
                    <span className="text-primary font-medium text-sm">{t("dashboard.activePolicy")}</span>
                    <span className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-full">{analytics.activePolicyName}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* توزيع التقديرات */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("dashboard.ratingDist")}</CardTitle>
              <span className="text-sm text-muted-foreground">{totalRatings} {t("dashboard.evalCount")}</span>
            </div>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <div className="space-y-3">
                {analytics?.ratingDistribution?.map((bucket: any, i: number) => {
                  const pct = totalRatings > 0 ? (bucket.count / totalRatings) * 100 : 0;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{bucket.label}</span>
                        <span className="text-muted-foreground">
                          ({Math.round(pct)}%) {bucket.count}
                        </span>
                      </div>
                      <div className="h-3 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${RATING_COLORS[i] || "bg-gray-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
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
