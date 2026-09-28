// vietnam-provinces build ra 2 định dạng: client dùng bản ESM, SSR của Vite dùng bản CJS bọc
// trong `default`. Import namespace rồi tự chuẩn hoá — cùng cách với DemandSearchSheet.
import * as vietnamProvincesNs from "vietnam-provinces";
import { normDistrict, normProvince } from "@/lib/areaKey";

const vp =
  (vietnamProvincesNs as { default?: typeof import("vietnam-provinces") }).default ??
  vietnamProvincesNs;

export interface AreaName {
  /** Tên đầy đủ trong danh mục hành chính — gửi thẳng lên API, máy chủ tự chuẩn hoá. */
  province: string;
  district: string;
}

let cache: Map<string, AreaName> | null = null;

/** Dựng bảng tra khoá "tỉnh|quận" → tên đầy đủ. Dựng một lần, lần đầu có người cần. */
function table(): Map<string, AreaName> {
  if (cache) return cache;
  cache = new Map();
  for (const p of vp.getProvinces()) {
    const pk = normProvince(p.name);
    for (const d of vp.getDistricts(p.code)) {
      cache.set(`${pk}|${normDistrict(d.name)}`, { province: p.name, district: d.name });
    }
  }
  return cache;
}

/**
 * Tên hiển thị cho một khu vực mà dịch vụ định giá trả về dưới dạng khoá rút gọn.
 * Không khớp được (khoá lạ) thì trả null — nơi gọi tự quyết hiện khoá trần hay bỏ qua.
 */
export function resolveAreaName(provinceKey: string, districtKey: string): AreaName | null {
  return table().get(`${provinceKey}|${districtKey}`) ?? null;
}

/** "Thành phố Hồ Chí Minh" → "TP. Hồ Chí Minh", "Tỉnh Khánh Hòa" → "Khánh Hòa": gọn cho bảng. */
export function shortProvince(name: string): string {
  return name.replace(/^Thành phố /, "TP. ").replace(/^Tỉnh /, "");
}
