/**
 * Role-based access control: roles, the navigation/route permission matrix, and
 * small helpers shared by the sidebar (client) and middleware (edge).
 *
 * This module is intentionally dependency-free (no Prisma, no Node APIs) so it
 * can run in the edge middleware and in client components.
 */

export type Role =
  | "ADMIN"
  | "HR_MANAGER"
  | "FIRST_LEVEL_MANAGER"
  | "SECOND_LEVEL_MANAGER"
  | "EMPLOYEE";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "مدير النظام",
  HR_MANAGER: "مدير الموارد البشرية",
  FIRST_LEVEL_MANAGER: "مدير مباشر",
  SECOND_LEVEL_MANAGER: "مدير أعلى",
  EMPLOYEE: "موظف",
};

const ALL_ROLES: Role[] = [
  "ADMIN",
  "HR_MANAGER",
  "FIRST_LEVEL_MANAGER",
  "SECOND_LEVEL_MANAGER",
  "EMPLOYEE",
];

const MANAGERS: Role[] = ["FIRST_LEVEL_MANAGER", "SECOND_LEVEL_MANAGER"];

export interface NavItem {
  href: string;
  label: string;
  /** lucide-react icon name */
  icon: string;
  roles: Role[];
  badge?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "عام",
    items: [
      { href: "/dashboard", label: "لوحة المعلومات", icon: "LayoutDashboard", roles: ["ADMIN", "HR_MANAGER"] },
    ],
  },
  {
    label: "البيانات الأساسية",
    items: [
      { href: "/jobs", label: "الوظائف", icon: "Briefcase", roles: ["ADMIN", "HR_MANAGER"] },
      { href: "/competencies", label: "الجدارات", icon: "Award", roles: ["ADMIN", "HR_MANAGER"] },
      { href: "/grades", label: "الدرجات الوظيفية", icon: "BarChart3", roles: ["ADMIN", "HR_MANAGER"] },
      { href: "/career-paths", label: "المسارات الوظيفية", icon: "Route", roles: ["ADMIN", "HR_MANAGER"] },
    ],
  },
  {
    label: "الأداء",
    items: [
      { href: "/employees", label: "الموظفون", icon: "Users", roles: ["ADMIN", "HR_MANAGER", ...MANAGERS] },
      { href: "/evaluations", label: "تقييم الأداء", icon: "ClipboardCheck", roles: ALL_ROLES },
      { href: "/kpis", label: "مؤشرات الأداء", icon: "Target", roles: ["ADMIN"], badge: "AI" },
    ],
  },
  {
    label: "أدوات",
    items: [
      { href: "/reports", label: "التقارير والتصدير", icon: "FileText", roles: ["ADMIN", "HR_MANAGER"] },
      { href: "/bell-curve", label: "تحليل منحنى الجرس", icon: "ChartSpline", roles: ["ADMIN", "HR_MANAGER"] },
      { href: "/org-chart", label: "الهيكل التنظيمي", icon: "Network", roles: ["ADMIN", "HR_MANAGER", ...MANAGERS] },
      { href: "/admin", label: "إدارة المستخدمين", icon: "ShieldCheck", roles: ["ADMIN"] },
    ],
  },
];

/** Flat route -> allowed-roles map, derived from NAV_GROUPS. Used by middleware. */
export const ROUTE_PERMISSIONS: { prefix: string; roles: Role[] }[] = NAV_GROUPS.flatMap(
  (group) => group.items.map((item) => ({ prefix: item.href, roles: item.roles })),
);

/** Returns the allowed roles for a given pathname, or null if unmatched (open to any authed user). */
export function rolesForPath(pathname: string): Role[] | null {
  // Longest-prefix match so /jobs/123 inherits /jobs.
  const match = ROUTE_PERMISSIONS.filter((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
  return match ? match.roles : null;
}

export function canAccessPath(pathname: string, role: Role): boolean {
  const roles = rolesForPath(pathname);
  return roles === null ? true : roles.includes(role);
}

export function navGroupsForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

/**
 * The landing route for a role after login. Only ADMIN and HR_MANAGER can see the
 * statistics dashboard; everyone else starts on the evaluations page. Used by the
 * root redirect and by middleware to avoid redirect loops when a role is denied a route.
 */
export function defaultPathForRole(role: Role): string {
  return role === "ADMIN" || role === "HR_MANAGER" ? "/dashboard" : "/evaluations";
}
