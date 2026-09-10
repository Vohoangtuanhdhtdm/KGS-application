import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { savedListingsApi } from "@/lib/api/engagement";
import { useAuth } from "@/lib/auth/AuthContext";
import { getErrorMessage } from "@/lib/api/errors";
import { PropertyListCard } from "@/components/public/PropertyListCard";
import { listingsApi } from "@/lib/api/listings";
import { PublicHeader } from "@/components/public/PublicHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Megaphone, Search } from "lucide-react";

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

      {/* Hero.
          Trước đây đây là khối chữ + ba điều khiển rời trên nền xám phẳng — một sàn bất
          động sản mà màn hình đầu tiên KHÔNG có tấm ảnh nào. Nay ảnh lấy từ chính tin đăng
          mới nhất: không phải ảnh kho mua về, mà là bằng chứng nền tảng đang có hàng thật.
          Kho mã không chứa sẵn ảnh nào, và bịa ra một tấm ảnh "nhà đẹp" không thuộc tin nào
          thì vừa sai vừa hứa hẹn thứ sản phẩm không có. */}
      <section className="border-b bg-muted/40">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center lg:py-16">
          <div className="space-y-6">
            <div className="max-w-2xl space-y-3">
              <h1 className="text-3xl font-semibold text-balance lg:text-[2.75rem]">
                Biết trước <span className="text-price">tổng chi phí mỗi tháng</span> trước
                khi đi xem nhà
              </h1>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                Giá thuê chỉ là một phần. Mỗi tin trên KGS ghi rõ điện, nước, phí dịch vụ,
                gửi xe, internet — và cả nội quy: nuôi thú cưng, giờ giấc, ở chung chủ hay
                không.
              </p>
            </div>

            {/* Ô tìm kiếm là MỘT khối liền, không phải ba điều khiển rời nhau.
                Bản trước để ba thứ này cách nhau bằng gap-2, mỗi thứ một viền riêng — mắt
                đọc ra ba việc phải làm thay vì một. */}
            <div className="flex max-w-2xl flex-col overflow-hidden rounded-xl border bg-card shadow-[--shadow-e2] sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="Khu vực, tên đường, hoặc nơi bạn muốn ở"
                  className="h-14 rounded-none border-0 pl-11 text-base focus-visible:ring-0"
                  aria-label="Từ khoá tìm kiếm"
                />
              </div>
              <span aria-hidden="true" className="hidden h-8 w-px bg-border sm:block" />
              <Select value={city || "all"} onValueChange={(v) => setCity(v === "all" ? "" : v)}>
                <SelectTrigger
                  className="h-14 rounded-none border-0 border-t sm:w-[190px] sm:border-t-0 focus:ring-0"
                  aria-label="Tỉnh/thành phố"
                >
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
              <div className="p-2">
                <Button className="h-11 w-full px-7 sm:w-auto" onClick={submit}>
                  <Search className="mr-1.5 h-4 w-4" />
                  Tìm kiếm
                </Button>
              </div>
            </div>

            {/* Lối tắt theo khoảng giá — thứ người thuê lọc trước tiên. */}
            <div className="flex flex-wrap gap-2">
              <span className="mr-1 self-center text-sm text-muted-foreground">
                Thuê theo ngân sách:
              </span>
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

          <HeroCollage />
        </div>
      </section>

      <AreaShortcuts />
      <ValueProps />

      <div className="mx-auto max-w-[1200px] px-4 py-10 space-y-10">
        <LatestListings />
        <PostCta />
      </div>
    </div>
  );
}

/**
 * Ảnh hero — lấy từ chính tin đăng đang có trên nền tảng.
 *
 * Ba lý do không dùng ảnh kho: kho mã không chứa sẵn ảnh nào; một tấm ảnh "nhà đẹp" không
 * thuộc tin nào là lời hứa về thứ sản phẩm không có; và ảnh thật thì tự cập nhật theo hàng
 * đang đăng, không bao giờ cũ.
 *
 * Nếu chưa có tin nào có ảnh thì KHÔNG dựng khung rỗng — trả về null để hero tự thu lại
 * thành một cột. Một lưới bốn ô xám trống còn tệ hơn không có ảnh.
 */
