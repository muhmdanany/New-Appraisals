import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Award,
  Map,
  Target,
  ClipboardCheck,
  FileBarChart,
  PieChart,
  Network,
  Menu,
  UserRound,
  LogOut,
  Settings,
  Bell,
  Globe,
  Moon,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIdentity, ROLE_LABELS } from "@/lib/identity";
import { usePermissions } from "@/lib/permissions";
import { useTranslation } from "@/lib/i18n";

// Map each nav href to its permission resource key.
const HREF_RESOURCE: Record<string, string> = {
  "/": "dashboard",
  "/career-paths": "career-paths",
  "/kpis": "kpis",
  "/evaluations": "evaluations",
  "/reports": "reports",
  "/bell-curve": "bell-curve",
  "/org-chart": "org-chart",
  "/admin": "admin",
};

const NAV_ITEMS = [
  { href: "/", label: "nav.dashboard", icon: LayoutDashboard },
  { href: "/career-paths", label: "nav.careerPaths", icon: Map },
  { href: "/kpis", label: "nav.kpis", icon: Target },
  { href: "/evaluations", label: "nav.evaluations", icon: ClipboardCheck },
  { href: "/reports", label: "nav.reports", icon: FileBarChart },
  { href: "/bell-curve", label: "nav.bellCurve", icon: PieChart },
  { href: "/org-chart", label: "nav.orgChart", icon: Network },
  { href: "/admin", label: "nav.admin", icon: Settings },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, clear } = useIdentity();
  const { matrix, isLoading: permsLoading } = usePermissions();
  const { t, lang, setLang, dir } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const matrixLoaded = !permsLoading && Object.keys(matrix).length > 0;

  const navItems = NAV_ITEMS.filter((item) => {
    if (!user) return false;
    if (!matrixLoaded) return true;
    const resource = HREF_RESOURCE[item.href];
    if (!resource) return true;
    const rolePerms = matrix[user.role];
    if (!rolePerms) return false;
    const actions = rolePerms[resource];
    return actions && actions.includes("view");
  });

  const toggleDark = () => document.documentElement.classList.toggle("dark");

  // Sidebar nav content
  const navContent = (mobile?: boolean) => (
    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
      {navItems.map((item) => {
        const isActive =
          location === item.href ||
          (item.href !== "/" && location.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href}>
            <a
              className={`flex items-center gap-3 rounded-lg transition-all duration-200 ${
                collapsed && !mobile ? "justify-center px-3 py-3" : "px-4 py-2.5"
              } ${
                isActive
                  ? "bg-background text-sidebar-active font-semibold"
                  : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
              onClick={() => mobile && setMobileOpen(false)}
              title={collapsed && !mobile ? t(item.label) : undefined}
            >
              <div
                className={`flex items-center justify-center shrink-0 rounded-full ${
                  isActive
                    ? ""
                    : "bg-muted"
                } ${collapsed && !mobile ? "w-8 h-8" : "w-8 h-8"}`}
              >
                <item.icon className="w-4 h-4" />
              </div>
              {(!collapsed || mobile) && (
                <span className="text-sm whitespace-nowrap">{t(item.label)}</span>
              )}
            </a>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <aside
            className="absolute top-0 right-0 bottom-0 w-64 bg-sidebar flex flex-col shadow-xl animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile sidebar header */}
            <div className="h-14 flex items-center justify-center border-b border-border px-4">
              <h1 className="text-lg font-bold text-primary flex items-center gap-2">
                <Award className="w-6 h-6" />
                {t("brand.name")}
              </h1>
            </div>
            {navContent(true)}
          </aside>
        </div>
      )}

      {/* Desktop Sidebar — RIGHT side (RTL default) */}
      <aside
        className={`hidden md:flex flex-col bg-sidebar border-l border-border transition-all duration-300 ${
          collapsed ? "w-[72px]" : "w-56"
        }`}
      >
        {/* Sidebar top — brand area */}
        <div
          className={`h-14 flex items-center border-b border-border ${
            collapsed ? "justify-center px-2" : "px-5"
          }`}
        >
          {collapsed ? (
            <Award className="w-6 h-6 text-primary" />
          ) : (
            <h1 className="text-base font-bold text-primary flex items-center gap-2">
              <Award className="w-6 h-6" />
              {t("brand.name")}
            </h1>
          )}
        </div>

        {navContent()}

        {/* Collapse toggle */}
        <div className="border-t border-border p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-accent hover:text-accent-foreground transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? t("nav.openMenu") : t("nav.collapseMenu")}
          >
            {collapsed ? (
              <PanelRightOpen className="w-4 h-4" />
            ) : (
              <>
                <PanelRightClose className="w-4 h-4" />
                <span>{t("nav.collapseMenu")}</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header — always visible */}
        <header className="h-14 bg-card border-b border-border flex items-center justify-between px-5 shrink-0">
          {/* Right side: brand on mobile, breadcrumb area on desktop */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <span className="text-base font-semibold text-foreground hidden md:block">
              {t("brand.name")}
            </span>
            <span className="text-base font-semibold text-foreground md:hidden">
              {t("brand.name")}
            </span>
          </div>

          {/* Left side: user info + actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDark}
              title={t("nav.darkMode")}
              className="text-muted-foreground hover:text-foreground"
            >
              <Moon className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              title={t("nav.notifications")}
            >
              <Bell className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              title={t("nav.language")}
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            >
              <Globe className="w-4 h-4" />
              <span className="text-xs font-medium">{lang === "ar" ? "EN" : "AR"}</span>
            </Button>

            {/* Divider */}
            <div className="w-px h-6 bg-border mx-1" />

            {user && (
              <div className="flex items-center gap-3">
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-medium text-foreground leading-tight">
                    {user.name}
                  </div>
                  <div className="text-xs text-muted-foreground leading-tight">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </div>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="w-4 h-4" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clear}
                  title={t("nav.switchUser")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-5 md:p-7">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
