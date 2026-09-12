import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { AlertTriangle, ImageIcon, Loader2, Scale, X } from "lucide-react";
import { useCompareList } from "@/hooks/useCompareList";
import { listingsApi, formatListingPrice, type PublicListingDetailDto } from "@/lib/api/listings";
import { valuationApi } from "@/lib/api/valuation";
import { getErrorMessage } from "@/lib/api/errors";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/lib/auth/AuthContext";
import { PublicHeader } from "@/components/public/PublicHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/so-sanh")({
  head: () => ({ meta: [{ title: "So sánh tin đăng — KGS" }] }),
  component: ComparePage,
});

/**
 * So sánh 2–3 tin đăng cạnh nhau.
 *
 * Không cần bảng hay API mới: mọi thuộc tính hiện ở đây đã nằm sẵn trong
 * `/listings/{slug}` — trang chi tiết đã tải và hiển thị từng thứ một, chỗ còn thiếu chỉ
 * là đặt chúng CẠNH NHAU theo hàng để mắt lướt là thấy khác biệt, thay vì phải nhớ số của
 * tin trước khi mở tin sau.
 *
 * Nguồn tin đang so là `useCompareList` (localStorage) — KHÔNG qua query string. Đây là
 * một tiện ích lướt-và-so tạm thời trong một phiên xem, không phải thứ cần chia sẻ link
 * hay giữ nguyên sau khi đóng trình duyệt.
 */
