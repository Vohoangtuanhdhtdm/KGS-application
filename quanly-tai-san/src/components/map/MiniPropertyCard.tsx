import { Link } from "@tanstack/react-router";
import { ImageIcon } from "lucide-react";
import { formatListingPrice } from "@/lib/api/listings";
import type { PropertyMapPoint } from "./propertyMapShared";

/** Thẻ xem nhanh trong Popup khi click marker — ảnh nhỏ + giá + tên rút gọn + link chi tiết. */
export function MiniPropertyCard({ point }: { point: PropertyMapPoint }) {
  return (
    <div style={{ width: 180 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 6,
            overflow: "hidden",
            flexShrink: 0,
            background: "var(--color-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {point.thumbnailUrl ? (
            <img
              src={point.thumbnailUrl}
              alt={point.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <ImageIcon size={20} color="var(--color-muted-foreground)" />
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--color-foreground)" }}>
            {formatListingPrice(point.price, point.type, point.rentPaymentCycle ?? null)}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--color-muted-foreground)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {point.title}
          </div>
        </div>
      </div>
      <Link
        to="/tin-dang/$slug"
        params={{ slug: point.slug! }}
        style={{
          display: "block",
          marginTop: 6,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-primary)",
        }}
      >
        Xem chi tiết →
      </Link>
    </div>
  );
}
