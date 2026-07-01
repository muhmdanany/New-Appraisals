import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
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
  Menu,
  UserRound,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIdentity, ROLE_LABELS } from "@/lib/identity";

const NAV_ITEMS = [
  { href: "/", label: "لوحة القيادة", icon: LayoutDashboard },
  { href: "/jobs", label: "الوظائف", icon: Briefcase },
  { href: "/competencies", label: "الجدارات", icon: Award },
  { href: "/grades", label: "الدرجات الوظيفية", icon: GraduationCap },
  { href: "/career-paths", label: "المسارات المهنية", icon: Map },
  { href: "/employees", label: "الموظفين", icon: Users },
  { href: "/kpis", label: "مؤشرات الأداء", icon: Target },
  { href: "/evaluations", label: "التقييمات", icon: ClipboardCheck },
  { href: "/reports", label: "التقارير", icon: FileBarChart },
  { href: "/bell-curve", label: "التوزيع الطبيعي", icon: PieChart },
  { href: "/org-chart", label: "الهيكل التنظيمي", icon: Network },
];

// Which nav destinations each role may see. ADMIN/HR see everything;
// managers see operational sections; employees only their evaluations.
const ROLE_NAV: Record<string, string[]> = {
  ADMIN: NAV_ITEMS.map((i) => i.href),
  HR_MANAGER: NAV_ITEMS.map((i) => i.href),
  FIRST_LEVEL_MANAGER: ["/", "/employees", "/evaluations", "/reports", "/bell-curve", "/org-chart"],
  SECOND_LEVEL_MANAGER: ["/", "/employees", "/evaluations", "/reports", "/bell-curve", "/org-chart"],
  EMPLOYEE: ["/evaluations"],
};

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, clear } = useIdentity();

  const allowed = user ? (ROLE_NAV[user.role] ?? NAV_ITEMS.map((i) => i.href)) : [];
  const navItems = NAV_ITEMS.filter((item) => allowed.includes(item.href));

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
          {navItems.map((item) => {
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

        {user && (
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-foreground truncate">{user.name}</div>
                <div className="text-xs text-muted-foreground">{ROLE_LABELS[user.role] ?? user.role}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={clear}>
              <LogOut className="w-4 h-4 ml-2" />
              تبديل المستخدم
            </Button>
          </div>
        )}
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
