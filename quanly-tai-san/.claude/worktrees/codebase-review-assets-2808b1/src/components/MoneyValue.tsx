import { formatCurrency, formatVND } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type MoneyTone = "auto" | "income" | "expense" | "neutral";

interface MoneyValueProps {
  amount: number;
  /** compact=true → "8,5 tỷ"/"850 triệu" (kèm tooltip số đầy đủ). Mặc định false. */
  compact?: boolean;
  /**
   * auto (mặc định): màu theo dấu số — dương=xanh, âm=đỏ, 0=trung tính. Dùng cho số có ý nghĩa
   * lãi/lỗ (lợi nhuận, chênh lệch thu chi).
   * income/expense: ép màu xanh/đỏ bất kể dấu — dùng khi phân loại theo bản chất khoản mục
   * (VD: cột Thu luôn xanh, cột Chi luôn đỏ) chứ không theo dấu số nhập.
   * neutral: không tô màu ngữ nghĩa — dùng cho số tiền không mang ý nghĩa tốt/xấu (giá bán,
   * tiền thuê, giá trị tài sản).
   */
  tone?: MoneyTone;
  /** Hiện dấu +/- rõ ràng trước số — dùng ở cột "Số tiền" gộp thu/chi trong 1 cột (Sổ thu chi). */
  showSign?: boolean;
  className?: string;
}

export function MoneyValue({
  amount,
  compact = false,
  tone = "auto",
  showSign = false,
  className,
}: MoneyValueProps) {
  const resolvedTone: Exclude<MoneyTone, "auto"> =
    tone === "auto" ? (amount > 0 ? "income" : amount < 0 ? "expense" : "neutral") : tone;

  const colorClass =
    resolvedTone === "income"
      ? "text-success"
      : resolvedTone === "expense"
        ? "text-destructive"
        : "";

  const signPrefix = showSign ? (amount > 0 ? "+ " : amount < 0 ? "− " : "") : "";
  const text = `${signPrefix}${formatCurrency(Math.abs(amount), { compact })}`;

  const el = <span className={cn(colorClass, "font-medium tabular-nums", className)}>{text}</span>;

  if (!compact) return el;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{el}</TooltipTrigger>
        <TooltipContent>{formatVND(amount)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
