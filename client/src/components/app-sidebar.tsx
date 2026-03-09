import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, CheckSquare, Target, Timer,
  BarChart3, FileText, Newspaper, CalendarDays, Zap, LogOut,
} from "lucide-react";
import { useStore, getBerlinTime, getMarketSession } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useState, useEffect, memo } from "react";

const SidebarClock = memo(function SidebarClock() {
  const [now, setNow] = useState(getBerlinTime());
  const [session, setSession] = useState(getMarketSession());
  useEffect(() => {
    const id = setInterval(() => {
      setNow(getBerlinTime());
      setSession(getMarketSession());
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground font-mono truncate">{timeStr} UTC+1</div>
      <div className={`font-display font-bold truncate ${session.color}`}>{session.name}</div>
    </div>
  );
});

const navItems = [
  { title: "Главная", url: "/", icon: LayoutDashboard, testId: "nav-hub" },
  { title: "Задачи", url: "/tasks", icon: CheckSquare, testId: "nav-tasks" },
  { title: "Цели", url: "/goals", icon: Target, testId: "nav-goals" },
  { title: "Фокус", url: "/timer", icon: Timer, testId: "nav-timer" },
  { title: "Статистика", url: "/stats", icon: BarChart3, testId: "nav-stats" },
  { title: "Заметки", url: "/notes", icon: FileText, testId: "nav-notes" },
  { title: "Новости", url: "/news", icon: Newspaper, testId: "nav-news" },
  { title: "Календарь", url: "/calendar", icon: CalendarDays, testId: "nav-calendar" },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { state } = useStore();
  const { user, logout } = useAuth();

  const level = Math.floor(state.xp.totalXP / 100) + 1;
  const xpInLevel = state.xp.totalXP % 100;

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-sm text-foreground tracking-wide truncate">LIFE OS</div>
            <div className="text-xs text-muted-foreground font-mono truncate">Persona Mode</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} data-testid={item.testId}>
                      <Link href={item.url}>
                        <div className={`flex items-center gap-3 w-full px-1 py-0.5 rounded-md transition-all ${isActive ? "text-primary" : "text-sidebar-foreground"}`}>
                          <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                          <span className={`font-display text-sm tracking-wide truncate ${isActive ? "text-primary font-semibold" : ""}`}>
                            {item.title}
                          </span>
                          {isActive && <div className="ml-auto w-1 h-4 bg-primary rounded-full flex-shrink-0" />}
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border flex-shrink-0 p-3 space-y-2 overflow-hidden">
        <div className="space-y-1 overflow-hidden">
          <div className="flex items-center justify-between gap-1 overflow-hidden">
            <span className="font-display text-xs text-muted-foreground truncate">Ур. {level}</span>
            <span className="font-mono text-xs text-primary flex-shrink-0">{xpInLevel}/100</span>
          </div>
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${xpInLevel}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 text-[10px] sm:text-xs overflow-hidden leading-tight">
          <SidebarClock />
          <div className="text-right min-w-0">
            <div className="text-muted-foreground font-mono truncate">Стрик</div>
            <div className="font-mono font-bold text-orange-400 truncate">{state.streak.currentStreak}д</div>
          </div>
        </div>

        {user && (
          <div className="flex items-center justify-between gap-1 pt-1 border-t border-sidebar-border overflow-hidden">
            <span className="text-[10px] text-muted-foreground font-mono truncate flex-1" data-testid="text-user-email">
              {user.email}
            </span>
            <button
              onClick={logout}
              className="flex-shrink-0 p-1 rounded-md text-muted-foreground hover:text-red-400 transition-colors"
              title="Выйти"
              data-testid="button-logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
