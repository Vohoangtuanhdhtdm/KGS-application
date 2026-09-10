import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Nút bấm.
 *
 * Ba thay đổi so với bản trước, đều thuộc Đợt 1 của lộ trình thiết kế:
 *
 * 1. **Bỏ đổ bóng khỏi nút.** Trước đây default/outline/secondary đều mang shadow. Khi mọi
 *    thứ cùng nổi thì không thứ gì nổi — và nút nằm trong thẻ đã có bóng lại tạo ra hai lớp
 *    bóng chồng nhau. Độ nổi để dành cho lớp thật sự lơ lửng (popover, sheet).
 *
 * 2. **Thêm phản hồi khi nhấn.** Trước chỉ có hover đổi màu; trên cảm ứng thì hover không
 *    tồn tại, nên người dùng bấm mà không có gì xác nhận. `active:scale` cho phản hồi ở
 *    mọi thiết bị.
 *
 * 3. **Vòng tiêu điểm dày và có khoảng đệm.** ring-1 sát mép gần như không thấy được trên
 *    nút đặc màu; ring-2 + offset thì thấy rõ ở cả hai giao diện sáng/tối.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-[background-color,border-color,color,transform] duration-[--dur-fast] ease-[--ease-out] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-card hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-7 text-[15px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
