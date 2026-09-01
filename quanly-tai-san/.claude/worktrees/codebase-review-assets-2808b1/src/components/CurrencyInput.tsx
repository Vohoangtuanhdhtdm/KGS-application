import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

/**
 * Input tiền: hiển thị định dạng vi-VN (dấu chấm), giá trị nội bộ là number.
 */
export function CurrencyInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  id?: string;
}) {
  const format = (n: number | null | undefined) =>
    n === null || n === undefined || isNaN(n) ? "" : new Intl.NumberFormat("vi-VN").format(n);

  const [display, setDisplay] = useState(format(value));

  useEffect(() => {
    setDisplay(format(value));
  }, [value]);

  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="numeric"
        placeholder={placeholder}
        value={display}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "");
          if (raw === "") {
            setDisplay("");
            onChange(null);
            return;
          }
          const n = Number(raw);
          setDisplay(new Intl.NumberFormat("vi-VN").format(n));
          onChange(n);
        }}
        className="pr-10"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₫</span>
    </div>
  );
}
