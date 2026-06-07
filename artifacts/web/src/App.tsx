import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";

const Layout = lazy(() =>
  import("@/components/layout").then((m) => ({ default: m.Layout })),
);

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

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;
  if (!user) return <Login />;

  return (
    <Suspense fallback={<PageLoader />}>
      <Layout>
        <Component {...rest} />
      </Layout>
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {(params) => <ProtectedRoute component={Dashboard} params={params} />}
      </Route>
      <Route path="/jobs">
        {(params) => <ProtectedRoute component={Jobs} params={params} />}
      </Route>
      <Route path="/jobs/:id">
        {(params) => <ProtectedRoute component={JobProfile} params={params} />}
      </Route>
      <Route path="/competencies">
        {(params) => <ProtectedRoute component={Competencies} params={params} />}
      </Route>
      <Route path="/employees">
        {(params) => <ProtectedRoute component={Employees} params={params} />}
      </Route>
      <Route path="/grades">
        {(params) => <ProtectedRoute component={Grades} params={params} />}
      </Route>
      <Route path="/career-paths">
        {(params) => <ProtectedRoute component={CareerPaths} params={params} />}
      </Route>
      <Route path="/kpis">
        {(params) => <ProtectedRoute component={Kpis} params={params} />}
      </Route>
      <Route path="/kpis/:jobId">
        {(params) => <ProtectedRoute component={JobKpis} params={params} />}
      </Route>
      <Route path="/evaluations">
        {(params) => <ProtectedRoute component={Evaluations} params={params} />}
      </Route>
      <Route path="/evaluations/:id">
        {(params) => <ProtectedRoute component={EvaluationDetail} params={params} />}
      </Route>
      <Route path="/reports">
        {(params) => <ProtectedRoute component={Reports} params={params} />}
      </Route>
      <Route path="/bell-curve">
        {(params) => <ProtectedRoute component={BellCurve} params={params} />}
      </Route>
      <Route path="/org-chart">
        {(params) => <ProtectedRoute component={OrgChart} params={params} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
