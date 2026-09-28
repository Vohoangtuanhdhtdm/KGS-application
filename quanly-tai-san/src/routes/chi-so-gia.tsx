import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowRight, Calculator, TrendingDown, TrendingUp } from "lucide-react";
import { priceIndexApi, type PriceIndexAreaDto } from "@/lib/api/priceIndex";
import { resolveAreaName, shortProvince } from "@/lib/areaNames";
import { normDistrict, normProvince } from "@/lib/areaKey";
import { PublicHeader } from "@/components/public/PublicHeader";
import { MarketTrendCard } from "@/components/public/MarketTrendCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BlurText from "@/components/reactbits/BlurText";

export const Route = createFileRoute("/chi-so-gia")({
  head: () => ({ meta: [{ title: "Chỉ số giá bất động sản — KGS" }] }),
  // Khu vực nằm trên URL: trang định giá dẫn thẳng sang đúng quận vừa tra, và người dùng
  // chia sẻ được đường dẫn tới đúng biểu đồ họ đang xem.
  validateSearch: (s: Record<string, unknown>): { province?: string; district?: string } => ({
    province: typeof s.province === "string" && s.province ? s.province : undefined,
    district: typeof s.district === "string" && s.district ? s.district : undefined,
  }),
  component: PriceIndexPage,
});

const NATIONAL = "__national__";

interface AreaRow extends PriceIndexAreaDto {
  key: string;
  provinceName: string;
  districtName: string;
}

/**
 * Tra cứu chỉ số giá theo tuần — trước đây chỉ thấy được ở cuối trang chi tiết một tin.
 *
 * Trang này trả lời câu hỏi mà người đi tìm nhà và người định bán đều đặt ra trước khi
 * quyết: "giá ở đây đang lên hay xuống?". Nó dùng lại đúng thẻ biểu đồ của trang chi tiết
 * (một nguồn sự thật cho cách vẽ và cách nói về dự báo), và thêm hai thứ chỉ có ý nghĩa khi
 * đứng riêng: bộ chọn quận, và bảng so sánh các quận với nhau.
 */
