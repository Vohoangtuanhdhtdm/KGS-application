import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ảnh của căn đang chọn trên mô hình — lướt được, có số thứ tự.
 *
 * Căn có tin: ảnh của chính tin đó. Căn trống chưa có tin: ảnh chung của toà nhà, ghi rõ
 * "ảnh chung" để không ai tưởng đó là ảnh của đúng căn này.
 */
export function UnitPhotos({
  images,
  shared = false,
  alt,
  className,
}: {
  images: string[];
  /** Ảnh chung của toà nhà, không phải của riêng căn. */
  shared?: boolean;
  alt: string;
  className?: string;
}) {
  const [i, setI] = useState(0);
  // Đổi căn → về ảnh đầu.
  useEffect(() => setI(0), [images]);

  if (images.length === 0)
    return (
      <div
        className={cn(
          "flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-lg bg-muted text-xs text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="h-5 w-5" />
        Chưa có ảnh
      </div>
    );

  const go = (d: number) => setI((v) => (v + d + images.length) % images.length);

  return (
    <div
      className={cn(
        "group relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted",
        className,
      )}
    >
      {images.map((src, k) => (
        <img
          key={src + k}
          src={src}
          alt={k === i ? alt : ""}
          loading="lazy"
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            k === i ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      {shared && (
        <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
          Ảnh chung của toà nhà
        </span>
      )}
      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Ảnh trước"
            onClick={() => go(-1)}
            className="absolute left-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-foreground opacity-100 shadow transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Ảnh sau"
            onClick={() => go(1)}
            className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-foreground opacity-100 shadow transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] tabular-nums text-white">
            {i + 1}/{images.length}
          </span>
        </>
      )}
    </div>
  );
}
