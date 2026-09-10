import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Nhãn.
 *
 * Nhãn là thứ ĐỌC chứ không phải thứ bấm, nên bỏ đổ bóng và hạ font-semibold xuống medium:
 * chữ 12px in đậm đặc trên nền màu đọc nặng nề, mà nhãn thì xuất hiện dày đặc trên các thẻ
 * tin đăng. Thêm biến thể `price` cho con số tiền — vai trò riêng, màu riêng, theo đúng
 * quy ước "mỗi màu một việc" của bảng token.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        price: "border-transparent bg-price-soft text-price",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
