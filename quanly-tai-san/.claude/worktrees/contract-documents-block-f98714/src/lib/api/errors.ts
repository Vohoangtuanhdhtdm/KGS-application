import { ApiError } from "@/lib/auth/types";

/**
 * Lấy thông điệp lỗi ưu tiên `detail` (backend đã viết tiếng Việt).
 */
export function getErrorMessage(err: unknown, fallback = "Đã có lỗi xảy ra"): string {
  if (err instanceof ApiError) return err.detail || err.problem?.title || fallback;
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string") return err;
  return fallback;
}

/**
 * Trả về map { field -> messages[] } từ ProblemDetails.errors (nếu có).
 */
export function getFieldErrors(err: unknown): Record<string, string[]> | null {
  if (err instanceof ApiError && err.problem?.errors) return err.problem.errors;
  return null;
}

export function isConflict(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409;
}
