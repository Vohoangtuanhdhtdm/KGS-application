import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  Calculator,
  Info,
  LineChart,
  Loader2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { valuationApi, type ValuationRequest, type ValuationResult } from "@/lib/api/valuation";
import { getErrorMessage } from "@/lib/api/errors";
import { formatCurrency } from "@/lib/format";
import { comparePriceToBand } from "@/lib/priceBand";
import { PublicHeader } from "@/components/public/PublicHeader";
import { VietnamAddressPicker } from "@/components/assets/VietnamAddressPicker";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BlurText from "@/components/reactbits/BlurText";
import CountUp from "@/components/reactbits/CountUp";

export const Route = createFileRoute("/dinh-gia")({
  head: () => ({ meta: [{ title: "Định giá bất động sản — KGS" }] }),
  component: ValuationPage,
});

/**
 * Tra cứu định giá — không cần đăng tin, không cần tài khoản.
 *
 * Trước đây mô hình định giá chỉ lộ ra bên trong form đăng tin: muốn biết một căn đáng giá
 * bao nhiêu thì phải giả vờ đăng bán nó. Nhưng nhóm người cần con số này nhiều nhất lại là
 * người MUA — thấy một tin rao 12 tỷ và muốn biết thế là đắt hay rẻ. Trang này dành cho họ,
 * và vì thế có thêm ô "so với một mức giá" mà form đăng tin không cần.
 *
 * Mọi nguyên tắc trình bày giữ nguyên như ở form đăng tin: không bao giờ một con số trần
 * trụi — luôn kèm khoảng, mức tin cậy, và sai số đo được của chính mô hình.
 */

/** Đúng các hạng mục mô hình đã học (models/avm.meta.joblib). Mô hình tự hạ chữ thường,
    nên hiển thị viết hoa đầu câu vẫn khớp. Gửi một chuỗi khác đi là mô hình coi như "không khai". */
const PROPERTY_TYPES = ["Nhà", "Căn hộ chung cư", "Đất", "Biệt thự/Nhà liền kề", "Shophouse"];

/** Dữ liệu huấn luyện có cả "đông nam" lẫn "đông - nam"; dạng không gạch phổ biến hơn. */
const DIRECTIONS = ["Đông", "Tây", "Nam", "Bắc", "Đông Bắc", "Đông Nam", "Tây Bắc", "Tây Nam"];

const NONE = "__none__";

