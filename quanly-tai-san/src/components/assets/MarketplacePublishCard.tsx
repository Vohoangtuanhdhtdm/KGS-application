import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assetsApi } from "@/lib/api/assets";
import {
  listingsApi,
  formatListingPrice,
  EMPTY_TERMS,
  type CreateListingInput,
  type ListingTermsDto,
  type OwnerListingDto,
} from "@/lib/api/listings";
import { ListingTermsFields } from "@/components/listings/ListingTermsFields";
import { getErrorMessage } from "@/lib/api/errors";
import { ApiError } from "@/lib/auth/types";
import {
  LISTING_TYPE,
  ASSET_TYPE,
  PAYMENT_CYCLE,
  LISTING_STATUS,
  LISTING_STATUS_CLASS,
  enumOptions,
  type ListingTypeCode,
  type PaymentCycleCode,
} from "@/constants/enums";
import {
  AssetSpecsFields,
  specsFromApi,
  specsToApi,
  hasAnySpec,
  type SpecsState,
} from "./AssetSpecsFields";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Globe, Check, Loader2, ImageIcon, ExternalLink, Eye } from "lucide-react";

/**
 * Card "Đăng tin công khai lên Marketplace" trong tab Rao bán.
 * Liệt kê các tin đang sống của tài sản (nguyên căn và/hoặc từng phòng) kèm nút đăng tin mới.
 */
export function MarketplacePublishCard({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false);
  // Đọc từ cache ["asset", assetId] (trang chi tiết đã load) để biết đã có tin chưa
  const assetQ = useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => assetsApi.detail(assetId),
    retry: 1,
  });

  const listingsQ = useQuery({
    queryKey: ["asset-listings", assetId],
    queryFn: () => listingsApi.byAsset(assetId),
    retry: 1,
  });
  const listings = listingsQ.data ?? [];
  const liveListings = listings.filter((l) => l.status === 1 || l.status === 2);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Đăng tin công khai lên Marketplace
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Đăng tin cho nguyên căn, hoặc cho từng phòng riêng. Tin chờ quản trị viên duyệt trước
          khi hiển thị công khai.
        </p>

        {liveListings.length > 0 && <LiveListings listings={liveListings} />}

        <Button onClick={() => setOpen(true)} disabled={assetQ.isLoading || listingsQ.isLoading}>
          <Globe className="h-4 w-4 mr-1.5" />
          Đăng tin mới
        </Button>
      </CardContent>

      <PublishDialog key={String(open)} assetId={assetId} open={open} onOpenChange={setOpen} />
    </Card>
  );
}

/** Các tin đang chờ duyệt hoặc đang hiển thị của tài sản này. Một tài sản nay có thể
 *  có nhiều tin: một tin cho nguyên căn, hoặc mỗi phòng một tin. */
function LiveListings({ listings }: { listings: OwnerListingDto[] }) {
  return (
    <div className="space-y-2">
      {listings.map((l) => (
        <div key={l.id} className="flex items-center gap-3 flex-wrap rounded-md border px-3 py-2">
          <span className="text-sm font-medium">{l.unitName ?? "Nguyên căn"}</span>
          <Badge variant="outline" className={LISTING_STATUS_CLASS[l.status]}>
            {LISTING_STATUS[l.status]}
          </Badge>
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            {l.viewCount}
          </span>
          {l.moderationNote && (
            <span className="text-xs text-warning-foreground">{l.moderationNote}</span>
          )}
          <Link to="/tin-cua-toi" className="text-sm text-primary hover:underline ml-auto">
            Quản lý
          </Link>
        </div>
      ))}
    </div>
  );
}

const STEP_LABELS = ["Loại tin", "Nội dung", "Điều kiện thuê", "Chọn ảnh", "Xác nhận"];

