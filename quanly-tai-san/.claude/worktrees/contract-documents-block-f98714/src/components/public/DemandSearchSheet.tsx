import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
// vietnam-provinces build ra 2 định dạng khác nhau: client dùng bản ESM (named export
// nằm thẳng trên namespace), SSR (module runner của Vite) dùng bản CJS UMD và bọc toàn bộ
// module.exports vào field `default` của namespace. Named-export import thẳng bị Vite báo
// lỗi phân tích tĩnh ở SSR, nên phải import namespace rồi tự chuẩn hoá lại 2 hình dạng này.
import * as vietnamProvincesNs from "vietnam-provinces";
import { toast } from "sonner";
import type { ListingTypeCode } from "@/constants/enums";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, LocateFixed, Loader2, X } from "lucide-react";

const vietnamProvinces: typeof import("vietnam-provinces") =
  (vietnamProvincesNs as { default?: typeof import("vietnam-provinces") }).default ??
  vietnamProvincesNs;

export interface DemandSearchResult {
  type: ListingTypeCode;
  priceMin: number | null;
  priceMax: number | null;
  bedroomsMin: number | null;
  location:
    | { kind: "address"; query: string }
    | { kind: "district"; city: string; district: string }
    | { kind: "myLocation"; radiusKm: number }
    | null;
}

interface PriceChip {
  label: string;
  min: number | null;
  max: number | null;
}

const SALE_PRICE_CHIPS: PriceChip[] = [
  { label: "Dưới 2 tỷ", min: null, max: 2_000_000_000 },
  { label: "2 - 5 tỷ", min: 2_000_000_000, max: 5_000_000_000 },
  { label: "5 - 10 tỷ", min: 5_000_000_000, max: 10_000_000_000 },
  { label: "Trên 10 tỷ", min: 10_000_000_000, max: null },
];

const RENT_PRICE_CHIPS: PriceChip[] = [
  { label: "Dưới 5 triệu", min: null, max: 5_000_000 },
  { label: "5 - 10 triệu", min: 5_000_000, max: 10_000_000 },
  { label: "10 - 20 triệu", min: 10_000_000, max: 20_000_000 },
  { label: "Trên 20 triệu", min: 20_000_000, max: null },
];

type LocationMode = "" | "address" | "district" | "myLocation";

interface DemandSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (result: DemandSearchResult) => void;
  myLocationPending: boolean;
}

/**
 * Form "Tìm theo nhu cầu" — chỉ gồm các tiêu chí mà API tìm kiếm công khai
 * (`PublicListingFilters`) thực sự lọc được: Mua/Thuê, khoảng giá, phòng ngủ, vị trí.
 * Không có "Loại hình" hay tuỳ chọn nâng cao (phòng tắm/hướng nhà/pháp lý/nội thất) vì
 * backend search hiện chưa nhận các tham số đó — thêm vào sẽ chỉ là UI không có tác dụng.
 */
