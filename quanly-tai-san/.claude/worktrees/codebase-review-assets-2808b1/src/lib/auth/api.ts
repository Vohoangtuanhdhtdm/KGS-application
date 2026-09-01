import { ApiError, type AuthResponse, type ProblemDetails } from "./types";
import { clearAuth, loadAuth, saveAuth } from "./storage";
import { isPublicPath } from "@/lib/publicPaths";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "https://localhost:7129/api";

const ANONYMOUS_PATHS = [
  "/account/register",
  "/account/login",
  "/account/refresh",
  "/account/forgot-password",
  "/account/reset-password",
  "/account/confirm-email",
  "/account/resend-confirmation",
];

function isAnonymous(path: string) {
  return ANONYMOUS_PATHS.some((p) => path.startsWith(p));
}

// ---- Refresh queue (một lần refresh duy nhất tại một thời điểm) ----
let isRefreshing = false;
let pending: Array<(token: string | null) => void> = [];

function subscribe(cb: (token: string | null) => void) {
  pending.push(cb);
}
function publish(token: string | null) {
  const list = pending;
  pending = [];
  list.forEach((cb) => cb(token));
}

async function doRefresh(): Promise<string | null> {
  const cur = loadAuth();
  if (!cur?.refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/account/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: cur.refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AuthResponse;
    saveAuth(data);
    return data.accessToken;
  } catch {
    return null;
  }
}

async function refreshOnce(): Promise<string | null> {
  if (isRefreshing) {
    return new Promise((resolve) => subscribe(resolve));
  }
  isRefreshing = true;
  try {
    const token = await doRefresh();
    publish(token);
    return token;
  } finally {
    isRefreshing = false;
  }
}

function shouldPreemptRefresh(): boolean {
  const cur = loadAuth();
  if (!cur?.accessTokenExpiresAt) return false;
  const exp = new Date(cur.accessTokenExpiresAt).getTime();
  return exp - Date.now() < 2 * 60 * 1000; // < 2 phút
}

async function parseError(res: Response): Promise<ApiError> {
  let problem: ProblemDetails = { status: res.status, title: res.statusText };
  try {
    const data = await res.json();
    problem = { ...problem, ...data };
  } catch {
    /* ignore */
  }
  return new ApiError(res.status, problem);
}

export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean; // ép buộc gắn Bearer token
  skipAuth?: boolean; // ép buộc bỏ Bearer token
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { body, auth, skipAuth, headers, ...rest } = opts;
  const attachAuth = skipAuth ? false : (auth ?? !isAnonymous(path));

  // Chủ động refresh trước khi hết hạn
  if (attachAuth && shouldPreemptRefresh()) {
    await refreshOnce();
  }

  const makeInit = (token: string | null): RequestInit => {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(headers as Record<string, string> | undefined),
    };
    if (attachAuth && token) h.Authorization = `Bearer ${token}`;
    return {
      ...rest,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
    };
  };

  const cur = loadAuth();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, makeInit(cur?.accessToken ?? null));
  } catch (e) {
    throw new ApiError(0, {
      status: 0,
      title: "Không kết nối được máy chủ",
      detail:
        "Không thể kết nối tới máy chủ. Nếu đang dev, hãy mở https://localhost:7129/swagger một lần để chấp nhận chứng chỉ tự ký.",
    });
  }

  if (res.status === 401 && attachAuth && !path.startsWith("/account/refresh")) {
    const newToken = await refreshOnce();
    if (newToken) {
      res = await fetch(`${API_BASE}${path}`, makeInit(newToken));
    } else {
      clearAuth();
      // Không ép chuyển hướng khỏi trang công khai (VD: /tin-dang) — phiên hết hạn
      // của một request nền (như bootstrap /account/me) không có nghĩa là khách
      // đang xem trang công khai cần đăng nhập. AuthContext tự set user=null và
      // trang công khai vẫn hiển thị bình thường ở chế độ khách.
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login") &&
        !isPublicPath(window.location.pathname)
      ) {
        const redirect = window.location.pathname + window.location.search;
        window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
      }
      throw await parseError(res);
    }
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return undefined as T;
  return (await res.json()) as T;
}

export const API_BASE_URL = API_BASE;
