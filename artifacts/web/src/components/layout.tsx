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
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

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
          {NAV_ITEMS.map((item) => {
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
