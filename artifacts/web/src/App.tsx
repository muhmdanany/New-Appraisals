import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { IdentityProvider, useIdentity } from "@/lib/identity";
import SelectUser from "@/pages/select-user";
import NotFound from "@/pages/not-found";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const Jobs = lazy(() => import("@/pages/jobs"));
const JobProfile = lazy(() => import("@/pages/jobs/profile"));
const Competencies = lazy(() => import("@/pages/competencies"));
const Employees = lazy(() => import("@/pages/employees"));
const Grades = lazy(() => import("@/pages/grades"));
const CareerPaths = lazy(() => import("@/pages/career-paths"));
const Kpis = lazy(() => import("@/pages/kpis"));
const JobKpis = lazy(() => import("@/pages/kpis/view"));
const Evaluations = lazy(() => import("@/pages/evaluations"));
const EvaluationDetail = lazy(() => import("@/pages/evaluations/detail"));
const Reports = lazy(() => import("@/pages/reports"));
const BellCurve = lazy(() => import("@/pages/bell-curve"));
const OrgChart = lazy(() => import("@/pages/org-chart"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      جاري التحميل...
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/jobs/:id" component={JobProfile} />
      <Route path="/competencies" component={Competencies} />
      <Route path="/employees" component={Employees} />
      <Route path="/grades" component={Grades} />
      <Route path="/career-paths" component={CareerPaths} />
      <Route path="/kpis" component={Kpis} />
      <Route path="/kpis/:jobId" component={JobKpis} />
      <Route path="/evaluations" component={Evaluations} />
      <Route path="/evaluations/:id" component={EvaluationDetail} />
      <Route path="/reports" component={Reports} />
      <Route path="/bell-curve" component={BellCurve} />
      <Route path="/org-chart" component={OrgChart} />
      <Route component={NotFound} />
    </Switch>
  );
}

function IdentityGate() {
  const { userId, user, users, isLoading } = useIdentity();

  // No identity chosen yet, or a stored id that no longer matches any user.
  if (!userId || (!isLoading && users.length > 0 && !user)) {
    return <SelectUser />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Layout>
        <Router />
      </Layout>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <IdentityProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <IdentityGate />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </IdentityProvider>
    </QueryClientProvider>
  );
}

export default App;
