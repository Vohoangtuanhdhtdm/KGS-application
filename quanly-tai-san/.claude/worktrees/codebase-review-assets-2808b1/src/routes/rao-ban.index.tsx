import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { saleListingsApi } from "@/lib/api/sale-listings";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDate, formatCurrency } from "@/lib/format";
import { SALE_LISTING_STATUS, SALE_LISTING_STATUS_CLASS } from "@/constants/enums";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag, Users, ArrowRight, ImageIcon, MapPin } from "lucide-react";

export const Route = createFileRoute("/rao-ban/")({
  head: () => ({ meta: [{ title: "Theo dõi gửi môi giới — Quản Lý Tài Sản" }] }),
  component: SalePage,
});

function SalePage() {
  const query = useQuery({
    queryKey: ["sale-listings"],
    queryFn: () => saleListingsApi.mine(),
    retry: 1,
  });

  const listings = query.data ?? [];

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Theo dõi gửi môi giới</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sổ nội bộ ghi lại giá đã báo và các môi giới đã gửi tài sản — chỉ bạn xem được, không hiển
          thị công khai.
        </p>
      </div>

      {query.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-0">
                <Skeleton className="h-40 w-full rounded-b-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            {getErrorMessage(query.error, "Không tải được danh sách theo dõi gửi môi giới")}
          </CardContent>
        </Card>
      ) : listings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            <Tag className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            Chưa có tài sản nào đang theo dõi gửi môi giới.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((l) => (
            <Card key={l.id} className="overflow-hidden py-0 gap-0">
              <div className="h-40 relative bg-muted">
                {l.assetThumbnailUrl ? (
                  <img
                    src={l.assetThumbnailUrl}
                    alt={l.assetName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
                <Badge
                  variant="outline"
                  className={`absolute top-2 left-2 ${SALE_LISTING_STATUS_CLASS[l.status]}`}
                >
                  {SALE_LISTING_STATUS[l.status]}
                </Badge>
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <div className="font-semibold">{l.assetName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[l.assetDistrict, l.assetCity].filter(Boolean).join(", ")}
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Giá đã báo</div>
                    <div className="text-lg font-semibold text-primary">
                      {formatCurrency(l.askingPrice)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    Ghi ngày {formatDate(l.listedAt)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 pt-2 border-t">
                  <Users className="h-3 w-3" />
                  Đã gửi cho {l.brokers.length} môi giới
                </div>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to="/tai-san/$id" params={{ id: l.assetId }} search={{ tab: "sale" }}>
                    Xem chi tiết
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
