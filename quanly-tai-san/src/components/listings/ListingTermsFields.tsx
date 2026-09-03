import { useState } from "react";
import { AMENITY_LIST, WATER_PRICING, type AmenityKey } from "@/constants/enums";
import type { ListingTermsDto } from "@/lib/api/listings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Form điều kiện thuê, chia làm HAI LỚP có chủ đích.
 *
 * Lớp bắt buộc là những gì người thuê hỏi trước khi quyết định đi xem: cọc bao nhiêu, điện
 * nước tính sao, khi nào dọn vào được. Lớp mở rộng (nội quy, tiện nghi) nằm sau một cú click.
 *
 * Không bắt buộc nhập hết. Thay vào đó thanh "độ đầy đủ" ở màn hình Tin đăng của tôi cho
 * thấy tin càng đầy dữ kiện càng được bộ lọc tìm thấy — động lực thật, thay vì ép buộc.
 */
export function ListingTermsFields({
  value,
  onChange,
  amenities,
  onAmenitiesChange,
  /** Tin bán không có cọc/điện nước/nội quy — chỉ hiện phần tiện nghi. */
  isRent,
}: {
  value: ListingTermsDto;
  onChange: (next: ListingTermsDto) => void;
  amenities: string[];
  onAmenitiesChange: (next: string[]) => void;
  isRent: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const set = <K extends keyof ListingTermsDto>(key: K, v: ListingTermsDto[K]) =>
    onChange({ ...value, [key]: v });

  const num = (s: string): number | null => (s.trim() === "" ? null : Number(s));

  const toggleAmenity = (key: AmenityKey) =>
    onAmenitiesChange(
      amenities.includes(key) ? amenities.filter((a) => a !== key) : [...amenities, key],
    );

  return (
    <div className="space-y-5">
      {isRent && (
        <>
          <div className="space-y-3">
            <p className="text-sm font-medium">Chi phí — người thuê hỏi đầu tiên</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tiền cọc (tháng)">
                <Input
                  type="number"
                  min={0}
                  max={12}
                  value={value.depositMonths ?? ""}
                  onChange={(e) => set("depositMonths", num(e.target.value))}
                  placeholder="1"
                />
              </Field>
              <Field label="Tiền điện (đ/kWh)">
                <Input
                  type="number"
                  min={0}
                  value={value.electricityPrice ?? ""}
                  onChange={(e) => set("electricityPrice", num(e.target.value))}
                  placeholder="3800"
                />
              </Field>
              <Field label="Tiền nước">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={value.waterPrice ?? ""}
                    onChange={(e) => set("waterPrice", num(e.target.value))}
                    placeholder="100000"
                  />
                  <Select
                    value={value.waterPricing ? String(value.waterPricing) : "2"}
                    onValueChange={(v) => set("waterPricing", Number(v) as 1 | 2)}
                  >
                    <SelectTrigger className="w-[132px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(WATER_PRICING).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Phí dịch vụ (đ/tháng)">
                <Input
                  type="number"
                  min={0}
                  value={value.serviceFee ?? ""}
                  onChange={(e) => set("serviceFee", num(e.target.value))}
                  placeholder="150000"
                />
              </Field>
              <Field label="Gửi xe (đ/tháng)">
                <Input
                  type="number"
                  min={0}
                  value={value.parkingFee ?? ""}
                  onChange={(e) => set("parkingFee", num(e.target.value))}
                  placeholder="100000"
                />
              </Field>
              <Field label="Internet (đ/tháng)">
                <Input
                  type="number"
                  min={0}
                  value={value.internetFee ?? ""}
                  onChange={(e) => set("internetFee", num(e.target.value))}
                  placeholder="100000"
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Phí dịch vụ, gửi xe và internet được cộng vào tổng chi phí hiển thị cho người
              thuê. Điện và nước tính theo mức dùng nên không cộng — hiện riêng.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Điều kiện thuê</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Dọn vào được từ">
                <Input
                  type="date"
                  value={value.availableFrom ? value.availableFrom.slice(0, 10) : ""}
                  onChange={(e) =>
                    set("availableFrom", e.target.value ? new Date(e.target.value).toISOString() : null)
                  }
                />
              </Field>
              <Field label="Thuê tối thiểu (tháng)">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={value.minLeaseMonths ?? ""}
                  onChange={(e) => set("minLeaseMonths", num(e.target.value))}
                  placeholder="6"
                />
              </Field>
              <Field label="Ở tối đa (người)">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={value.maxOccupants ?? ""}
                  onChange={(e) => set("maxOccupants", num(e.target.value))}
                  placeholder="2"
                />
              </Field>
            </div>
          </div>
        </>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setExpanded((v) => !v)}
        className="w-full sm:w-auto"
      >
        {expanded ? <ChevronUp className="h-4 w-4 mr-1.5" /> : <ChevronDown className="h-4 w-4 mr-1.5" />}
        {expanded ? "Thu gọn" : isRent ? "Nội quy & tiện nghi" : "Tiện nghi"}
      </Button>

      {expanded && (
        <div className="space-y-5 rounded-lg border p-4">
          {isRent && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Nội quy</p>
              <p className="text-xs text-muted-foreground">
                Bỏ trống nghĩa là chưa khai, khác với &ldquo;không&rdquo;. Người thuê lọc theo
                các mục này rất nhiều, nên khai rõ giúp tin của bạn được tìm thấy.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TriState
                  label="Cho nuôi thú cưng"
                  value={value.petsAllowed}
                  onChange={(v) => set("petsAllowed", v)}
                />
                <TriState
                  label="Giờ giấc tự do"
                  value={value.curfewFree}
                  onChange={(v) => set("curfewFree", v)}
                />
                <TriState
                  label="Ở chung chủ"
                  value={value.sharedWithOwner}
                  onChange={(v) => set("sharedWithOwner", v)}
                />
                <TriState
                  label="Được nấu ăn"
                  value={value.cookingAllowed}
                  onChange={(v) => set("cookingAllowed", v)}
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium">Tiện nghi</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {AMENITY_LIST.map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 text-sm cursor-pointer select-none"
                >
                  <Checkbox
                    checked={amenities.includes(key)}
                    onCheckedChange={() => toggleAmenity(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Ba trạng thái: chưa khai / có / không.
 *
 * Dùng ba nút thay vì một checkbox có chủ đích: checkbox chỉ diễn đạt được hai trạng thái,
 * nên "chưa khai" sẽ bị lưu nhầm thành "không" — và bộ lọc sẽ loại oan những tin thực ra
 * có cho nuôi thú cưng, chủ tin chỉ là chưa điền.
 */
function TriState({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const opts: [string, boolean | null][] = [
    ["Chưa khai", null],
    ["Có", true],
    ["Không", false],
  ];

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="inline-flex rounded-md border overflow-hidden">
        {opts.map(([text, v]) => (
          <button
            key={text}
            type="button"
            onClick={() => onChange(v)}
            className={`px-3 py-1.5 text-sm transition-colors ${
              value === v
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted text-muted-foreground"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
