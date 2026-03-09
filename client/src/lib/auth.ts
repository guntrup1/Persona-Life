import { useState, useEffect, createContext, useContext, createElement, type ReactNode } from "react";

export interface AuthUser {
  id: number;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ data?: unknown; error?: string }>;
  register: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleServerSave(stateData: unknown) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await fetch("/api/user/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ data: stateData }),
      });
    } catch {
    }
  }, 2500);
}

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const json = await res.json();
    return json.user || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children, onLogin }: { children: ReactNode; onLogin: (data: unknown) => void }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMe().then(async (u) => {
      if (u) {
        try {
          const res = await fetch("/api/user/data", { credentials: "include" });
          if (res.ok) {
            const json = await res.json();
            if (json.data && typeof json.data === "object" && Object.keys(json.data).length > 2) {
              onLogin(json.data);
            }
          }
        } catch {}
      }
      setUser(u);
      setLoading(false);
    });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.message };
    setUser({ id: json.id, email: json.email });
    if (json.data) onLogin(json.data);
    return { data: json.data };
  };

  const register = async (email: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.message };
    setUser({ id: json.id, email: json.email });
    return {};
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    localStorage.removeItem("lifeos_v2");
    window.location.reload();
  };

  return createElement(AuthContext.Provider, { value: { user, loading, login, register, logout } }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
