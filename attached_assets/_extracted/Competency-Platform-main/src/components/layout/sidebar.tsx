"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Award,
  BarChart3,
  Route,
  Users,
  ClipboardCheck,
  Target,
  FileText,
  Network,
  ShieldCheck,
  Building2,
  ChartSpline,
  type LucideIcon,
} from "lucide-react";

import { navGroupsForRole, type Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Briefcase,
  Award,
  BarChart3,
  Route,
  Users,
  ClipboardCheck,
  Target,
  FileText,
  Network,
  ShieldCheck,
  ChartSpline,
};

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const groups = navGroupsForRole(role);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-y-auto bg-sidebar text-sidebar-foreground print:hidden">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-[hsl(44_60%_64%)] text-[hsl(219_62%_15%)] shadow-md">
          <Building2 className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">منصة الكفاءات</div>
          <div className="text-[10px] text-sidebar-muted">إدارة الأداء الوظيفي</div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3">
        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-sidebar-muted/70">
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-accent/15 font-semibold text-sidebar-accent"
                      : "text-sidebar-muted hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="me-auto rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold text-sidebar-accent">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