export function DemandSearchSheet({
  open,
  onOpenChange,
  onApply,
  myLocationPending,
}: DemandSearchSheetProps) {
  const [demandType, setDemandType] = useState<ListingTypeCode>(1);
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [activeChipIndex, setActiveChipIndex] = useState<number | null>(null);
  const [bedroomsMin, setBedroomsMin] = useState<number | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>("");
  const [addressInput, setAddressInput] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [districtCode, setDistrictCode] = useState("");
  const [radiusKmInput, setRadiusKmInput] = useState("5");

  const provinces = useMemo(() => vietnamProvinces.getProvinces(), []);
  const districts = useMemo(
    () => (provinceCode ? vietnamProvinces.getDistricts(provinceCode) : []),
    [provinceCode],
  );
  const priceChips = demandType === 1 ? SALE_PRICE_CHIPS : RENT_PRICE_CHIPS;

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const selectType = (t: ListingTypeCode) => {
    setDemandType(t);
    setPriceMin(null);
    setPriceMax(null);
    setActiveChipIndex(null);
  };

  const handleSubmit = () => {
    let location: DemandSearchResult["location"] = null;

    if (locationMode === "address") {
      const query = addressInput.trim();
      if (query) location = { kind: "address", query };
    } else if (locationMode === "district") {
      const cityName = provinces.find((p) => p.code === provinceCode)?.name;
      const districtName = districts.find((d) => d.code === districtCode)?.name;
      if (cityName && districtName)
        location = { kind: "district", city: cityName, district: districtName };
    } else if (locationMode === "myLocation") {
      const km = Number(radiusKmInput.replace(",", "."));
      if (!Number.isFinite(km) || km < 0.5 || km > 50) {
        toast.error("Bán kính phải trong khoảng 0.5 – 50 km");
        return;
      }
      location = { kind: "myLocation", radiusKm: km };
    }

    onApply({ type: demandType, priceMin, priceMax, bedroomsMin, location });
  };

  if (!open) return null;

  // Modal căn giữa qua Portal thẳng vào document.body — không lồng trong container cha
  // nào có thể có overflow:hidden/auto (bài học từ lỗi popover vị trí trước đó). Trước
  // đây dùng Sheet (drawer trượt từ phải) nhưng bị tràn khỏi viewport; đổi sang modal
  // căn giữa với maxWidth/maxHeight + overflowY cố định để không lặp lại lỗi tương tự.
  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center p-4"
      style={{ zIndex: 1000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className="bg-background text-foreground border rounded-lg shadow-lg w-full flex flex-col"
        style={{ maxWidth: 560, maxHeight: "85vh" }}
      >
        <div className="flex items-center justify-between gap-4 p-6 pb-0 shrink-0">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            Tìm bất động sản theo nhu cầu của bạn
          </h2>
          <button
            type="button"
            className="rounded-sm opacity-70 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
            aria-label="Đóng"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="space-y-2">
            <Label>Bạn muốn</Label>
            <div className="inline-flex rounded-md border p-0.5">
              <Button
                type="button"
                size="sm"
                variant={demandType === 1 ? "default" : "ghost"}
                className="rounded-sm"
                onClick={() => selectType(1)}
              >
                Mua
              </Button>
              <Button
                type="button"
                size="sm"
                variant={demandType === 2 ? "default" : "ghost"}
                className="rounded-sm"
                onClick={() => selectType(2)}
              >
                Thuê
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Khoảng giá</Label>
            <div className="flex flex-wrap gap-1.5">
              {priceChips.map((chip, i) => (
                <Button
                  key={chip.label}
                  type="button"
                  size="sm"
                  variant={activeChipIndex === i ? "default" : "outline"}
                  className="h-8"
                  onClick={() => {
                    setActiveChipIndex(i);
                    setPriceMin(chip.min);
                    setPriceMax(chip.max);
                  }}
                >
                  {chip.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Từ (VNĐ)</Label>
                <CurrencyInput
                  value={priceMin}
                  onChange={(v) => {
                    setPriceMin(v);
                    setActiveChipIndex(null);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Đến (VNĐ)</Label>
                <CurrencyInput
                  value={priceMax}
                  onChange={(v) => {
                    setPriceMax(v);
                    setActiveChipIndex(null);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Phòng ngủ tối thiểu</Label>
            <div className="flex gap-1.5">
              {[null, 1, 2, 3, 4].map((n) => (
                <Button
                  key={String(n)}
                  type="button"
                  size="sm"
                  variant={bedroomsMin === n ? "default" : "outline"}
                  className="h-8 flex-1 px-0"
                  onClick={() => setBedroomsMin(n)}
                >
                  {n == null ? "Tất cả" : `${n}+`}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Vị trí mong muốn</Label>
            <RadioGroup
              value={locationMode}
              onValueChange={(v) => setLocationMode(v as LocationMode)}
              className="gap-3"
            >
              <div className="flex items-start gap-2">
                <RadioGroupItem value="address" id="demand-loc-address" className="mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="demand-loc-address" className="font-normal cursor-pointer">
                    Nhập địa chỉ/khu vực
                  </Label>
                  {locationMode === "address" && (
                    <Input
                      placeholder="VD: Quận 7, TP.HCM"
                      value={addressInput}
                      onChange={(e) => setAddressInput(e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <RadioGroupItem value="district" id="demand-loc-district" className="mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="demand-loc-district" className="font-normal cursor-pointer">
                    Chọn Quận/Huyện
                  </Label>
                  {locationMode === "district" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={provinceCode}
                        onValueChange={(code) => {
                          setProvinceCode(code);
                          setDistrictCode("");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tỉnh/Thành" />
                        </SelectTrigger>
                        <SelectContent>
                          {provinces.map((p) => (
                            <SelectItem key={p.code} value={p.code}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={districtCode}
                        onValueChange={setDistrictCode}
                        disabled={!provinceCode}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={provinceCode ? "Quận/Huyện" : "Chọn tỉnh trước"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {districts.map((d) => (
                            <SelectItem key={d.code} value={d.code}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <RadioGroupItem value="myLocation" id="demand-loc-my" className="mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <Label
                    htmlFor="demand-loc-my"
                    className="font-normal cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <LocateFixed className="h-3.5 w-3.5" />
                    Gần vị trí hiện tại
                  </Label>
                  {locationMode === "myLocation" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0.5}
                        max={50}
                        step={0.5}
                        className="w-24"
                        value={radiusKmInput}
                        onChange={(e) => setRadiusKmInput(e.target.value)}
                      />
                      <span className="text-sm text-muted-foreground">km</span>
                      {myLocationPending && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-6 pt-4 border-t shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Tìm kiếm
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
