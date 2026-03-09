import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import HubPage from "@/pages/hub";
import TasksPage from "@/pages/tasks";
import GoalsPage from "@/pages/goals";
import TimerPage from "@/pages/timer";
import StatsPage from "@/pages/stats";
import NotesPage from "@/pages/notes";
import NewsPage from "@/pages/news";
import CalendarPage from "@/pages/calendar-page";
import LoginPage from "@/pages/login";
import { AuthProvider, useAuth } from "@/lib/auth";
import { loadFromServerData } from "@/lib/store";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HubPage} />
      <Route path="/tasks" component={TasksPage} />
      <Route path="/goals" component={GoalsPage} />
      <Route path="/timer" component={TimerPage} />
      <Route path="/stats" component={StatsPage} />
      <Route path="/notes" component={NotesPage} />
      <Route path="/news" component={NewsPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-5xl animate-bounce">🎭</div>
          <p className="font-display text-sm text-muted-foreground uppercase tracking-widest">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const sidebarStyle = {
    "--sidebar-width": "13rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="flex items-center gap-2 px-3 py-2 border-b border-border flex-shrink-0 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
            <SidebarTrigger
              data-testid="button-sidebar-toggle"
              className="text-muted-foreground h-9 w-9 flex-shrink-0"
            />
            <div className="h-4 w-px bg-border" />
            <span className="font-display text-xs text-muted-foreground tracking-widest uppercase truncate">
              Life Operating System
            </span>
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  const handleLogin = (data: unknown) => {
    if (data && typeof data === "object" && Object.keys(data as object).length > 2) {
      loadFromServerData(data as Parameters<typeof loadFromServerData>[0]);
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider onLogin={handleLogin}>
          <AppShell />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
