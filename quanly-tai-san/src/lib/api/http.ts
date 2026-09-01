import { api, API_BASE_URL } from "@/lib/auth/api";
import { ApiError } from "@/lib/auth/types";
import { loadAuth } from "@/lib/auth/storage";

/**
 * Ghép query string từ object, bỏ qua các giá trị null/undefined/"".
 */
export function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * Gửi multipart/form-data với Bearer token — dùng cho upload ảnh sau này.
 * Không set Content-Type để browser tự đặt boundary.
 */
export async function apiForm<T = unknown>(
  path: string,
  form: FormData,
  method: "POST" | "PUT" | "PATCH" = "POST",
): Promise<T> {
  const cur = loadAuth();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    body: form,
    headers: cur?.accessToken ? { Authorization: `Bearer ${cur.accessToken}` } : undefined,
  });
  if (!res.ok) {
    let problem: Record<string, unknown> = { status: res.status, title: res.statusText };
    try {
      problem = { ...problem, ...(await res.json()) };
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, problem);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return undefined as T;
  return (await res.json()) as T;
}

export { api };
