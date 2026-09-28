/**
 * Chuẩn hoá tên địa danh — BẢN SAO có chủ ý của ml-service/app/normalize.py.
 *
 * Dịch vụ định giá trả khoá quận ở dạng rút gọn ("ho chi minh", "7", "cau giay"), mất dấu
 * và mất tiền tố. Không thể dựng lại "Quận Cầu Giấy" từ "cau giay"; nhưng làm được chiều
 * ngược lại — chuẩn hoá mọi tên trong danh mục hành chính rồi so khớp. Vì thế quy tắc ở đây
 * PHẢI giống hệt bên Python; lệch một tiền tố là quận đó hiện bằng khoá trần thay vì tên đẹp.
 *
 * Bản sao chỉ dùng để HIỂN THỊ. Mọi yêu cầu gửi lên API vẫn mang tên đầy đủ, và máy chủ tự
 * chuẩn hoá bằng bản gốc — nên nếu hai bản có lệch nhau, cái hỏng chỉ là một nhãn, không
 * phải một con số.
 */

const PREFIXES = [
  "thanh pho",
  "quan",
  "huyen",
  "thi xa",
  "thi tran",
  "phuong",
  "xa",
  "tp",
  "tx",
  "tt",
  "q",
  "h",
  "p",
];

const PROVINCE_ALIASES: Record<string, string> = {
  hcm: "ho chi minh",
  tphcm: "ho chi minh",
  "sai gon": "ho chi minh",
  hn: "ha noi",
  dn: "da nang",
  brvt: "ba ria vung tau",
};

export function stripAccents(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function normKey(value: string | null | undefined): string {
  if (!value) return "";
  let text = stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of PREFIXES) {
      if (text === prefix) return "";
      if (text.startsWith(prefix + " ")) {
        text = text.slice(prefix.length + 1).trim();
        changed = true;
        break;
      }
    }
  }
  return text;
}

/** Khoá tỉnh — cắt thêm tiền tố "tỉnh" ở riêng cấp này (xem normalize.py). */
export function normProvince(value: string | null | undefined): string {
  let key = normKey(value);
  if (key.startsWith("tinh ")) key = key.slice(5).trim();
  return PROVINCE_ALIASES[key] ?? key;
}

export const normDistrict = normKey;
