"use client";

import {
  Briefcase,
  Award,
  BarChart3,
  ClipboardCheck,
  Users,
  Target,
  Route,
  Network,
  type LucideIcon,
} from "lucide-react";

import Link from "next/link";

import { api } from "@/trpc/react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DashboardAnalytics } from "./dashboard-analytics";

type Accent = "primary" | "success" | "warning" | "accent";

const CARDS: {
  key:
    | "jobs"
    | "competencies"
    | "grades"
    | "evaluations"
    | "employees"
    | "kpis"
    | "careerPaths"
    | "departments";
  label: string;
  sub: string;
  icon: LucideIcon;
  accent: Accent;
  href: string;
}[] = [
  { key: "jobs", label: "الوظائف", sub: "وظيفة مسجلة", icon: Briefcase, accent: "primary", href: "/jobs" },
  { key: "competencies", label: "الجدارات", sub: "جدارة محددة", icon: Award, accent: "success", href: "/competencies" },
  { key: "grades", label: "الدرجات", sub: "درجة وظيفية", icon: BarChart3, accent: "warning", href: "/grades" },
  { key: "evaluations", label: "التقييمات", sub: "تقييم منجز", icon: ClipboardCheck, accent: "accent", href: "/evaluations" },
  { key: "employees", label: "الموظفون", sub: "في المنظمة", icon: Users, accent: "primary", href: "/employees" },
  { key: "kpis", label: "مؤشرات الأداء", sub: "مؤشر محفوظ", icon: Target, accent: "success", href: "/kpis" },
  { key: "careerPaths", label: "المسارات", sub: "مسار وظيفي", icon: Route, accent: "warning", href: "/career-paths" },
  { key: "departments", label: "الإدارات", sub: "وحدة تنظيمية", icon: Network, accent: "accent", href: "/org-chart" },
];

const ACCENT_BAR: Record<Accent, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  accent: "bg-accent",
};

const ACCENT_TEXT: Record<Accent, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  accent: "text-accent",
};

export default function DashboardPage() {
  const { data, isLoading } = api.dashboard.stats.useQuery();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">لوحة المعلومات</h1>
        <p className="text-sm text-muted-foreground">نظرة عامة على بيانات المنصة</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CARDS.map((c) => {
          const Icon = c.icon;
          const value = data?.[c.key];
          return (
            <Card
              key={c.key}
              className="relative overflow-hidden transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring/40"
            >
              <div className={cn("absolute inset-x-0 top-0 h-1", ACCENT_BAR[c.accent])} />
              <Link href={c.href} className="block p-5 outline-none" aria-label={c.label}>
                <div className="mb-2 flex items-start justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                  <Icon className={cn("size-5 opacity-20", ACCENT_TEXT[c.accent])} />
                </div>
                <div className={cn("text-3xl font-extrabold leading-none", ACCENT_TEXT[c.accent])}>
                  {isLoading ? (
                    <span className="inline-block h-7 w-10 animate-pulse rounded bg-muted align-middle" />
                  ) : (
                    (value ?? 0).toLocaleString("ar-EG")
                  )}
                </div>
                <div className="mt-1.5 text-[11px] text-muted-foreground">{c.sub}</div>
              </Link>
            </Card>
          );
        })}
      </div>

      <DashboardAnalytics />
    </div>
  );
}
