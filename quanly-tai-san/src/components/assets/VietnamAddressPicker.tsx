import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { getProvinces, getDistricts, getWards } from "vietnam-provinces";
import { adminUnitsApi } from "@/lib/api/adminUnits";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * 3 dropdown liên động Tỉnh/Quận/Phường dùng dữ liệu JSON tĩnh (vietnam-provinces).
 * Lưu giá trị dạng TÊN (không phải code) để khớp shape address hiện có của backend.
 *
 * Đây là địa chỉ THEO ĐƠN VỊ CŨ (trước 01/07/2025) — mô hình định giá và chỉ số giá học trên
 * đơn vị cũ. Chọn xong phường thì hiện luôn địa chỉ mới tương ứng (máy chủ tự suy ra và lưu
 * song song), để chủ nhà thấy tin của mình sẽ hiện ra sao.
 */
export function VietnamAddressPicker({
  city,
  district,
  ward,
  onChange,
  required = true,
}: {
  city: string;
  district: string;
  ward: string;
  onChange: (v: { city: string; district: string; ward: string }) => void;
  required?: boolean;
}) {
  const provinces = useMemo(() => getProvinces(), []);
  // Tìm code từ name (form lưu theo name để giữ tương thích ngược)
  const provinceCode = useMemo(
    () => provinces.find((p) => p.name === city)?.code ?? "",
    [provinces, city],
  );
  const districts = useMemo(() => (provinceCode ? getDistricts(provinceCode) : []), [provinceCode]);
  const districtCode = useMemo(
    () => districts.find((d) => d.name === district)?.code ?? "",
    [districts, district],
  );
  const wards = useMemo(() => (districtCode ? getWards(districtCode) : []), [districtCode]);

  const star = required ? " *" : "";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="space-y-2">
        <Label>Tỉnh/Thành{star}</Label>
        <Select
          value={provinceCode}
          onValueChange={(code) => {
            const p = provinces.find((x) => x.code === code);
            // Đổi tỉnh → reset quận + phường
            onChange({ city: p?.name ?? "", district: "", ward: "" });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Chọn tỉnh/thành" />
          </SelectTrigger>
          <SelectContent>
            {provinces.map((p) => (
              <SelectItem key={p.code} value={p.code}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Quận/Huyện{star}</Label>
        <Select
          value={districtCode}
          disabled={!provinceCode}
          onValueChange={(code) => {
            const d = districts.find((x) => x.code === code);
            onChange({ city, district: d?.name ?? "", ward: "" });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={provinceCode ? "Chọn quận/huyện" : "Chọn tỉnh trước"} />
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

      <div className="space-y-2">
        <Label>Phường/Xã{star}</Label>
        <Select
          value={wards.find((w) => w.name === ward)?.code ?? ""}
          disabled={!districtCode}
          onValueChange={(code) => {
            const w = wards.find((x) => x.code === code);
            onChange({ city, district, ward: w?.name ?? "" });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={districtCode ? "Chọn phường/xã" : "Chọn quận trước"} />
          </SelectTrigger>
          <SelectContent>
            {wards.map((w) => (
              <SelectItem key={w.code} value={w.code}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <NewAddressPreview city={city} district={district} ward={ward} />
    </div>
  );
}

/** "Địa chỉ mới: Phường An Hội Tây, Thành phố Hồ Chí Minh" — theo sắp xếp đơn vị hành chính 2025. */
function NewAddressPreview({
  city,
  district,
  ward,
}: {
  city: string;
  district: string;
  ward: string;
}) {
  const ready = !!(city && district && ward);
  const q = useQuery({
    queryKey: ["admin-units-resolve", city, district, ward],
    queryFn: () => adminUnitsApi.resolve(city, district, ward),
    enabled: ready,
    staleTime: Infinity,
    retry: 1,
  });
  if (!ready) {
    return (
      <p className="text-xs text-muted-foreground md:col-span-3">
        Chọn theo địa chỉ cũ (trước 07/2025) — hệ thống tự đổi sang địa chỉ mới sau sáp nhập.
      </p>
    );
  }
  const a = q.data?.address;
  return (
    <p className="flex flex-wrap items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs md:col-span-3">
      <span className="text-muted-foreground">Địa chỉ mới (từ 01/07/2025)</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
      {q.isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : a ? (
        <>
          <span className="font-medium">
            {a.ward}, {a.province}
          </span>
          {q.data!.candidates.length > 1 && (
            <span className="text-muted-foreground">
              (phường cũ được chia cho {q.data!.candidates.map((c) => c.name).join(", ")} — ghim vị
              trí trên bản đồ để hệ thống xác định đúng phường)
            </span>
          )}
        </>
      ) : (
        <span className="text-muted-foreground">chưa tra được trong bảng chuyển đổi</span>
      )}
    </p>
  );
}