function ValuationPage() {
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [area, setArea] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [floors, setFloors] = useState("");
  const [frontage, setFrontage] = useState("");
  const [direction, setDirection] = useState("");
  const [askPrice, setAskPrice] = useState<number | null>(null);

  const info = useQuery({
    queryKey: ["valuation-model-info"],
    queryFn: valuationApi.modelInfo,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const areaN = Number(area);
  const ready = !!city && !!district && areaN > 0;

  const estimate = useMutation({
    mutationFn: (body: ValuationRequest) => valuationApi.estimate(body),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    estimate.mutate({
      area: areaN,
      city,
      district,
      ward: ward || null,
      propertyType: propertyType || null,
      houseDirection: direction || null,
      bedrooms: num(bedrooms),
      bathrooms: num(bathrooms),
      floors: num(floors),
      frontage: num(frontage),
    });
  };

  const serviceDown = info.isSuccess && !info.data.available;
  const mdape = info.data?.mdape;

  return (
    <div className="min-h-screen bg-background pb-28">
      <PublicHeader />

      <div className="mx-auto max-w-[1200px] px-4 pt-8 lg:pt-12">
        <p className="mb-3 text-xs font-semibold tracking-[0.12em] text-ws-seeker uppercase">
          Tra cứu · không cần đăng tin
        </p>
        <BlurText
          as="h1"
          text="Căn nhà này đáng giá bao nhiêu?"
          className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        />
        <p className="mt-3 max-w-[62ch] text-muted-foreground">
          Nhập vị trí và vài thông số, mô hình trả về một khoảng giá kèm mức tin cậy.
          {mdape != null && (
            <>
              {" "}
              Sai số điển hình khoảng{" "}
              <span className="font-medium text-foreground tabular-nums">
                {mdape.toFixed(1).replace(".", ",")}%
              </span>{" "}
              trên {info.data?.rowsFit?.toLocaleString("vi-VN")} tin đã học — đủ làm mốc so sánh,
              không thay được thẩm định.
            </>
          )}
        </p>
        <Link
          to="/chi-so-gia"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ws-seeker hover:underline"
        >
          <LineChart className="h-4 w-4" />
          Xem thị trường đang lên hay xuống
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>

        {serviceDown && (
          <div className="mt-6 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            Dịch vụ định giá đang tạm dừng. Bạn vẫn xem được{" "}
            <Link to="/chi-so-gia" className="font-medium underline">
              chỉ số giá thị trường
            </Link>
            .
          </div>
        )}

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* ---------------- Biểu mẫu ---------------- */}
          <form onSubmit={submit} className="space-y-6 rounded-xl border bg-card p-5 sm:p-6">
            <fieldset className="space-y-3">
              <legend className="mb-1 text-sm font-semibold">Vị trí</legend>
              <p className="-mt-1 text-xs text-muted-foreground">
                Tỉnh và quận là bắt buộc. Phường không bắt buộc nhưng giúp khoanh vùng giá sát hơn.
              </p>
              <VietnamAddressPicker
                city={city}
                district={district}
                ward={ward}
                required={false}
                onChange={(v) => {
                  setCity(v.city);
                  setDistrict(v.district);
                  setWard(v.ward);
                }}
              />
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="mb-1 text-sm font-semibold">Căn nhà</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="dg-area" label="Diện tích sử dụng (m²)" required>
                  <Input
                    id="dg-area"
                    inputMode="decimal"
                    value={area}
                    onChange={(e) => setArea(e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="Ví dụ: 80"
                  />
                </Field>
                <Field id="dg-type" label="Loại hình">
                  <Select
                    value={propertyType || NONE}
                    onValueChange={(v) => setPropertyType(v === NONE ? "" : v)}
                  >
                    <SelectTrigger id="dg-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Chưa rõ</SelectItem>
                      {PROPERTY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="dg-bed" label="Phòng ngủ">
                  <Input
                    id="dg-bed"
                    inputMode="numeric"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
                <Field id="dg-bath" label="Phòng tắm">
                  <Input
                    id="dg-bath"
                    inputMode="numeric"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
                <Field id="dg-floor" label="Số tầng">
                  <Input
                    id="dg-floor"
                    inputMode="numeric"
                    value={floors}
                    onChange={(e) => setFloors(e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
                <Field id="dg-front" label="Mặt tiền (m)">
                  <Input
                    id="dg-front"
                    inputMode="decimal"
                    value={frontage}
                    onChange={(e) => setFrontage(e.target.value.replace(/[^\d.]/g, ""))}
                  />
                </Field>
                <Field id="dg-dir" label="Hướng nhà">
                  <Select
                    value={direction || NONE}
                    onValueChange={(v) => setDirection(v === NONE ? "" : v)}
                  >
                    <SelectTrigger id="dg-dir">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Chưa rõ</SelectItem>
                      {DIRECTIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold">So với một mức giá</legend>
              <p className="-mt-1 text-xs text-muted-foreground">
                Không bắt buộc. Nhập giá đang rao của một tin bạn thấy, hoặc giá bạn định bán — kết
                quả sẽ nói mức đó nằm trong, trên hay dưới khoảng tham khảo.
              </p>
              <CurrencyInput
                value={askPrice}
                onChange={setAskPrice}
                placeholder="Ví dụ: 8.500.000.000"
              />
            </fieldset>

            <div className="flex flex-wrap items-center gap-3 border-t pt-5">
              <Button type="submit" disabled={!ready || estimate.isPending || serviceDown}>
                {estimate.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="mr-1.5 h-4 w-4" />
                )}
                Định giá
              </Button>
              <span className="text-xs text-muted-foreground">
                {ready
                  ? "Khai càng đủ phòng ngủ, số tầng, mặt tiền thì khoảng ước tính càng hẹp."
                  : "Cần tỉnh, quận và diện tích để bắt đầu."}
              </span>
            </div>
          </form>

          {/* ---------------- Kết quả ---------------- */}
          <div className="lg:sticky lg:top-20" aria-live="polite">
            {estimate.isPending && !estimate.data ? (
              <div className="space-y-3 rounded-xl border bg-card p-6">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : estimate.isError ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm">
                {getErrorMessage(
                  estimate.error,
                  "Không tính được giá ước tính. Thử lại sau ít phút.",
                )}
              </div>
            ) : estimate.data ? (
              <ResultCard
                r={estimate.data}
                askPrice={askPrice}
                city={city}
                district={district}
                mdape={mdape ?? null}
                stale={estimate.isPending}
              />
            ) : (
              <EmptyResult />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function EmptyResult() {
  return (
    <div className="rounded-xl border border-dashed p-6">
      <p className="text-sm font-semibold">Kết quả sẽ hiện ở đây</p>
      <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">Giá ước tính</span> — điểm giữa của khoảng.
        </li>
        <li>
          <span className="font-medium text-foreground">Khoảng tham khảo</span> — hẹp khi mô hình
          chắc chắn, rộng khi khu vực ít dữ liệu hoặc bạn khai ít thông số.
        </li>
        <li>
          <span className="font-medium text-foreground">Mặt bằng khu vực</span> — giá trung vị mỗi
          m² của quận trong dữ liệu, để đối chiếu độc lập với mô hình.
        </li>
      </ul>
    </div>
  );
}

const CONFIDENCE_TONE: Record<string, string> = {
  cao: "bg-success/15 text-success",
  "trung bình": "bg-warning/20 text-warning-foreground",
  thấp: "bg-muted text-muted-foreground",
};

function ResultCard({
  r,
  askPrice,
  city,
  district,
  mdape,
  stale,
}: {
  r: ValuationResult;
  askPrice: number | null;
  city: string;
  district: string;
  mdape: number | null;
  stale: boolean;
}) {
  const dev = comparePriceToBand(r, askPrice);

  // Vị trí trên thanh khoảng. Nới hai đầu thêm 15% để điểm giá người dùng nhập — thường nằm
  // ngoài khoảng, vì đó chính là lý do người ta tra — vẫn vẽ được thay vì dính sát mép.
  const pad = (r.priceHigh - r.priceLow) * 0.15;
  const lo = Math.min(r.priceLow - pad, askPrice && askPrice > 0 ? askPrice : Infinity);
  const hi = Math.max(r.priceHigh + pad, askPrice && askPrice > 0 ? askPrice : -Infinity);
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;

  return (
    <div
      className={`space-y-5 rounded-xl border bg-card p-6 transition-opacity ${stale ? "opacity-60" : ""}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Giá ước tính</p>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CONFIDENCE_TONE[r.confidence] ?? ""}`}
          >
            Độ tin cậy {r.confidence}
          </span>
        </div>
        <CountUp
          key={r.price}
          to={r.price}
          suffix=" ₫"
          className="mt-1 block text-3xl font-bold tracking-tight text-price tabular-nums"
        />
        <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
          ≈ {formatCurrency(r.price, { compact: true })} · khoảng{" "}
          {formatCurrency(r.pricePerM2, { compact: true })}/m²
        </p>
      </div>

      {/* Thanh khoảng: dải = khoảng tham khảo, vạch đậm = giá ước tính, chấm = giá người dùng. */}
      <div>
        <div
          className="relative h-9"
          role="img"
          aria-label={`Khoảng tham khảo từ ${formatCurrency(r.priceLow, { compact: true })} đến ${formatCurrency(r.priceHigh, { compact: true })}`}
        >
          <div className="absolute top-3.5 right-0 left-0 h-2 rounded-full bg-muted" />
          <div
            className="absolute top-3.5 h-2 rounded-full bg-price/35"
            style={{
              left: pos(r.priceLow),
              width: `calc(${pos(r.priceHigh)} - ${pos(r.priceLow)})`,
            }}
          />
          <div
            className="absolute top-2 h-5 w-1 -translate-x-1/2 rounded-full bg-price"
            style={{ left: pos(r.price) }}
          />
          {askPrice != null && askPrice > 0 && (
            <div
              className="absolute top-2.5 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-card bg-foreground"
              style={{ left: pos(askPrice) }}
              title={`Giá bạn nhập: ${formatCurrency(askPrice, { compact: true })}`}
            />
          )}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{formatCurrency(r.priceLow, { compact: true })}</span>
          <span>{formatCurrency(r.priceHigh, { compact: true })}</span>
        </div>
        {askPrice != null && askPrice > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-foreground" /> Giá bạn nhập:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatCurrency(askPrice, { compact: true })}
            </span>
          </p>
        )}
      </div>

      {askPrice != null &&
        askPrice > 0 &&
        (dev ? (
          <div
            className={`rounded-lg border p-3 text-sm ${dev.manh ? "border-warning/40 bg-warning/10" : "bg-muted/40"}`}
          >
            <p className="flex items-center gap-1.5 font-medium">
              {dev.huong === "cao" ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {dev.huong === "cao" ? "Cao hơn" : "Thấp hơn"} ước tính {dev.phanTram}% — nằm ngoài
              khoảng tham khảo
            </p>
            <p className="mt-1 text-muted-foreground">
              {dev.huong === "cao"
                ? dev.manh
                  ? "Lệch khá xa mặt bằng khu vực. Nếu đây là giá rao bạn đang cân nhắc mua, có dư địa để thương lượng — hoặc căn nhà có điểm đặc biệt mà mô hình không thấy được."
                  : "Nhỉnh hơn khoảng tham khảo một chút — chưa đủ để kết luận là đắt."
                : dev.manh
                  ? "Thấp hơn hẳn mặt bằng. Đáng kiểm tra kỹ pháp lý và hiện trạng trước khi coi đây là món hời — hoặc kiểm tra lại đơn vị giá."
                  : "Thấp hơn khoảng tham khảo một chút."}
            </p>
          </div>
        ) : r.confidence === "thấp" ? (
          <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            Mô hình tự nhận độ tin cậy thấp ở khu vực này, nên không so sánh mức giá bạn nhập — kết
            luận dựa trên một ước tính không chắc chắn còn tệ hơn không kết luận.
          </p>
        ) : (
          <p className="rounded-lg bg-success/10 p-3 text-sm">
            Mức giá bạn nhập nằm trong khoảng tham khảo.
          </p>
        ))}

      {r.areaMedianPricePerM2 != null && (
        <p className="text-sm text-muted-foreground">
          Mặt bằng {district}:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatCurrency(r.areaMedianPricePerM2, { compact: true })}/m²
          </span>{" "}
          (trung vị của {r.areaSampleSize.toLocaleString("vi-VN")} tin).
        </p>
      )}

      {r.notes.length > 0 && (
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {r.notes.map((n) => (
            <li key={n} className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {n}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 border-t pt-4">
        <Link
          to="/chi-so-gia"
          search={{ province: city, district }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ws-seeker hover:underline"
        >
          <LineChart className="h-4 w-4" />
          Giá ở {district} đang lên hay xuống?
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <p className="text-xs text-muted-foreground">
          Ước tính từ mô hình học máy trên giá RAO bán, không phải giá giao dịch.
          {mdape != null && ` Sai số trung vị khoảng ${mdape.toFixed(1).replace(".", ",")}%.`} Dùng
          làm mốc tham khảo, không phải giá thẩm định.
        </p>
      </div>
    </div>
  );
}
