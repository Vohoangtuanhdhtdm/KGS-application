import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listingsApi, formatListingPrice } from "@/lib/api/listings";
import { PublicHeader } from "@/components/public/PublicHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BedDouble, Building2, MapPin, Megaphone, Ruler, Search } from "lucide-react";

/**
 * TRANG CHỦ MARKETPLACE — mặt tiền của sản phẩm.
 *
 * Trước đây "/" là Bàn vận hành, tức là thứ đầu tiên khách nhìn thấy là một công cụ quản
 * lý nội bộ. Với định vị "nền tảng hỗ trợ tìm kiếm và kết nối bất động sản" thì mặt tiền
 * phải là nơi tìm nhà. Bàn vận hành chuyển về /quan-ly.
 *
 * Trang này CÔNG KHAI: khách chưa đăng nhập vẫn tìm và xem tin được. Đó là điều kiện để
 * một nền tảng tin đăng có lưu lượng — bắt đăng nhập trước khi cho xem là tự chặn mình.
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KGS — Tìm nhà trọ, căn hộ cho thuê và bất động sản" },
      {
        name: "description",
        content:
          "Nền tảng tìm kiếm và kết nối bất động sản: nhà trọ, phòng cho thuê, căn hộ và nhà đất trên toàn quốc.",
      },
    ],
  }),
  component: MarketplaceHome,
});

const CITIES = ["TP. Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Bình Dương", "Đồng Nai"];

/** Khoảng giá thuê phổ biến ở thị trường Việt Nam, tính theo triệu đồng mỗi tháng. */
const PRICE_BANDS: { label: string; max?: number; min?: number }[] = [
  { label: "Dưới 3 triệu", max: 3_000_000 },
  { label: "3 – 5 triệu", min: 3_000_000, max: 5_000_000 },
  { label: "5 – 8 triệu", min: 5_000_000, max: 8_000_000 },
  { label: "Trên 8 triệu", min: 8_000_000 },
];

function MarketplaceHome() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState<string>("");

  const submit = () => {
    navigate({
      to: "/tin-dang",
      search: { keyword: keyword.trim() || undefined, city: city || undefined },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Hero: ô tìm kiếm là thứ đầu tiên và to nhất trên trang. */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-[1200px] px-4 py-12 lg:py-16 space-y-6">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-balance">
              Tìm nơi ở tiếp theo của bạn
            </h1>
            <p className="text-muted-foreground">
              Nhà trọ, phòng cho thuê, căn hộ và nhà đất — xem đầy đủ chi phí, nội quy và tiện nghi
              trước khi đi xem.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 max-w-3xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Nhập khu vực, đường, hoặc mô tả nơi bạn muốn ở"
                className="pl-9 h-12"
                aria-label="Từ khoá tìm kiếm"
              />
            </div>
            <Select value={city || "all"} onValueChange={(v) => setCity(v === "all" ? "" : v)}>
              <SelectTrigger className="h-12 sm:w-[200px]" aria-label="Tỉnh/thành phố">
                <SelectValue placeholder="Toàn quốc" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toàn quốc</SelectItem>
                {CITIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="h-12 px-8" onClick={submit}>
              <Search className="h-4 w-4 mr-1.5" />
              Tìm kiếm
            </Button>
          </div>

          {/* Lối tắt theo khoảng giá — thứ người thuê lọc trước tiên. */}
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-sm text-muted-foreground self-center mr-1">Cho thuê:</span>
            {PRICE_BANDS.map((b) => (
              <Button
                key={b.label}
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate({
                    to: "/tin-dang",
                    search: { type: 2, priceMin: b.min, priceMax: b.max },
                  })
                }
              >
                {b.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-4 py-10 space-y-10">
        <LatestListings />
        <PostCta />
      </div>
    </div>
  );
}

/** Tin mới nhất — bằng chứng nền tảng đang sống. Trang chủ trống là tín hiệu xấu nhất. */
function LatestListings() {
  const query = useQuery({
    queryKey: ["home-latest"],
    queryFn: () => listingsApi.search({ pageSize: 8 }),
    retry: 1,
  });

  const items = query.data?.items ?? [];

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Tin đăng mới nhất</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/tin-dang">Xem tất cả</Link>
        </Button>
      </div>

      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          Chưa có tin đăng nào được duyệt.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((l) => (
            <Link
              key={l.id}
              to="/tin-dang/$slug"
              params={{ slug: l.slug }}
              className="group rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-[4/3] bg-muted overflow-hidden">
                {l.thumbnailUrl ? (
                  <img
                    src={l.thumbnailUrl}
                    alt={l.title}
                    loading="lazy"
                    className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                ) : (
                  <div className="h-full grid place-items-center text-muted-foreground/40">
                    <Building2 className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="p-3 space-y-1.5">
                <div className="font-medium leading-snug line-clamp-2 min-h-[2.6em]">{l.title}</div>
                <div className="text-primary font-semibold">
                  {formatListingPrice(l.price, l.type, l.rentPaymentCycle)}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-2.5 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {l.district}
                  </span>
                  {l.area ? (
                    <span className="inline-flex items-center gap-1">
                      <Ruler className="h-3 w-3" />
                      {l.area} m²
                    </span>
                  ) : null}
                  {l.bedrooms ? (
                    <span className="inline-flex items-center gap-1">
                      <BedDouble className="h-3 w-3" />
                      {l.bedrooms}
                    </span>
                  ) : null}
                </p>
                {l.unitName && (
                  <Badge variant="secondary" className="font-normal text-xs">
                    {l.unitName}
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function PostCta() {
  return (
    <section className="rounded-lg border bg-card p-6 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center gap-4 justify-between">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Bạn có nhà hoặc phòng cho thuê?</h2>
        <p className="text-sm text-muted-foreground">
          Đăng tin miễn phí, tiếp cận người đang tìm thuê ngay trong khu vực của bạn.
        </p>
      </div>
      <Button size="lg" asChild>
        <Link to="/dang-tin">
          <Megaphone className="h-4 w-4 mr-1.5" />
          Đăng tin ngay
        </Link>
      </Button>
    </section>
  );
}
