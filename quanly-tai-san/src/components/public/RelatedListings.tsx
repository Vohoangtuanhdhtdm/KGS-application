import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import {
  listingsApi,
  formatListingPrice,
  type PublicListingSummaryDto,
} from "@/lib/api/listings";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Hai dải gợi ý dưới trang chi tiết.
 *
 * Người xem một tin gần như luôn ở giữa quá trình so sánh, không phải ở cuối. Trang chi
 * tiết không có lối đi tiếp thì họ phải bấm quay lại rồi dò lại vị trí cũ trong danh
 * sách — và đó là chỗ người ta bỏ cuộc.
 *
 * Tải tách khỏi nội dung chính: phần này nằm dưới màn hình đầu, không đáng để tin đăng
 * phải chờ nó mới hiện được.
 */
export function RelatedListings({ slug, ownerName }: { slug: string; ownerName: string }) {
  const query = useQuery({
    queryKey: ["listing-related", slug],
    queryFn: () => listingsApi.related(slug),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Lỗi ở đây không hiện gì cả. Đây là phần gợi ý thêm — một khung báo lỗi đỏ dưới chân
  // trang chi tiết chỉ làm người dùng tưởng tin họ đang xem có vấn đề.
  if (query.isError || !query.data) return null;

  const { similar, fromOwner } = query.data;
  if (similar.length === 0 && fromOwner.length === 0) return null;

  return (
    <div className="space-y-6">
      {similar.length > 0 && <Rail title="Tin tương tự trong khu vực" items={similar} />}
      {fromOwner.length > 0 && (
        <Rail title={`Tin khác của ${ownerName}`} items={fromOwner} />
      )}
    </div>
  );
}

function Rail({ title, items }: { title: string; items: PublicListingSummaryDto[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((p) => (
          <CompactCard key={p.id} listing={p} />
        ))}
      </div>
    </section>
  );
}

function CompactCard({ listing: p }: { listing: PublicListingSummaryDto }) {
  return (
    <Link to="/tin-dang/$slug" params={{ slug: p.slug }} className="block group">
      <Card className="overflow-hidden py-0 gap-0 h-full transition-shadow group-hover:shadow-md">
        <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
          {p.thumbnailUrl ? (
            <img
              src={p.thumbnailUrl}
              alt={p.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
          )}
        </div>
        <div className="p-3 space-y-1">
          {/* Hai dòng rồi cắt: tiêu đề tin đăng hay dài, và một dải thẻ so le nhau
              chiều cao thì đọc lướt rất khó. */}
          <p className="text-sm font-medium line-clamp-2 leading-snug">{p.title}</p>
          <p className="text-sm font-semibold text-primary">
            {formatListingPrice(p.price, p.type, p.rentPaymentCycle)}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {[p.district, p.city].filter(Boolean).join(", ")}
          </p>
        </div>
      </Card>
    </Link>
  );
}
