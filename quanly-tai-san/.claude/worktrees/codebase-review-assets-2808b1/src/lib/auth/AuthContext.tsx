import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { clearAuth, loadAuth, saveAuth } from "./storage";
import type { AuthResponse, AuthUser } from "./types";

interface AuthCtx {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithExternalProvider: (provider: "Google", token: string) => Promise<void>;
  register: (input: {
    email: string;
    name: string;
    password: string;
    phoneNumber?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyAuth = useCallback((r: AuthResponse) => {
    saveAuth(r);
    setUser({
      userId: r.userId,
      email: r.email,
      name: r.name,
      avatarUrl: r.avatarUrl,
      roles: r.roles || [],
      emailConfirmed: r.emailConfirmed,
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api<AuthUser>("/account/me");
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const stored = loadAuth();
    if (!stored) {
      setIsLoading(false);
      return;
    }
    // Optimistic: dùng dữ liệu localStorage, sau đó xác thực lại
    setUser({
      userId: stored.userId,
      email: stored.email,
      name: stored.name,
      avatarUrl: stored.avatarUrl,
      roles: stored.roles,
      emailConfirmed: stored.emailConfirmed,
    });
    (async () => {
      try {
        const me = await api<AuthUser>("/account/me");
        setUser(me);
      } catch {
        clearAuth();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api<AuthResponse>("/account/login", {
        method: "POST",
        body: { email, password },
      });
      applyAuth(r);
    },
    [applyAuth],
  );

  // Đăng nhập qua provider ngoài (Google) — dùng chung applyAuth với login thường
  const loginWithExternalProvider = useCallback(
    async (provider: "Google", token: string) => {
      const r = await api<AuthResponse>("/account/external-login", {
        method: "POST",
        body: { provider, token },
      });
      applyAuth(r);
    },
    [applyAuth],
  );

  const register = useCallback(
    async (input: { email: string; name: string; password: string; phoneNumber?: string }) => {
      const r = await api<AuthResponse>("/account/register", { method: "POST", body: input });
      applyAuth(r);
    },
    [applyAuth],
  );

  const logout = useCallback(async () => {
    const cur = loadAuth();
    try {
      if (cur?.refreshToken) {
        await api("/account/logout", {
          method: "POST",
          body: { refreshToken: cur.refreshToken },
          skipAuth: true,
        });
      }
    } catch {
      /* ignore */
    } finally {
      clearAuth();
      setUser(null);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await api("/account/logout-all", { method: "POST" });
    } finally {
      clearAuth();
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }, []);

  const value: AuthCtx = {
    user,
    isAuthenticated: !!user,
    isAdmin: !!user?.roles?.includes("Admin"),
    isLoading,
    login,
    loginWithExternalProvider,
    register,
    logout,
    logoutAll,
    refreshUser,
    updateUser,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth phải dùng trong <AuthProvider>");
  return c;
}
