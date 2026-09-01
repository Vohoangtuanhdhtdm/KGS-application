import type { AuthResponse } from "./types";

const STORAGE_KEY = "qltx.auth";

// NOTE (prototype): lưu token trong localStorage cho đơn giản.
// Production nên cân nhắc HttpOnly cookie để chống XSS.
export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  roles: string[];
  emailConfirmed: boolean;
}

export function loadAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function saveAuth(a: AuthResponse) {
  if (typeof window === "undefined") return;
  const data: StoredAuth = {
    accessToken: a.accessToken,
    refreshToken: a.refreshToken,
    accessTokenExpiresAt: a.accessTokenExpiresAt,
    refreshTokenExpiresAt: a.refreshTokenExpiresAt,
    userId: a.userId,
    email: a.email,
    name: a.name,
    avatarUrl: a.avatarUrl,
    roles: a.roles || [],
    emailConfirmed: a.emailConfirmed,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function patchAuth(patch: Partial<StoredAuth>) {
  const cur = loadAuth();
  if (!cur) return;
  const next = { ...cur, ...patch };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
