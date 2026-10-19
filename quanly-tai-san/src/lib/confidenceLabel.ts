/** Máy chủ trả mức tin cậy "cao" / "trung bình" / "thấp"; giao diện nói "vừa" cho gọn và dễ hiểu. */
export function confidenceLabel(c: string): string {
  return c === "trung bình" ? "vừa" : c;
}
