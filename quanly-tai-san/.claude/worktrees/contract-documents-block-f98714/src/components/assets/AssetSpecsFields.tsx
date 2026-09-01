import { useState } from "react";
import type { AssetDetailSpecs } from "@/lib/api/assets";
import {
  HOUSE_DIRECTIONS,
  LEGAL_STATUS_OPTIONS,
  FURNITURE_STATE_OPTIONS,
  OTHER_OPTION,
} from "@/constants/enums";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Info } from "lucide-react";

export type SpecsState = {
  floors: string;
  bedrooms: string;
  bathrooms: string;
  houseDirection: string;
  legalStatus: string;
  legalStatusOther: string;
  furnitureState: string;
  furnitureStateOther: string;
};

export const emptySpecs: SpecsState = {
  floors: "",
  bedrooms: "",
  bathrooms: "",
  houseDirection: "",
  legalStatus: "",
  legalStatusOther: "",
  furnitureState: "",
  furnitureStateOther: "",
};

/** Đổ dữ liệu từ API về state form; giá trị lạ (không có trong dropdown) rơi vào ô "Khác". */
export function specsFromApi(a: AssetDetailSpecs | null | undefined): SpecsState {
  if (!a) return emptySpecs;
  const legalKnown = LEGAL_STATUS_OPTIONS.includes(
    (a.legalStatus ?? "") as (typeof LEGAL_STATUS_OPTIONS)[number],
  );
  const furnKnown = FURNITURE_STATE_OPTIONS.includes(
    (a.furnitureState ?? "") as (typeof FURNITURE_STATE_OPTIONS)[number],
  );
  return {
    floors: a.floors != null ? String(a.floors) : "",
    bedrooms: a.bedrooms != null ? String(a.bedrooms) : "",
    bathrooms: a.bathrooms != null ? String(a.bathrooms) : "",
    houseDirection: a.houseDirection ?? "",
    legalStatus: a.legalStatus ? (legalKnown ? a.legalStatus : OTHER_OPTION) : "",
    legalStatusOther: a.legalStatus && !legalKnown ? a.legalStatus : "",
    furnitureState: a.furnitureState ? (furnKnown ? a.furnitureState : OTHER_OPTION) : "",
    furnitureStateOther: a.furnitureState && !furnKnown ? a.furnitureState : "",
  };
}

/** Chuyển state form về payload API — ô trống trả null. */
export function specsToApi(s: SpecsState): Required<AssetDetailSpecs> {
  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));
  const pick = (choice: string, other: string): string | null => {
    if (!choice) return null;
    if (choice === OTHER_OPTION) return other.trim() || null;
    return choice;
  };
  return {
    floors: num(s.floors),
    bedrooms: num(s.bedrooms),
    bathrooms: num(s.bathrooms),
    houseDirection: s.houseDirection || null,
    legalStatus: pick(s.legalStatus, s.legalStatusOther),
    furnitureState: pick(s.furnitureState, s.furnitureStateOther),
  };
}

export function hasAnySpec(s: SpecsState): boolean {
  const v = specsToApi(s);
  return Object.values(v).some((x) => x !== null && x !== "");
}

interface Props {
  value: SpecsState;
  onChange: (next: SpecsState) => void;
  /** Bọc trong khối thu gọn (form tạo/sửa tài sản). Đặt false khi nhúng vào nơi đã có khung riêng. */
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function AssetSpecsFields({ value, onChange, collapsible = true, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? hasAnySpec(value));
  const set = (patch: Partial<SpecsState>) => onChange({ ...value, ...patch });

  const fields = (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Số tầng</Label>
          <Input
            type="number"
            min={0}
            value={value.floors}
            onChange={(e) => set({ floors: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Số phòng ngủ</Label>
          <Input
            type="number"
            min={0}
            value={value.bedrooms}
            onChange={(e) => set({ bedrooms: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Số phòng tắm</Label>
          <Input
            type="number"
            min={0}
            value={value.bathrooms}
            onChange={(e) => set({ bathrooms: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Hướng nhà</Label>
          <Select value={value.houseDirection} onValueChange={(v) => set({ houseDirection: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn hướng" />
            </SelectTrigger>
            <SelectContent>
              {HOUSE_DIRECTIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tình trạng nội thất</Label>
          <Select value={value.furnitureState} onValueChange={(v) => set({ furnitureState: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn tình trạng" />
            </SelectTrigger>
            <SelectContent>
              {FURNITURE_STATE_OPTIONS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {value.furnitureState === OTHER_OPTION && (
            <Input
              placeholder="Mô tả nội thất"
              value={value.furnitureStateOther}
              onChange={(e) => set({ furnitureStateOther: e.target.value })}
            />
          )}
        </div>
      </div>

      <div className="space-y-2 max-w-sm">
        <Label>Tình trạng pháp lý</Label>
        <Select value={value.legalStatus} onValueChange={(v) => set({ legalStatus: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Chọn tình trạng pháp lý" />
          </SelectTrigger>
          <SelectContent>
            {LEGAL_STATUS_OPTIONS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.legalStatus === OTHER_OPTION && (
          <Input
            placeholder="Mô tả tình trạng pháp lý"
            value={value.legalStatusOther}
            onChange={(e) => set({ legalStatusOther: e.target.value })}
          />
        )}
      </div>
    </div>
  );

  if (!collapsible) return fields;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger className="group w-full flex items-start justify-between gap-3 p-4 text-left">
        <div>
          <div className="font-medium">
            Thông tin mô tả chi tiết{" "}
            <span className="text-muted-foreground font-normal">
              (tuỳ chọn — dùng khi đăng tin công khai)
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
            Điền một lần ở đây, hệ thống sẽ tự dùng lại khi bạn đăng tin công khai — không cần nhập
            lại.
          </p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="p-4 pt-0">{fields}</CollapsibleContent>
    </Collapsible>
  );
}
