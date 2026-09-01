import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { savedListingsApi } from "@/lib/api/engagement";
import { formatListingPrice } from "@/lib/api/properties";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { LISTING_TYPE } from "@/constants/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BedDouble, Heart, MapPin, Ruler, Trash2 } from "lucide-react";

export const Route = createFileRoute("/da-luu/")({
  head: () => ({ meta: [{ title: "Tin đã lưu — Quản Lý Tài Sản" }] }),
  component: SavedListingsPage,
});

/** `embedded` = đang render bên trong FeatureSheet: bỏ padding/tiêu đề trùng lặp. */
export function SavedListingsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["saved-listings"],
    queryFn: () => savedListingsApi.list(),
    retry: 1,
  });

  const unsave = useMutation({
    mutationFn: (propertyId: number) => savedListingsApi.unsave(propertyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-listings"] });
      toast.success("Đã bỏ lưu tin");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không bỏ lưu được tin")),
  });

  const rows = query.data ?? [];

  return (
    <div className={embedded ? "space-y-5" : "p-6 space-y-5 max-w-[1200px]"}>
      <div>
        {!embedded && <h1 className="text-2xl font-semibold tracking-tight">Tin đã lưu</h1>}
        <p className="text-sm text-muted-foreground mt-1">
          Những tin đăng bạn đánh dấu để xem lại. Tin bị gỡ khỏi marketplace sẽ tự biến mất khỏi
          danh sách này.
        </p>
      </div>

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {getErrorMessage(query.error, "Không tải được danh sách tin đã lưu")}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            <Heart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            <p>Bạn chưa lưu tin nào.</p>
            <Link to="/tin-dang" className="text-primary hover:underline mt-2 inline-block">
              Tìm bất động sản cho thuê
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((l) => (
            <Card key={l.propertyId} className="overflow-hidden">
              <CardContent className="p-0 flex">
                <Link
                  to="/tin-dang/$slug"
                  params={{ slug: l.slug }}
                  className="shrink-0 w-32 h-full bg-muted"
                >
                  {l.thumbnailUrl ? (
                    <img
                      src={l.thumbnailUrl}
                      alt={l.title}
                      className="w-32 h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-32 h-full grid place-items-center text-muted-foreground/40">
                      <MapPin className="h-6 w-6" />
                    </div>
                  )}
                </Link>

                <div className="flex-1 min-w-0 p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to="/tin-dang/$slug"
                      params={{ slug: l.slug }}
                      className="font-medium leading-snug hover:underline line-clamp-2"
                    >
                      {l.title}
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={unsave.isPending}
                      onClick={() => unsave.mutate(l.propertyId)}
                      aria-label="Bỏ lưu tin"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{LISTING_TYPE[l.type]}</Badge>
                    <span className="text-sm font-semibold text-primary">
                      {formatListingPrice(l.price, l.type, l.rentPaymentCycle)}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {l.district}, {l.city}
                    </span>
                    {l.area > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Ruler className="h-3 w-3" />
                        {l.area} m²
                      </span>
                    )}
                    {l.bedrooms > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <BedDouble className="h-3 w-3" />
                        {l.bedrooms} PN
                      </span>
                    )}
                  </p>

                  <p className="text-xs text-muted-foreground">Đã lưu {formatDate(l.savedAt)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
