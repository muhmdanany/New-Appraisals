import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Jobs from "@/pages/jobs";
import JobProfile from "@/pages/jobs/profile";
import Competencies from "@/pages/competencies";
import Employees from "@/pages/employees";
import Grades from "@/pages/grades";
import CareerPaths from "@/pages/career-paths";
import Kpis from "@/pages/kpis";
import JobKpis from "@/pages/kpis/view";
import Evaluations from "@/pages/evaluations";
import EvaluationDetail from "@/pages/evaluations/detail";
import Reports from "@/pages/reports";
import BellCurve from "@/pages/bell-curve";
import OrgChart from "@/pages/org-chart";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>;
  if (!user) return <Login />;
  
  return (
    <Layout>
      <Component {...rest} />
    </Layout>
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