function HeroCollage() {
  const query = useQuery({
    queryKey: ["home-hero-images"],
    queryFn: () => listingsApi.search({ pageSize: 8 }),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const anh = (query.data?.items ?? []).filter((l) => l.thumbnailUrl).slice(0, 3);

  if (query.isLoading) {
    return (
      <div className="hidden grid-cols-2 gap-3 lg:grid">
        <Skeleton className="row-span-2 aspect-[3/4] h-full w-full" />
        <Skeleton className="aspect-[4/3] w-full" />
        <Skeleton className="aspect-[4/3] w-full" />
      </div>
    );
  }
  if (anh.length < 3) return null;

  return (
    <div className="hidden grid-cols-2 gap-3 lg:grid" aria-hidden="true">
      <Link
        to="/tin-dang/$slug"
        params={{ slug: anh[0].slug }}
        className="row-span-2 overflow-hidden rounded-xl"
      >
        <img
          src={anh[0].thumbnailUrl!}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
        />
      </Link>
      {anh.slice(1).map((l) => (
        <Link
          key={l.id}
          to="/tin-dang/$slug"
          params={{ slug: l.slug }}
          className="aspect-[4/3] overflow-hidden rounded-xl"
        >
          <img
            src={l.thumbnailUrl!}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
          />
        </Link>
      ))}
    </div>
  );
}

/**
 * Khu vực đang có tin — thay cho khối ba ô icon.
 *
 * Khối cũ là mẫu "ba cột, mỗi cột một icon viền trong ô bo góc" — thứ nhìn là biết được
 * sinh ra chứ không được thiết kế, và nó KHÔNG có dữ liệu nào đằng sau. Ở đây mỗi mục là
 * một khu vực có thật với số tin có thật, bấm vào là ra kết quả — vừa chứng minh nền tảng
 * có hàng, vừa là lối đi tắt.
 */
function AreaShortcuts() {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["home-areas"],
    queryFn: () => listingsApi.areas(2),
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const khuVuc = (query.data ?? []).filter((k) => k.district).slice(0, 8);
  if (!query.isLoading && khuVuc.length === 0) return null;

  return (
    <section className="border-b bg-card">
      <div className="mx-auto max-w-[1200px] space-y-4 px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold">Khu vực đang có nhiều phòng cho thuê</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/tin-dang">Xem tất cả</Link>
          </Button>
        </div>

        {query.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {khuVuc.map((k) => (
              <button
                key={`${k.city}:${k.district}`}
                type="button"
                onClick={() =>
                  navigate({
                    to: "/tin-dang",
                    search: { type: 2, city: k.city, district: k.district },
                  })
                }
                className="rounded-lg border px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <div className="truncate font-medium">{k.district}</div>
                <div className="text-sm tabular-nums text-muted-foreground">
                  {k.count} tin đang đăng
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Ba điều KGS làm khác các sàn tin đăng hiện có.
 *
 * Trước đây trang chủ chỉ có ô tìm kiếm rồi tới danh sách tin — đúng hình dạng của mọi sàn
 * tin đăng, và vì thế không nói được vì sao người ta nên dùng cái này thay vì cái kia. Ba
 * khối dưới đây không phải khẩu hiệu: mỗi khối tương ứng với một thứ đã thực sự xây trong
 * Giai đoạn 1 và người dùng kiểm chứng được ngay trên tin đăng.
 */
function ValueProps() {
  /* Bản trước là ba cột, mỗi cột một icon viền trong ô bo góc 40x40 — mẫu template dễ nhận
     ra nhất hiện nay. Nội dung thì đúng và cụ thể, nên giữ nguyên nội dung và bỏ cái vỏ:
     thứ đáng để mắt bám vào là CON SỐ, không phải cái icon. */
  const items = [
    {
      figure: "Tổng",
      unit: "chi phí",
      title: "Không chỉ giá thuê",
      body: "Mỗi tin cộng sẵn phí dịch vụ, gửi xe và internet vào giá thuê. Một phòng 7 triệu kèm 500k phí đắt hơn phòng 7,2 triệu trọn gói — con số trên tin đã tính giúp bạn.",
    },
    {
      figure: "4",
      unit: "nhóm nội quy",
      title: "Ghi rõ từ đầu",
      body: "Nuôi thú cưng, giờ giấc tự do, ở chung chủ, được nấu ăn — khai rõ có hoặc không, thay vì để trống rồi bạn phải gọi hỏi từng nơi.",
    },
    {
      figure: "600K",
      unit: "tin huấn luyện",
      title: "Giá tham khảo từ dữ liệu thật",
      body: "Mô hình học máy huấn luyện trên hơn 600.000 tin rao thực tế, kèm chỉ số giá theo tuần của từng quận — để bạn biết mức giá đang xem là hợp lý hay lệch mặt bằng.",
    },
  ];

  return (
    <section className="border-b">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-12 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.title} className="space-y-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-price tabular-nums">
                {it.figure}
              </span>
              <span className="text-sm text-muted-foreground">{it.unit}</span>
            </div>
            <h3 className="font-semibold leading-snug">{it.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Tin mới nhất — bằng chứng nền tảng đang sống. Trang chủ trống là tín hiệu xấu nhất. */
function LatestListings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();

  const query = useQuery({
    queryKey: ["home-latest"],
    queryFn: () => listingsApi.search({ pageSize: 8 }),
    retry: 1,
  });

  // Cùng cơ chế với trang tìm kiếm: lấy trọn danh sách đã lưu một lần rồi tra bằng Set.
  const savedQuery = useQuery({
    queryKey: ["saved-listings"],
    queryFn: () => savedListingsApi.list(),
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: 1,
  });
  const savedIds = useMemo(
    () => new Set((savedQuery.data ?? []).map((x) => x.listingId)),
    [savedQuery.data],
  );
  const savedIdsRef = useRef(savedIds);
  savedIdsRef.current = savedIds;

  const toggle = useMutation({
    mutationFn: ({ id, dangLuu }: { id: string; dangLuu: boolean }) =>
      dangLuu ? savedListingsApi.unsave(id) : savedListingsApi.save(id),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["saved-listings"] });
      toast.success(v.dangLuu ? "Đã bỏ lưu tin" : "Đã lưu tin");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không lưu được tin")),
  });

  const onToggleSave = useCallback(
    (id: string) => {
      if (!isAuthenticated) {
        navigate({ to: "/login", search: { redirect: "/" } });
        return;
      }
      toggle.mutate({ id, dangLuu: savedIdsRef.current.has(id) });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAuthenticated],
  );

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
        /* Dùng ĐÚNG thẻ tin của trang tìm kiếm.
           Trước đây trang chủ tự dựng một thẻ riêng — nên tổng chi phí hàng tháng, nút lưu
           tin, số liệu thẳng hàng và thang đổ bóng làm ở Đợt 2 đều không tới được đây. Hai
           bản cài đặt cho cùng một vật thể thì chắc chắn sẽ trôi khỏi nhau. */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((l) => (
            <PropertyListCard
              key={l.id}
              property={l}
              saved={savedIds.has(l.id)}
              onToggleSave={onToggleSave}
            />
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
