import { ReactNode, useState } from "react";
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
  LogOut,
  Settings,
  Moon,
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
  { href: "/admin", label: "لوحة الإدارة", icon: Settings },
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const allowed = user ? (ROLE_NAV[user.role] ?? NAV_ITEMS.map((i) => i.href)) : [];
  const navItems = NAV_ITEMS.filter((item) => allowed.includes(item.href));

  const toggleDark = () => document.documentElement.classList.toggle("dark");

  const sidebarContent = (mobile?: boolean) => (
    <>
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
              <a
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                onClick={() => mobile && setMobileOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </a>
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="border-t border-border p-4 space-y-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm text-foreground truncate">{user.name}</div>
              <div className="text-xs text-muted-foreground">{ROLE_LABELS[user.role] ?? user.role}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={clear}>
              <LogOut className="w-4 h-4 ml-2" />
              تبديل المستخدم
            </Button>
            <Button variant="outline" size="icon" onClick={toggleDark} title="الوضع الداكن">
              <Moon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside
            className="absolute top-0 right-0 bottom-0 w-72 bg-card shadow-xl flex flex-col animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-card border-l border-border flex-col hidden md:flex">
        {sidebarContent()}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 md:hidden">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <Award className="w-6 h-6" />
            منصة الكفاءات
          </h1>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
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
