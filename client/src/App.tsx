import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import Home from "./pages/Home";
import Chats from "./pages/Chats";
import KnowledgeBase from "./pages/KnowledgeBase";
import Workspaces from "./pages/Workspaces";
import Analytics from "./pages/Analytics";
import BrainStats from "./pages/BrainStats";
import DashboardLayout from "./components/DashboardLayout";

function AuthenticatedRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/dashboard" component={() => <Redirect to="/chats" />} />
        <Route path="/chats" component={Chats} />
        <Route path="/chats/:prospectId" component={Chats} />
        <Route path="/knowledge-base" component={KnowledgeBase} />
        <Route path="/workspaces" component={Workspaces} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/brain" component={BrainStats} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={AuthenticatedRoutes} />
      <Route path="/chats" component={AuthenticatedRoutes} />
      <Route path="/chats/:prospectId" component={AuthenticatedRoutes} />
      <Route path="/knowledge-base" component={AuthenticatedRoutes} />
      <Route path="/workspaces" component={AuthenticatedRoutes} />
      <Route path="/analytics" component={AuthenticatedRoutes} />
      <Route path="/brain" component={AuthenticatedRoutes} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
          <PWAInstallPrompt />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
