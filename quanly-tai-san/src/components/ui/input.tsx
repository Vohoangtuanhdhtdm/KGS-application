import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Bỏ shadow-sm: ô nhập là chỗ LÕM xuống chứ không phải khối nổi lên; đổ bóng làm nó
          // trông như một nút bấm. Vòng tiêu điểm dày lên ring-2 để nhìn thấy được — ring-1
          // sát mép gần như biến mất trên nền sáng.
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base transition-[border-color,box-shadow] duration-[--dur-fast] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
