import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { OrgProvider, useOrg } from "@/lib/org-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { KeyboardShortcutsProvider } from "@/lib/keyboard-shortcuts";
import { PresentationModeProvider } from "@/lib/presentation-mode";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import { CommandPaletteProvider } from "@/components/command-palette";
import { useListOrganizations } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { setAcceptLanguage } from "@workspace/api-client-react";

import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import OrgChart from "@/pages/org-chart";
import OpenPositions from "@/pages/open-positions";
import Employees from "@/pages/employees";
import Offboarding from "@/pages/offboarding";
import EmployeeTimeline from "@/pages/employee-timeline";
import Departments from "@/pages/departments";
import Administrations from "@/pages/administrations";
import Settings from "@/pages/settings";
import Security from "@/pages/security";
import OrgSpace from "@/pages/org-space";
import Reports from "@/pages/reports";
import Leave from "@/pages/leave";
import Analytics from "@/pages/analytics";
import Suggestions from "@/pages/suggestions";
import Audit from "@/pages/audit";
import Snapshots from "@/pages/snapshots";
import Themes from "@/pages/themes";
import CreateOrg from "@/pages/create-org";
import AdminTemplates from "@/pages/admin-templates";
import AdminWhatsNew from "@/pages/admin-whats-new";
import AdminActivity from "@/pages/admin-activity";
import WhatsNew from "@/pages/whats-new";
import WhatsNewPopover from "@/components/whats-new-popover";
import Welcome from "@/pages/welcome";
import Login from "@/pages/login";
import AcceptInvite from "@/pages/accept-invite";
import ShareView from "@/pages/share-view";
import EmbedView from "@/pages/embed-view";
import SSORedirect from "@/pages/sso-redirect";
import { useEffect } from "react";

const queryClient = new QueryClient();

function AppContent() {
  const { user, isLoading: authLoading, isAuthenticated, setActiveOrgId } = useAuth();
  const { data: orgs, isLoading } = useListOrganizations({
    query: { enabled: isAuthenticated, queryKey: ["organizations", isAuthenticated] as const },
  });
  const { selectedOrgId, setSelectedOrgId } = useOrg();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    setActiveOrgId(selectedOrgId);
  }, [selectedOrgId, setActiveOrgId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (location === "/accept-invite" || location.startsWith("/share/") || location.startsWith("/embed/") || location.startsWith("/sso/")) return;
    if (user?.mustEnable2FA && location !== "/security") {
      setLocation("/security");
      return;
    }
    if (user?.mustChangePassword && location !== "/security") {
      setLocation("/security");
    }
  }, [user?.mustEnable2FA, user?.mustChangePassword, isAuthenticated, location, setLocation]);

  useEffect(() => {
    if (user?.mustEnable2FA || user?.mustChangePassword) return;
    if (!isLoading && orgs && isAuthenticated) {
      if (orgs.length === 0) {
        if (location !== "/welcome" && location !== "/create-org") {
          setLocation("/welcome");
        }
      } else if (!selectedOrgId && orgs.length > 0) {
        setSelectedOrgId(orgs[0].id);
        if (location === "/welcome" || location === "/create-org") {
          setLocation("/");
        }
      } else if (selectedOrgId && !orgs.find(o => o.id === selectedOrgId)) {
        setSelectedOrgId(orgs[0].id);
      }
    }
  }, [orgs, isLoading, selectedOrgId, setSelectedOrgId, location, setLocation, isAuthenticated]);

  if (location === "/accept-invite") {
    return <AcceptInvite />;
  }

  if (location.startsWith("/share/")) {
    return <ShareView />;
  }

  if (location.startsWith("/embed/")) {
    return <EmbedView />;
  }

  if (location.startsWith("/sso/")) {
    return <SSORedirect />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if ((user?.mustEnable2FA || user?.mustChangePassword) && location !== "/security") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const forcedCompliance = !!(user?.mustEnable2FA || user?.mustChangePassword);

  if (!forcedCompliance && !isLoading && (orgs?.length === 0 || location === "/welcome" || location === "/create-org")) {
    if (location === "/create-org") {
      return <CreateOrg />;
    }
    return <Welcome />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/org-space" component={OrgSpace} />
        <Route path="/org-chart" component={OrgChart} />
        <Route path="/open-positions" component={OpenPositions} />
        <Route path="/employees" component={Employees} />
        <Route path="/employees/:id/timeline" component={EmployeeTimeline} />
        <Route path="/offboarding" component={Offboarding} />
        <Route path="/departments" component={Departments} />
        <Route path="/administrations" component={Administrations} />
        <Route path="/reports" component={Reports} />
        <Route path="/leave" component={Leave} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/suggestions" component={Suggestions} />
        <Route path="/audit" component={Audit} />
        <Route path="/snapshots" component={Snapshots} />
        <Route path="/themes" component={Themes} />
        <Route path="/settings" component={Settings} />
        <Route path="/security" component={Security} />
        <Route path="/admin/templates" component={AdminTemplates} />
        <Route path="/admin/whats-new" component={AdminWhatsNew} />
        <Route path="/admin/activity" component={AdminActivity} />
        <Route path="/whats-new" component={WhatsNew} />
        <Route component={NotFound} />
      </Switch>
      <WhatsNewPopover />
    </Layout>
  );
}

function App() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
    setAcceptLanguage(i18n.language);
  }, [isRtl, i18n.language]);

  return (
    <div dir={isRtl ? "rtl" : "ltr"}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <OrgProvider>
              <KeyboardShortcutsProvider>
                <PresentationModeProvider>
                  <CommandPaletteProvider>
                    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                      <AppContent />
                    </WouterRouter>
                    <KeyboardShortcutsDialog />
                  </CommandPaletteProvider>
                </PresentationModeProvider>
              </KeyboardShortcutsProvider>
            </OrgProvider>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
