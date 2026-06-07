import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useListOrganizations } from "@workspace/api-client-react";
import { useOrg } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import { useKeyboardShortcuts } from "@/lib/keyboard-shortcuts";
import { usePresentationMode } from "@/lib/presentation-mode";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Network,
  Users,
  Building2,
  Landmark,
  Settings,
  PlusCircle,
  Building,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  ClipboardList,
  ShieldCheck,
  BarChart3,
  Palette,
  Keyboard,
  Briefcase,
  Camera,
  Menu,
  Lightbulb,
  Sparkles,
  CalendarOff,
} from "lucide-react";
import { useGetWhatsNewUnreadCount, getGetWhatsNewUnreadCountQueryKey } from "@workspace/api-client-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import NotificationsBell from "@/components/notifications-bell";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const { data: orgs, isLoading } = useListOrganizations();
  const { selectedOrgId, setSelectedOrgId } = useOrg();
  const { user, logout, hasPermission } = useAuth();
  const { data: whatsNewUnread } = useGetWhatsNewUnreadCount({
    query: {
      queryKey: getGetWhatsNewUnreadCountQueryKey(),
      enabled: !!user,
      refetchOnWindowFocus: false,
    },
  });
  const whatsNewBadge = whatsNewUnread?.count ?? 0;
  const { open: openShortcuts } = useKeyboardShortcuts();
  const { active: presentationActive } = usePresentationMode();
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return true;
    return localStorage.getItem("orgchart-sidebar-collapsed") === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("orgchart-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setCollapsed(true);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  const navItems = [
    { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard, tooltip: t("tooltips.dashboard") },
    { href: "/org-space", label: t("nav.orgSpace"), icon: Home, tooltip: t("tooltips.orgSpace") },
    { href: "/org-chart", label: t("nav.orgChart"), icon: Network, tooltip: t("tooltips.orgChart") },
    { href: "/open-positions", label: t("nav.openPositions"), icon: Briefcase, tooltip: t("tooltips.openPositions") },
    { href: "/employees", label: t("nav.employees"), icon: Users, tooltip: t("tooltips.employees") },
    { href: "/departments", label: t("nav.departments"), icon: Building2, tooltip: t("tooltips.departments") },
    { href: "/administrations", label: t("nav.administrations"), icon: Landmark, tooltip: t("tooltips.administrations") },
    { href: "/reports", label: t("nav.reports"), icon: ClipboardList, tooltip: t("tooltips.reports") },
    ...(hasPermission("leaves", "view")
      ? [{ href: "/leave", label: t("nav.leave"), icon: CalendarOff, tooltip: t("leave.subtitle") }]
      : []),
    ...(hasPermission("analytics", "view")
      ? [{ href: "/analytics", label: t("nav.analytics"), icon: BarChart3, tooltip: t("analytics.subtitle") }]
      : []),
    { href: "/suggestions", label: t("nav.suggestions"), icon: Lightbulb, tooltip: t("tooltips.suggestions") },
    ...(hasPermission("audit", "view")
      ? [{ href: "/audit", label: t("audit.title"), icon: ShieldCheck, tooltip: t("audit.subtitle") }]
      : []),
    ...(hasPermission("snapshots", "view")
      ? [{ href: "/snapshots", label: t("snapshots.title"), icon: Camera, tooltip: t("snapshots.subtitle") }]
      : []),
    ...(hasPermission("themes", "view") || hasPermission("themes", "edit")
      ? [{ href: "/themes", label: t("themes.title"), icon: Palette, tooltip: t("themes.subtitle") }]
      : []),
    { href: "/security", label: t("nav.security"), icon: ShieldCheck, tooltip: t("tooltips.security") },
    { href: "/whats-new", label: t("whatsNew.navLabel"), icon: Sparkles, tooltip: t("whatsNew.subtitle"), showWhatsNewBadge: true },
    { href: "/settings", label: t("nav.settings"), icon: Settings, tooltip: t("tooltips.settings") },
    ...(user?.isSystemAdmin
      ? [
          { href: "/admin/activity", label: t("nav.adminActivity"), icon: ShieldCheck, tooltip: t("adminActivity.subtitle") },
          { href: "/admin/templates", label: t("nav.adminTemplates"), icon: ShieldCheck, tooltip: t("nav.adminTemplates") },
          { href: "/admin/whats-new", label: t("nav.adminWhatsNew"), icon: Sparkles, tooltip: t("nav.adminWhatsNew") },
        ]
      : []),
  ];

  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  const currentOrgRole = user?.roles?.find(
    (r) => r.organizationId === selectedOrgId
  );

  const tooltipSide = i18n.language === "ar" ? "left" : "right";

  const renderSidebarContent = (mode: "desktop" | "mobile") => {
    const isCollapsed = mode === "desktop" ? collapsed : false;
    const closeMobile = () => {
      if (mode === "mobile") setMobileOpen(false);
    };
    return (
      <>
        <div className="p-4 border-b border-border h-16 flex items-center justify-between gap-2">
          {!isCollapsed && (
            <div className="flex items-center gap-2 font-bold text-lg text-sidebar-foreground min-w-0">
              <Building className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="truncate">{t("common.appName")}</span>
            </div>
          )}
          <div className={`flex items-center gap-1 ${isCollapsed ? "mx-auto" : ""}`}>
            {!isCollapsed && (
              <>
                <NotificationsBell tooltipSide={tooltipSide} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={openShortcuts}
                      data-testid="button-keyboard-shortcuts"
                      aria-label={t("shortcuts.openButton")}
                    >
                      <Keyboard className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("shortcuts.openTooltip")}</TooltipContent>
                </Tooltip>
              </>
            )}
            {mode === "desktop" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setCollapsed(!collapsed)}
                    data-testid="button-toggle-sidebar"
                  >
                    {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={tooltipSide}>
                  {collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {!isCollapsed && (
          <div className="p-4 border-b border-border">
            <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
              {t("sidebar.organization")}
            </div>
            {!isLoading && orgs && (
              <Select
                value={selectedOrgId?.toString()}
                onValueChange={(val) => {
                  if (val === "new") {
                    setLocation("/create-org");
                  } else {
                    setSelectedOrgId(parseInt(val, 10));
                    setLocation("/");
                  }
                  closeMobile();
                }}
              >
                <SelectTrigger className="w-full bg-background border-border">
                  <SelectValue placeholder={t("sidebar.selectOrganization")} />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((org) => (
                    <SelectItem key={org.id} value={org.id.toString()}>
                      {org.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="new" className="text-primary font-medium">
                    <span className="flex items-center gap-2">
                      <PlusCircle className="h-4 w-4" /> {t("sidebar.createNew")}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <nav className={`flex-1 overflow-y-auto ${isCollapsed ? "p-2" : "p-3"} space-y-1`}>
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link href={item.href} onClick={closeMobile}>
                    <div
                      className={`relative flex items-center ${isCollapsed ? "justify-center" : "gap-3"} px-3 py-2.5 rounded-md transition-colors cursor-pointer text-sm font-medium ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {!isCollapsed && <span className="flex-1">{item.label}</span>}
                      {(item as { showWhatsNewBadge?: boolean }).showWhatsNewBadge && whatsNewBadge > 0 && (
                        <span
                          className={`${isCollapsed ? "absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-rose-500" : "ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white"}`}
                          data-testid="badge-whats-new-unread"
                        >
                          {isCollapsed ? "" : whatsNewBadge}
                        </span>
                      )}
                    </div>
                  </Link>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side={tooltipSide}>
                    {item.label}
                  </TooltipContent>
                )}
                {!isCollapsed && (
                  <TooltipContent side={tooltipSide}>
                    {item.tooltip}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </nav>

        <div className={`border-t border-border ${isCollapsed ? "p-2" : "p-4"}`}>
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <NotificationsBell collapsed tooltipSide={tooltipSide} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={openShortcuts}
                    data-testid="button-keyboard-shortcuts-collapsed"
                    aria-label={t("shortcuts.openButton")}
                  >
                    <Keyboard className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={tooltipSide}>{t("shortcuts.openTooltip")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm cursor-default">
                    {initials}
                  </div>
                </TooltipTrigger>
                <TooltipContent side={tooltipSide}>
                  {user?.name || t("sidebar.user")}
                  {currentOrgRole ? ` — ${currentOrgRole.name}` : ""}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={tooltipSide}>{t("tooltips.signOut")}</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.name || t("sidebar.user")}
                </div>
                {currentOrgRole && (
                  <div className="text-xs text-muted-foreground truncate">
                    {currentOrgRole.name}
                  </div>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("tooltips.signOut")}</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </>
    );
  };

  const sheetSide = i18n.language === "ar" ? "right" : "left";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {!presentationActive && (
        <aside
          className={`hidden md:flex flex-shrink-0 border-e border-border bg-sidebar flex-col transition-all duration-300 ${
            collapsed ? "w-[68px]" : "w-64"
          }`}
        >
          {renderSidebarContent("desktop")}
        </aside>
      )}

      {!presentationActive && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side={sheetSide}
            className="w-64 p-0 bg-sidebar flex flex-col [&>button]:hidden"
            data-testid="sheet-mobile-sidebar"
          >
            <SheetTitle className="sr-only">{t("sidebar.navigation")}</SheetTitle>
            {renderSidebarContent("mobile")}
          </SheetContent>
        </Sheet>
      )}

      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <div className={`${presentationActive ? "hidden" : "md:hidden"} flex items-center justify-between gap-2 h-14 px-3 border-b border-border bg-background flex-shrink-0`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setMobileOpen(true)}
            aria-label={t("sidebar.openMenu")}
            data-testid="button-open-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 font-semibold text-sm text-foreground min-w-0">
            <Building className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="truncate">{t("common.appName")}</span>
          </div>
          <NotificationsBell tooltipSide="bottom" />
        </div>
        {children}
      </main>
    </div>
  );
}