function PublishDialog({
  assetId,
  open,
  onOpenChange,
}: {
  assetId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);

  // Bước 1
  const [type, setType] = useState<ListingTypeCode>(1);
  const [rentPaymentCycle, setRentPaymentCycle] = useState<PaymentCycleCode>(1);
  // Bước 2
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  // Bước 3 — phạm vi đăng: nguyên căn hay một phòng cụ thể.
  // KHÔNG còn ô nhập thông số ở đây: sau khi gộp Property vào Asset, mọi thông số vật lý
  // chỉ có một nguồn duy nhất là tài sản. Ô "chỉnh sửa thông số riêng cho tin đăng" cũ
  // chính là chỗ sinh ra dữ liệu lệch giữa hai bảng.
  const [assetUnitId, setAssetUnitId] = useState<string>("");
  const [terms, setTerms] = useState<ListingTermsDto>(EMPTY_TERMS);
  const [amenities, setAmenities] = useState<string[]>([]);
  // Bước 4
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [conflict, setConflict] = useState<string | null>(null);

  // Đọc asset để lấy các trường đã có sẵn (loại hình, số tầng, phòng ngủ, phòng tắm, hướng nhà, pháp lý, nội thất)
  const assetQ = useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => assetsApi.detail(assetId),
    enabled: open,
    retry: 1,
  });
  const asset = assetQ.data;

  // Prefill giá từ giá trị hiện tại của tài sản. Trước đây lấy từ module rao bán
  // nội bộ — module đó đã được gỡ vì nằm ngoài trục nghiệp vụ cho thuê.
  if (open && !prefilled && asset?.currentValue && price === null) {
    setPrice(asset.currentValue);
    setPrefilled(true);
  }

  const unitsQ = useQuery({
    queryKey: ["asset-units", assetId],
    queryFn: () => assetsApi.units.list(assetId),
    enabled: open,
    retry: 1,
  });

  const mediaQ = useQuery({
    queryKey: ["asset-media", assetId],
    queryFn: () => assetsApi.media.list(assetId),
    enabled: open,
    retry: 1,
  });
  const media = mediaQ.data ?? [];

  const num = (s: string): number | null => (s.trim() === "" ? null : Number(s));

  const create = useMutation({
    mutationFn: () => {
      // Payload nay chi con thong tin cua TIN DANG. Moi thuoc tinh vat ly doc tu Asset.
      const body: CreateListingInput = {
        type,
        assetUnitId: assetUnitId || null,
        title: title.trim(),
        description: description.trim(),
        price: price ?? 0,
        rentPaymentCycle: type === 2 ? rentPaymentCycle : null,
        selectedAssetMediaIds: selectedIds,
        terms,
        amenities,
      };
      return listingsApi.create(assetId, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset", assetId] });
      qc.invalidateQueries({ queryKey: ["asset-listings", assetId] });
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      toast.success("Đã gửi tin đăng, đang chờ duyệt.");
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflict(getErrorMessage(err, "Tài sản này đã có tin đăng liên kết."));
        return;
      }
      toast.error(getErrorMessage(err, "Không gửi được tin đăng"));
    },
  });

  const priceLabel = type === 2 ? "Giá thuê (VNĐ)" : "Giá bán (VNĐ)";

  const canNext = (): boolean => {
    if (step === 1) {
      if (!title.trim()) return toastFalse("Vui lòng nhập tiêu đề");
      if (!description.trim()) return toastFalse("Vui lòng nhập mô tả");
      if (!price || price <= 0) return toastFalse("Vui lòng nhập giá hợp lệ");
    }
    if (step === 3 && selectedIds.length === 0) {
      return toastFalse("Chọn ít nhất 1 ảnh để đăng tin");
    }
    return true;
  };

  const toggleImage = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Dialog open={open} onOpenChange={(v) => !create.isPending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Đăng tin công khai — Bước {step + 1}/5</DialogTitle>
          <DialogDescription>{STEP_LABELS[step]}</DialogDescription>
        </DialogHeader>

        {/* thanh tiến trình các bước */}
        <div className="flex items-center gap-1.5">
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              className={`h-1.5 flex-1 rounded ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <div className="py-2">
          {/* Bước 1 — loại tin */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Loại tin *</Label>
                <RadioGroup
                  className="flex gap-6"
                  value={String(type)}
                  onValueChange={(v) => setType(Number(v) as ListingTypeCode)}
                >
                  {enumOptions(LISTING_TYPE).map((o) => (
                    <div key={o.value} className="flex items-center gap-2">
                      <RadioGroupItem value={String(o.value)} id={`lt-${o.value}`} />
                      <Label htmlFor={`lt-${o.value}`} className="cursor-pointer font-medium">
                        {o.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              {type === 2 && (
                <div className="space-y-2 max-w-xs">
                  <Label>Chu kỳ thanh toán *</Label>
                  <Select
                    value={String(rentPaymentCycle)}
                    onValueChange={(v) => setRentPaymentCycle(Number(v) as PaymentCycleCode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {enumOptions(PAYMENT_CYCLE).map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Bước 2 — nội dung */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Tiêu đề *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Nhà phố 3 tầng mặt tiền Quận 7"
                />
              </div>
              <div className="space-y-2">
                <Label>Mô tả *</Label>
                <Textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả chi tiết vị trí, tiện ích, tình trạng..."
                />
              </div>
              <div className="space-y-2 max-w-xs">
                <Label>{priceLabel} *</Label>
                <CurrencyInput value={price} onChange={setPrice} />
                {prefilled && (
                  <p className="text-xs text-muted-foreground">
                    Đã điền sẵn từ giá rao bán nội bộ — bạn có thể sửa lại.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Bước 3 — phạm vi đăng + thông số CHỈ ĐỌC lấy từ tài sản */}
          {step === 2 && asset && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Đăng tin cho</Label>
                <Select value={assetUnitId || "whole"} onValueChange={(v) => setAssetUnitId(v === "whole" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whole">Nguyên căn</SelectItem>
                    {(unitsQ.data ?? []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                        {u.area ? ` — ${u.area} m²` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Chọn một phòng để đăng riêng phòng đó. Mỗi phòng có thể có tin đăng riêng.
                </p>
              </div>

              <ListingTermsFields
                value={terms}
                onChange={setTerms}
                amenities={amenities}
                onAmenitiesChange={setAmenities}
                isRent={type === 2}
              />

              <SpecsPreview asset={asset} />

              <p className="text-xs text-muted-foreground">
                Thông số lấy trực tiếp từ tài sản, không nhập lại ở đây — sửa một lần ở trang
                tài sản là mọi tin đăng cập nhật theo.{" "}
                <Link
                  to="/quan-ly/tai-san/$id/sua"
                  params={{ id: assetId }}
                  className="text-primary hover:underline"
                >
                  Sửa thông tin tài sản
                </Link>
              </p>
            </div>
          )}

          {/* Bước 4 — chọn ảnh */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Chọn ảnh từ thư viện của tài sản để hiển thị công khai (ít nhất 1 ảnh).
              </p>
              {mediaQ.isLoading ? (
                <div className="text-sm text-muted-foreground">Đang tải ảnh...</div>
              ) : media.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  Tài sản chưa có ảnh nào. Hãy thêm ảnh ở tab Ảnh trước khi đăng tin.
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {media.map((m) => {
                    const checked = selectedIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleImage(m.id)}
                        className={`relative aspect-square rounded-md overflow-hidden border-2 ${
                          checked ? "border-primary" : "border-transparent"
                        }`}
                      >
                        <img src={m.file.url} alt="" className="w-full h-full object-cover" />
                        <span
                          className={`absolute top-1 right-1 h-5 w-5 rounded-full flex items-center justify-center ${
                            checked
                              ? "bg-primary text-primary-foreground"
                              : "bg-black/40 text-white"
                          }`}
                        >
                          {checked && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="text-xs text-muted-foreground">Đã chọn {selectedIds.length} ảnh.</div>
            </div>
          )}

          {/* Bước 5 — xác nhận */}
          {step === 4 && (
            <ConfirmStep
              type={type}
              title={title}
              price={price}
              rentPaymentCycle={rentPaymentCycle}
              imageCount={selectedIds.length}
              conflict={conflict}
            />
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={() => (step === 0 ? onOpenChange(false) : setStep((s) => s - 1))}
            disabled={create.isPending}
          >
            {step === 0 ? "Huỷ" : "Quay lại"}
          </Button>
          {step < 4 ? (
            <Button
              onClick={() => {
                if (canNext()) setStep((s) => s + 1);
              }}
            >
              Tiếp tục
            </Button>
          ) : (
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {create.isPending ? "Đang gửi..." : "Gửi tin đăng"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmStep({
  type,
  title,
  price,
  rentPaymentCycle,
  imageCount,
  conflict,
}: {
  type: ListingTypeCode;
  title: string;
  price: number | null;
  rentPaymentCycle: PaymentCycleCode;
  imageCount: number;
  conflict: string | null;
}) {
  const rows = useMemo(
    () => [
      ["Loại tin", LISTING_TYPE[type]],
      ["Tiêu đề", title || "—"],
      ["Giá", price ? formatListingPrice(price, type, type === 2 ? rentPaymentCycle : null) : "—"],
      ["Số ảnh đã chọn", String(imageCount)],
    ],
    [type, title, price, rentPaymentCycle, imageCount],
  );

  return (
    <div className="space-y-3">
      <div className="rounded-md border divide-y">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-right">{value}</span>
          </div>
        ))}
      </div>
      {conflict ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive space-y-1.5">
          <div>{conflict}</div>
          <Link
            to="/tin-cua-toi"
            className="inline-flex items-center gap-1 font-medium hover:underline"
          >
            Tới "Tin đăng của tôi" để sửa tin hiện có
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          Tin đăng sẽ ở trạng thái <Badge variant="outline">Chờ duyệt</Badge> cho tới khi quản trị
          viên phê duyệt.
        </div>
      )}
    </div>
  );
}

// Helper: hiện toast lỗi và trả false để chặn chuyển bước
function toastFalse(msg: string): false {
  toast.error(msg);
  return false;
}

/** Kiểm tra Asset đã đủ 6 trường mô tả chi tiết chưa. */
function hasAllSpecs(
  a: {
    floors: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    houseDirection: string | null;
    legalStatus: string | null;
    furnitureState: string | null;
  } | null,
): boolean {
  if (!a) return false;
  return (
    a.floors != null &&
    a.bedrooms != null &&
    a.bathrooms != null &&
    !!a.houseDirection &&
    !!a.legalStatus &&
    !!a.furnitureState
  );
}

/** Card preview 6 trường + loại hình lấy từ Asset (read-only). */
function SpecsPreview({
  asset,
}: {
  asset: {
    type: number;
    floors: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    houseDirection: string | null;
    legalStatus: string | null;
    furnitureState: string | null;
  };
}) {
  const fmt = (v: number | string | null, unit = "") =>
    v == null || v === "" ? "—" : `${v}${unit}`;
  return (
    <div className="rounded-md border bg-muted/40 p-3 space-y-2">
      <div className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
        📋 Thông số lấy từ tài sản
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
        <div>
          <span className="text-muted-foreground">Loại hình:</span>{" "}
          <span className="font-medium">
            {ASSET_TYPE[asset.type as keyof typeof ASSET_TYPE] ?? "—"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Số tầng:</span>{" "}
          <span className="font-medium">{fmt(asset.floors)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Phòng ngủ:</span>{" "}
          <span className="font-medium">{fmt(asset.bedrooms)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Phòng tắm:</span>{" "}
          <span className="font-medium">{fmt(asset.bathrooms)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Hướng nhà:</span>{" "}
          <span className="font-medium">{fmt(asset.houseDirection)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Pháp lý:</span>{" "}
          <span className="font-medium">{fmt(asset.legalStatus)}</span>
        </div>
        <div className="col-span-2 md:col-span-3">
          <span className="text-muted-foreground">Nội thất:</span>{" "}
          <span className="font-medium">{fmt(asset.furnitureState)}</span>
        </div>
      </div>
    </div>
  );
}
