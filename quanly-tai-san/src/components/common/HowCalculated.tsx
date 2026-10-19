import type { ReactNode } from "react";
import { Info } from "lucide-react";

/**
 * Mục gập "Cách KGS tính" — nơi duy nhất trên giao diện được nói về cách tính.
 *
 * Màn hình chính chỉ dùng lời đời thường; ai tò mò (hoặc giảng viên) bấm mở mục này để xem vì
 * sao con số được tính như vậy. Gập sẵn để không làm rối người chỉ cần kết quả.
 */
export function HowCalculated({
  children,
  title = "Cách KGS tính",
  className = "",
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <details className={`group text-xs text-muted-foreground ${className}`}>
      <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md py-1 font-medium hover:text-foreground">
        <Info className="h-3.5 w-3.5" />
        {title}
      </summary>
      <div className="mt-2 space-y-2 leading-relaxed">{children}</div>
    </details>
  );
}