function ComparePage() {
  const { items, remove, clear } = useCompareList();
  const { isAuthenticated } = useAuth();

  const detailQueries = useQueries({
    queries: items.map((it) => ({
      queryKey: ["listing-detail", it.slug],
      queryFn: () => listingsApi.detail(it.slug),
      staleTime: 60_000,
      retry: 1,
    })),
  });

  // Giá tham khảo AI: mô hình chỉ huấn luyện trên tin RAO BÁN (xem PriceSuggestion), nên
  // chỉ gọi cho tin loại Bán và khi đã có đủ toạ độ hành chính + diện tích. `/valuation/estimate`
  // còn đòi đăng nhập ở backend (dựng cho người ĐĂNG tin, không phải cho khách xem công khai) —
  // khách chưa đăng nhập thì bỏ hẳn cột này thay vì gọi để nhận 401 rồi hiện toàn ô trống.
  const valuationQueries = useQueries({
    queries: items.map((it, i) => {
      const d = detailQueries[i]?.data;
      const san = isAuthenticated && it.type === 1 && d != null && d.area != null && d.area > 0;
      return {
        queryKey: ["valuation-compare", it.slug, d?.area, d?.district],
        queryFn: () =>
          valuationApi.estimate({
            area: d!.area!,
            city: d!.city,
            district: d!.district,
            ward: d!.ward || null,
            houseDirection: d!.houseDirection,
            bedrooms: d!.bedrooms,
            bathrooms: d!.bathrooms,
            floors: d!.floors,
            frontage: d!.frontage,
          }),
        enabled: san,
        staleTime: 10 * 60_000,
        retry: false,
      };
    }),
  });

  const anyLoading = detailQueries.some((q) => q.isLoading);
  const allSameType = items.every((it) => it.type === items[0]?.type);

  return (
    <div className="min-h-screen bg-muted/20 pb-10">
      <PublicHeader />
      <div className="mx-auto max-w-[1200px] p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Scale className="h-5 w-5" />
            So sánh tin đăng
          </h1>
          {items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
              Xoá hết
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {items.length < 2 && (
              <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                Mới chọn 1 tin. Quay lại{" "}
                <Link to="/tin-dang" className="font-medium underline">
                  tìm bất động sản
                </Link>{" "}
                để chọn thêm ít nhất 1 tin nữa.
              </p>
            )}
            {!allSameType && (
              <p className="text-sm text-muted-foreground">
                Chỉ so sánh được các tin cùng loại (Bán với Bán, hoặc Cho thuê với Cho thuê).
              </p>
            )}
            {anyLoading ? (
              <div className="flex items-center gap-2 py-10 justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải thông tin các tin...
              </div>
            ) : (
              <CompareTable
                items={items}
                details={detailQueries.map((q) => q.data ?? null)}
                errors={detailQueries.map((q) => q.error ?? null)}
                valuations={valuationQueries.map((q) => q.data ?? null)}
                showValuation={isAuthenticated}
                onRemove={remove}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <Scale className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">
        Chưa có tin nào được chọn để so sánh.
        <br />
        Bấm biểu tượng cân <Scale className="inline h-3.5 w-3.5" /> trên mỗi tin ở trang tìm kiếm để
        thêm vào đây.
      </p>
      <Button asChild size="sm">
        <Link to="/tin-dang">Tìm bất động sản</Link>
      </Button>
    </div>
  );
}

/** true ở vị trí đạt giá trị tốt nhất — chỉ khi các giá trị hợp lệ KHÔNG đều nhau. */
function bestMask(values: (number | null)[], dir: "min" | "max"): boolean[] {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length < 2) return values.map(() => false);
  const best = dir === "min" ? Math.min(...valid) : Math.max(...valid);
  if (valid.every((v) => v === best)) return values.map(() => false);
  return values.map((v) => v != null && v === best);
}

interface RowSpec {
  label: string;
  cells: (string | null)[];
  highlight?: boolean[];
}

function CompareTable({
  items,
  details,
  errors,
  valuations,
  showValuation,
  onRemove,
}: {
  items: ReturnType<typeof useCompareList>["items"];
  details: (PublicListingDetailDto | null)[];
  errors: (unknown | null)[];
  valuations: (import("@/lib/api/valuation").ValuationResult | null)[];
  /** "Giá tham khảo AI" cần đăng nhập ở backend (dựng cho người đăng tin) — khách xem
      công khai không có cột này thay vì thấy toàn ô trống. */
  showValuation: boolean;
  onRemove: (id: string) => void;
}) {
  const prices = details.map((d) => d?.price ?? null);
  const totalMonthly = details.map((d) => d?.totalMonthlyCost ?? null);
  const pricePerM2 = details.map((d) =>
    d?.price != null && d.area != null && d.area > 0 ? d.price / d.area : null,
  );
  const areas = details.map((d) => d?.area ?? null);
  const bedrooms = details.map((d) => d?.bedrooms ?? null);
  const bathrooms = details.map((d) => d?.bathrooms ?? null);
  const isRent = items[0]?.type === 2;

  const rows: RowSpec[] = [
    {
      label: isRent ? "Giá thuê" : "Giá bán",
      cells: details.map((d, i) =>
        d ? formatListingPrice(d.price, items[i].type, d.rentPaymentCycle) : null,
      ),
      highlight: bestMask(isRent ? totalMonthly : prices, "min"),
    },
    ...(isRent
      ? [
          {
            label: "Tổng chi phí/tháng",
            cells: details.map((d) => (d ? formatCurrency(d.totalMonthlyCost) : null)),
            highlight: bestMask(totalMonthly, "min"),
          },
        ]
      : []),
    {
      label: "Giá / m²",
      cells: pricePerM2.map((v) => (v != null ? `${formatCurrency(v)}/m²` : null)),
      highlight: bestMask(pricePerM2, "min"),
    },
    {
      label: "Diện tích",
      cells: areas.map((v) => (v != null ? `${v} m²` : null)),
      highlight: bestMask(areas, "max"),
    },
    {
      label: "Phòng ngủ",
      cells: bedrooms.map((v) => (v != null ? String(v) : null)),
      highlight: bestMask(bedrooms, "max"),
    },
    {
      label: "Phòng tắm",
      cells: bathrooms.map((v) => (v != null ? String(v) : null)),
      highlight: bestMask(bathrooms, "max"),
    },
    {
      label: "Mặt tiền",
      cells: details.map((d) => (d?.frontage != null ? `${d.frontage} m` : null)),
    },
    { label: "Số tầng", cells: details.map((d) => (d?.floors != null ? String(d.floors) : null)) },
    { label: "Hướng nhà", cells: details.map((d) => d?.houseDirection ?? null) },
    { label: "Pháp lý", cells: details.map((d) => d?.legalStatus ?? null) },
    { label: "Nội thất", cells: details.map((d) => d?.furnitureState ?? null) },
    { label: "Loại BĐS", cells: details.map((d) => d?.assetTypeLabel ?? null) },
    {
      label: "Khu vực",
      cells: details.map((d) => (d ? [d.district, d.city].filter(Boolean).join(", ") : null)),
    },
    ...(showValuation && items.some((it) => it.type === 1)
      ? [
          {
            label: "Giá tham khảo AI",
            cells: valuations.map((v) =>
              v
                ? `${formatCurrency(v.price)} (${formatCurrency(v.priceLow)} – ${formatCurrency(v.priceHigh)})`
                : null,
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="w-32 shrink-0 p-3 text-left align-bottom text-xs font-medium text-muted-foreground sm:w-40" />
            {items.map((it, i) => {
              const d = details[i];
              const err = errors[i];
              return (
                <th key={it.id} className="min-w-[160px] p-3 align-top text-left font-normal">
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={`Bỏ "${it.title}" khỏi so sánh`}
                      onClick={() => onRemove(it.id)}
                      className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-card shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="mb-2 aspect-[4/3] overflow-hidden rounded-md bg-muted">
                      {it.thumbnailUrl ? (
                        <img
                          src={it.thumbnailUrl}
                          alt={it.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    {err ? (
                      <div className="flex items-start gap-1.5 text-xs text-destructive">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {getErrorMessage(err, "Không tải được tin này")}
                      </div>
                    ) : d ? (
                      <Link
                        to="/tin-dang/$slug"
                        params={{ slug: it.slug }}
                        className="line-clamp-2 font-medium hover:underline"
                      >
                        {d.title}
                      </Link>
                    ) : (
                      <span className="line-clamp-2 font-medium">{it.title}</span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows
            // Ẩn hẳn hàng nào KHÔNG tin nào khai — hàng toàn gạch ngang chỉ làm bảng dài
            // vô ích mà không nói lên điều gì.
            .filter((r) => r.cells.some((c) => c != null))
            .map((r) => (
              <tr key={r.label} className="border-b last:border-0">
                <th className="p-3 text-left align-top text-xs font-medium text-muted-foreground">
                  {r.label}
                </th>
                {r.cells.map((c, i) => (
                  <td
                    key={items[i].id}
                    className={`p-3 align-top tabular-nums ${
                      r.highlight?.[i] ? "rounded-md bg-success/10 font-semibold text-success" : ""
                    }`}
                  >
                    {c ?? <span className="text-muted-foreground/50">—</span>}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
      {showValuation && items.some((it) => it.type === 1) && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Giá tham khảo AI ước tính từ mô hình học máy, chỉ áp dụng cho tin rao bán — dùng làm mốc
          tham khảo, không phải giá thẩm định. Ô trống là tin thiếu dữ liệu để mô hình ước tính.
        </p>
      )}
      {!showValuation && items.some((it) => it.type === 1) && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          <Link to="/login" search={{ redirect: "/so-sanh" }} className="font-medium underline">
            Đăng nhập
          </Link>{" "}
          để xem thêm giá tham khảo AI cho từng tin.
        </p>
      )}
    </div>
  );
}
