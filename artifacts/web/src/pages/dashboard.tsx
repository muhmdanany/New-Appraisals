import { useDashboardStats, useDashboardAnalytics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Briefcase, Award, GraduationCap, ClipboardCheck, Target, Map, PieChart } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: analytics, isLoading: analyticsLoading } = useDashboardAnalytics();

  const statCards = [
    { title: "الموظفين", value: stats?.employees, icon: Users, color: "text-blue-500" },
    { title: "الوظائف", value: stats?.jobs, icon: Briefcase, color: "text-purple-500" },
    { title: "الجدارات", value: stats?.competencies, icon: Award, color: "text-amber-500" },
    { title: "الدرجات", value: stats?.grades, icon: GraduationCap, color: "text-emerald-500" },
    { title: "التقييمات", value: stats?.evaluations, icon: ClipboardCheck, color: "text-indigo-500" },
    { title: "مؤشرات الأداء", value: stats?.kpis, icon: Target, color: "text-rose-500" },
    { title: "المسارات المهنية", value: stats?.careerPaths, icon: Map, color: "text-cyan-500" },
    { title: "الإدارات", value: stats?.departments, icon: PieChart, color: "text-orange-500" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">لوحة القيادة</h1>
        <p className="text-muted-foreground mt-2">نظرة عامة على بيانات وإحصائيات المنصة</p>
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
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>تحليلات التقييم</CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">التقييمات المعتمدة</p>
                    <p className="text-2xl font-bold">{analytics?.finalizedCount || 0}</p>
                  </div>
                  <div className="bg-secondary/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">متوسط التقييم العام</p>
                    <p className="text-2xl font-bold">{analytics?.averageScore ? analytics.averageScore.toFixed(2) : 0}%</p>
                  </div>
                </div>
                
                {analytics?.activePolicyName && (
                  <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg flex items-center justify-between">
                    <span className="text-primary font-medium">سياسة التوزيع النشطة</span>
                    <span className="text-sm bg-primary text-primary-foreground px-3 py-1 rounded-full">{analytics.activePolicyName}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}