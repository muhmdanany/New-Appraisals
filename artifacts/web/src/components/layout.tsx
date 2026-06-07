import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  Briefcase, 
  Award, 
  GraduationCap, 
  Map, 
  Users, 
  Target, 
  ClipboardCheck, 
  FileBarChart, 
  PieChart, 
  Network,
  LogOut,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ALL_ROLES = ["ADMIN", "HR_MANAGER", "FIRST_LEVEL_MANAGER", "SECOND_LEVEL_MANAGER", "EMPLOYEE"];
const GENERAL_READ = ["ADMIN", "HR_MANAGER"];
const HR_READ = ["ADMIN", "HR_MANAGER", "FIRST_LEVEL_MANAGER", "SECOND_LEVEL_MANAGER"];

const NAV_ITEMS = [
  { href: "/", label: "لوحة القيادة", icon: LayoutDashboard, roles: GENERAL_READ },
  { href: "/jobs", label: "الوظائف", icon: Briefcase, roles: GENERAL_READ },
  { href: "/competencies", label: "الجدارات", icon: Award, roles: GENERAL_READ },
  { href: "/grades", label: "الدرجات الوظيفية", icon: GraduationCap, roles: GENERAL_READ },
  { href: "/career-paths", label: "المسارات المهنية", icon: Map, roles: GENERAL_READ },
  { href: "/employees", label: "الموظفين", icon: Users, roles: HR_READ },
  { href: "/kpis", label: "مؤشرات الأداء", icon: Target, roles: ["ADMIN"] },
  { href: "/evaluations", label: "التقييمات", icon: ClipboardCheck, roles: ALL_ROLES },
  { href: "/reports", label: "التقارير", icon: FileBarChart, roles: GENERAL_READ },
  { href: "/bell-curve", label: "التوزيع الطبيعي", icon: PieChart, roles: GENERAL_READ },
  { href: "/org-chart", label: "الهيكل التنظيمي", icon: Network, roles: HR_READ },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const logout = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(getGetMeQueryKey(), null);
      }
    });
  };

  const visibleNavItems = NAV_ITEMS.filter(item => 
    !user || item.roles.includes(user.role)
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-l border-border flex flex-col hidden md:flex">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Award className="w-8 h-8" />
            منصة الكفاءات
          </h1>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <a className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
              {user?.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
            <LogOut className="w-4 h-4 ml-2" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 md:hidden">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <Award className="w-6 h-6" />
            منصة الكفاءات
          </h1>
          <Button variant="ghost" size="icon">
            <Menu className="w-6 h-6" />
          </Button>
        </header>
        <div className="flex-1 overflow-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}