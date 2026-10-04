import {
  Bath,
  BedDouble,
  Compass,
  Layers,
  type LucideIcon,
  Ruler,
  ScrollText,
  Sofa,
  StretchHorizontal,
} from "lucide-react";
import type { PublicListingDetailDto } from "@/lib/api/listings";

interface Fact {
  icon: LucideIcon;
  label: string;
  value: string;
}

/** Thông số chính, theo thứ tự người tìm nhà hỏi — chỉ những gì tin THẬT SỰ có. */
export function keyFacts(p: PublicListingDetailDto): Fact[] {
  const out: (Fact | null)[] = [
    p.area != null ? { icon: Ruler, label: "Diện tích", value: `${p.area} m²` } : null,
    p.bedrooms != null ? { icon: BedDouble, label: "Phòng ngủ", value: String(p.bedrooms) } : null,
    p.bathrooms != null ? { icon: Bath, label: "Phòng tắm", value: String(p.bathrooms) } : null,
    p.floors != null ? { icon: Layers, label: "Số tầng", value: String(p.floors) } : null,
    p.frontage != null
      ? { icon: StretchHorizontal, label: "Mặt tiền", value: `${p.frontage} m` }
      : null,
    p.houseDirection ? { icon: Compass, label: "Hướng", value: p.houseDirection } : null,
    p.legalStatus ? { icon: ScrollText, label: "Pháp lý", value: p.legalStatus } : null,
    p.furnitureState ? { icon: Sofa, label: "Nội thất", value: p.furnitureState } : null,
  ];
  return out.filter((f): f is Fact => f !== null);
}

/**
 * Hàng thông số ngay dưới tiêu đề.
 *
 * Trước đây diện tích, số phòng, pháp lý nằm ở khối "Thông số" thứ tư, phải cuộn qua chi
 * phí và tiện nghi mới tới — trong khi đó là những câu đầu tiên người ta hỏi về một căn nhà.
 */
export function KeyFacts({ listing }: { listing: PublicListingDetailDto }) {
  const facts = keyFacts(listing);
  if (facts.length === 0) return null;
  return (
    // flex-wrap + flex-1 thay vì lưới cố định: số thông số đổi theo loại hình (đất có 4, nhà
    // có 8), lưới 4 cột sẽ để lại ô trống ở hàng cuối; ở đây các ô tự giãn lấp đầy hàng.
    <dl className="flex flex-wrap gap-px overflow-hidden rounded-xl border bg-border">
      {facts.map((f) => (
        <div
          key={f.label}
          className="flex min-w-[150px] flex-1 items-center gap-3 bg-card px-4 py-3"
        >
          <f.icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd className="font-semibold leading-tight">{f.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
