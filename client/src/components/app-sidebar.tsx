import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  CheckSquare,
  Target,
  Timer,
  BarChart3,
  FileText,
  Newspaper,
  CalendarDays,
  Zap,
} from "lucide-react";
import { useStore, getBerlinTime, getMarketSession } from "@/lib/store";
import { useState, useEffect } from "react";

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
  const [now, setNow] = useState(getBerlinTime());

  useEffect(() => {
    const interval = setInterval(() => setNow(getBerlinTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  const session = getMarketSession();
  const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const level = Math.floor(state.xp.totalXP / 100) + 1;
  const xpInLevel = state.xp.totalXP % 100;

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 flex-shrink-0">
            <div className="w-9 h-9 bg-primary rounded-md flex items-center justify-center p5-glow-sm">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-sm text-foreground tracking-wide">LIFE OS</div>
            <div className="text-xs text-muted-foreground font-mono">Persona Mode</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={item.testId}
                    >
                      <Link href={item.url}>
                        <div className={`flex items-center gap-3 w-full px-1 py-0.5 rounded-md transition-all ${isActive ? "text-primary" : "text-sidebar-foreground"}`}>
                          <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                          <span className={`font-display text-sm tracking-wide ${isActive ? "text-primary font-semibold" : ""}`}>
                            {item.title}
                          </span>
                          {isActive && (
                            <div className="ml-auto w-1 h-4 bg-primary rounded-full" />
                          )}
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

      <SidebarFooter className="p-3 border-t border-sidebar-border space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs text-muted-foreground">Уровень {level}</span>
            <span className="font-mono text-xs text-primary">{xpInLevel}/100 XP</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${xpInLevel}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground font-mono">{state.xp.totalXP} total XP</div>
        </div>

        <div className="bg-card border border-card-border rounded-md p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">Берлин</span>
            <span className="font-mono text-xs text-foreground">{timeStr}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">Сессия</span>
            <span className={`font-mono text-xs font-bold ${session.color}`}>{session.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">Стрик</span>
            <span className="font-mono text-xs text-orange-400 font-bold">{state.streak.currentStreak} дн.</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
