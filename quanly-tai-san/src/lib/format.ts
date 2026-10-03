export function formatVND(amount: number): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "0 ₫";
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + " ₫";
}

/** "8,5" từ 8.5, "850" từ 850 — 1 chữ số thập phân, bỏ .0 thừa, dấu phẩy kiểu VN. */
function trimDecimal(v: number): string {
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
}

/**
 * Format tiền VNĐ dùng chung toàn app.
 * compact=false (mặc định): "8.500.000.000 ₫" — giống formatVND, dùng ở bảng/chi tiết cần chính xác.
 * compact=true: "8,5 tỷ" / "850 triệu" / số đầy đủ nếu <1 triệu — dùng ở thẻ thống kê, biểu đồ.
 */
export function formatCurrency(amount: number, options?: { compact?: boolean }): string {
  if (amount === null || amount === undefined || isNaN(amount)) return formatVND(0);
  if (!options?.compact) return formatVND(amount);

  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${trimDecimal(abs / 1_000_000_000)} tỷ`;
  if (abs >= 1_000_000) return `${sign}${trimDecimal(abs / 1_000_000)} triệu`;
  return formatVND(amount);
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)} ${hh}:${mi}`;
}

export function daysUntil(iso: string | Date): number {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diff = d.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function monthKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước"; quá 7 ngày thì ghi ngày. */
export function timeAgo(iso: string | Date): string {
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "vừa xong";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.round(h / 24);
  if (d <= 7) return `${d} ngày trước`;
  return formatDate(iso);
}
