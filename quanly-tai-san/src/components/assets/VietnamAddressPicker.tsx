import { useMemo } from "react";
import { getProvinces, getDistricts, getWards } from "vietnam-provinces";
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
    </div>
  );
}
