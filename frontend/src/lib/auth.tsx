"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { AUTH_MODE, mockUserId, setMockUser } from "./session";
import type { User } from "./types";

interface AuthCtx {
  user: User | null; loading: boolean;
  login(email: string, password: string): Promise<void>;
  signup(email: string, password: string, name: string): Promise<{ needsConfirm: boolean }>;
  confirm(email: string, code: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
}
const Ctx = createContext<AuthCtx>(null as never);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { setUser(await api<User>("/auth/me")); } catch { setUser(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (AUTH_MODE === "mock" && !mockUserId()) { setLoading(false); return; } refresh(); }, [refresh]);

  const value: AuthCtx = {
    user, loading, refresh,
    async login(email, password) {
      if (AUTH_MODE === "mock") {
        const u = await api<User>("/auth/mock-login", { method: "POST", json: { email } });
        setMockUser(u.id);
      } else { await (await import("./cognito")).signIn(email, password); }
      await refresh();
    },
    async signup(email, password, name) {
      if (AUTH_MODE === "mock") {
        const u = await api<User>("/auth/mock-login", { method: "POST", json: { email, name } });
        setMockUser(u.id); await refresh(); return { needsConfirm: false };
      }
      await (await import("./cognito")).signUp(email, password, name);
      return { needsConfirm: true };
    },
    async confirm(email, code, password) {
      const c = await import("./cognito");
      await c.confirmSignUp(email, code); await c.signIn(email, password); await refresh();
    },
    async logout() {
      if (AUTH_MODE === "mock") setMockUser(null); else (await import("./cognito")).signOut();
      setUser(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