function PriceIndexPage() {
  const { province, district } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const areasQ = useQuery({
    queryKey: ["price-index-areas"],
    queryFn: priceIndexApi.areas,
    staleTime: 30 * 60_000,
    retry: false,
  });

  const rows: AreaRow[] = useMemo(
    () =>
      (areasQ.data ?? [])
        .map((a) => {
          const name = resolveAreaName(a.province, a.district);
          return {
            ...a,
            key: `${a.province}|${a.district}`,
            provinceName: name?.province ?? a.province,
            districtName: name?.district ?? a.district,
          };
        })
        .sort((a, b) => b.changePoints - a.changePoints),
    [areasQ.data],
  );

  // Khu vực trên URL có thể đến từ trang định giá dưới dạng tên đầy đủ ("Quận 3"), chưa chắc
  // là một quận có chuỗi riêng. Chuẩn hoá rồi so khớp; không khớp thì hiện chuỗi toàn quốc
  // và NÓI RÕ điều đó, thay vì để người dùng tưởng biểu đồ toàn quốc là của quận mình.
  const selectedKey =
    province && district ? `${normProvince(province)}|${normDistrict(district)}` : null;
  const selected = selectedKey ? rows.find((r) => r.key === selectedKey) : undefined;
  const fellBack = !!selectedKey && areasQ.isSuccess && !selected;

  const pick = (key: string) => {
    if (key === NATIONAL) {
      navigate({ search: {}, replace: true });
      return;
    }
    const r = rows.find((x) => x.key === key);
    if (r)
      navigate({ search: { province: r.provinceName, district: r.districtName }, replace: true });
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <PublicHeader />

      <div className="mx-auto max-w-[1200px] px-4 pt-8 lg:pt-12">
        <p className="mb-3 text-xs font-semibold tracking-[0.12em] text-ws-seeker uppercase">
          Tra cứu · chỉ số giá theo tuần
        </p>
        <BlurText
          as="h1"
          text="Thị trường đang lên hay xuống?"
          className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        />
        <p className="mt-3 max-w-[64ch] text-muted-foreground">
          Chỉ số so sánh <em>cùng một kiểu căn nhà</em> qua từng tuần: đã loại trừ ảnh hưởng của vị
          trí, diện tích, loại hình và số phòng, nên nó đo giá thay đổi — không phải danh mục tin
          đăng thay đổi. Tuần gốc bằng 100.
        </p>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="csg-area" className="text-sm font-medium">
                Khu vực
              </label>
              <Select value={selected?.key ?? NATIONAL} onValueChange={pick}>
                <SelectTrigger id="csg-area" className="w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NATIONAL}>Toàn quốc</SelectItem>
                  {rows.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.districtName} · {shortProvince(r.provinceName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {areasQ.isSuccess && (
                <span className="text-xs text-muted-foreground">
                  {rows.length} quận đủ dữ liệu để dựng chuỗi riêng
                </span>
              )}
            </div>

            {fellBack && (
              <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
                {district} chưa đủ tin mỗi tuần để dựng chuỗi riêng — biểu đồ dưới đây là{" "}
                <span className="font-medium">toàn quốc</span>.
              </p>
            )}

            <MarketTrendCard
              key={selected?.key ?? NATIONAL}
              city={selected?.provinceName ?? ""}
              district={selected?.districtName ?? ""}
              chartHeight={300}
            />
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold">Đọc chỉ số thế nào</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="font-medium">106 nghĩa là gì?</dt>
                  <dd className="text-muted-foreground">
                    Cùng một kiểu căn, tuần đó đắt hơn tuần gốc khoảng 6%. Không phải giá mỗi m².
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Vì sao không lấy giá trung vị?</dt>
                  <dd className="text-muted-foreground">
                    Tuần nào nhiều tin ở quận đắt thì trung vị tự nhảy lên dù không căn nào đổi giá.
                    Bấm "Xem cách tính" trên biểu đồ để thấy hai đường lệch nhau thế nào.
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Dự báo có tin được không?</dt>
                  <dd className="text-muted-foreground">
                    Dữ liệu mới có vài tháng. Khi kiểm tra lùi cho sai số lớn, trang nói thẳng là
                    chưa đáng tin thay vì đưa ra một con số trông chắc chắn.
                  </dd>
                </div>
              </dl>
            </div>

            <Link
              to="/dinh-gia"
              className="flex items-center justify-between gap-3 rounded-xl border bg-card p-5 transition-colors hover:bg-accent/50"
            >
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Calculator className="h-4 w-4 text-ws-seeker" />
                  Định giá một căn cụ thể
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Chỉ số cho biết xu hướng; định giá cho biết một căn đáng bao nhiêu.
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </aside>
        </div>

        {/* ---------------- Bảng so sánh các quận ---------------- */}
        <section className="mt-12" aria-labelledby="csg-bang">
          <h2 id="csg-bang" className="text-lg font-semibold tracking-tight">
            So sánh các quận
          </h2>
          <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
            Xếp theo mức thay đổi từ tuần gốc tới tuần gần nhất. Cột <em>dao động</em> cho biết
            chuỗi rung lắc tới đâu mỗi tuần — dao động cao thì mức thay đổi nên đọc như một tín hiệu
            cần xem thêm, chưa phải kết luận.
          </p>

          <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
            {areasQ.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                Chưa có dữ liệu chỉ số theo quận. Dịch vụ chỉ số giá có thể đang tạm dừng.
              </p>
            ) : (
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
                    <th className="px-4 py-2.5 font-medium">#</th>
                    <th className="px-4 py-2.5 font-medium">Quận</th>
                    <th className="px-4 py-2.5 text-right font-medium">Thay đổi</th>
                    <th className="px-4 py-2.5 text-right font-medium">Chỉ số gần nhất</th>
                    <th className="px-4 py-2.5 text-right font-medium">Dao động/tuần</th>
                    <th className="px-4 py-2.5 text-right font-medium">Số tin</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const up = r.changePoints >= 0;
                    const here = r.key === selected?.key;
                    return (
                      <tr
                        key={r.key}
                        className={`border-b last:border-0 ${here ? "bg-ws-seeker-soft" : "hover:bg-muted/40"}`}
                      >
                        <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => pick(r.key)}
                            className="text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                          >
                            {r.districtName}
                          </button>
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {shortProvince(r.provinceName)}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-medium tabular-nums ${up ? "text-success" : "text-destructive"}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {up ? (
                              <TrendingUp className="h-3.5 w-3.5" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5" />
                            )}
                            {up ? "+" : ""}
                            {r.changePoints.toFixed(1).replace(".", ",")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {r.lastIndex.toFixed(1).replace(".", ",")}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                          {r.weeklyVolatility.toFixed(1).replace(".", ",")}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                          {r.n.toLocaleString("vi-VN")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
