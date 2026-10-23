import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import type { ListingTypeCode } from "@/constants/enums";
import { demandPulseApi, type DemandPulse } from "@/lib/api/demandPulse";

/** "đang tìm thuê" / "đang tìm mua" / "đang tìm nhà". 1 = bán, 2 = cho thuê. */
export function seekingVerb(type: ListingTypeCode | null | undefined) {
  return type === 2 ? "đang tìm thuê" : type === 1 ? "đang tìm mua" : "đang tìm nhà";
}

/** Khoảng giá đông người nhất — câu phụ "· 12 người 3–5 triệu". */
export function busiestBand(p: DemandPulse) {
  return p.bands.reduce<DemandPulse["bands"][number] | null>(
    (best, b) => (best === null || b.people > best.people ? b : best),
    null,
  );
}

/**
 * Một dòng Nhịp cầu cho khu vực đang xem: "28 người đang tìm thuê ở Quận Bình Thạnh". Không hiện
 * gì khi chưa chọn tỉnh/thành hoặc khu vực chưa đủ 3 người (máy chủ đã ẩn).
 */
export function DemandPulseLine({
  type,
  city,
  district,
  className = "",
}: {
  type?: ListingTypeCode | null;
  city?: string | null;
  district?: string | null;
  className?: string;
}) {
  const q = useQuery({
    queryKey: ["demand-pulse", type ?? null, city ?? null, district ?? null],
    queryFn: () => demandPulseApi.get({ type, city, district }),
    enabled: !!city,
    staleTime: 5 * 60_000,
  });
  const p = q.data;
  if (!p) return null;
  const band = busiestBand(p);

  return (
    <p className={`flex items-center gap-1.5 text-sm text-muted-foreground ${className}`}>
      <Users className="h-4 w-4 shrink-0 text-primary" />
      <span>
        <span className="font-medium text-foreground">{p.people} người</span> {seekingVerb(p.type)}{" "}
        ở {p.district ?? p.city}
        {band && ` · ${band.people} người ${band.label}`}
      </span>
    </p>
  );
}
