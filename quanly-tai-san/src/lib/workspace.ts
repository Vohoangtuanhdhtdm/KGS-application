import { Building2, Search, ShieldCheck, type LucideIcon } from "lucide-react";

/**
 * Ba không gian làm việc, ứng với ba actor của hệ thống.
 *
 * Backend chỉ có hai vai trò (Admin, User). "Chủ nhà" không phải vai trò mà là một KHÔNG
 * GIAN: mọi User đều có thể vào — giống Airbnb chuyển qua lại giữa Guest và Host. Một người
 * vừa đi tìm phòng vừa cho thuê căn cũ là chuyện bình thường, và bắt họ giữ hai tài khoản để
 * làm hai việc đó là đẩy họ sang nền tảng khác.
 *
 * Trước bản này, cả ba actor dùng chung một khung giao diện: quản trị viên mở trang duyệt tin
 * vẫn thấy thanh điều hướng "Tìm nhà · Đăng tin · Đã lưu" như mọi người, còn người tìm nhà
 * và người đăng tin chia chung một menu trộn lẫn việc của cả hai. Không có gì trên màn hình
 * nói "bạn đang ở vai trò nào".
 *
 * Mỗi không gian ở đây có ba thứ riêng: màu định danh (token `--ws-*` trong styles.css, được
 * gán vào `--primary` khi vào không gian đó), khung điều hướng riêng, và một nhãn luôn hiện.
 */
export type Workspace = "seeker" | "owner" | "admin";

export interface WorkspaceMeta {
  id: Workspace;
  /** Tên ngắn, hiện trên nhãn và công tắc chuyển. */
  label: string;
  /** Một dòng nói không gian này để làm gì — hiện trên thẻ chọn. */
  tagline: string;
  icon: LucideIcon;
  /** Trang mở ra khi chuyển sang không gian này. */
  home: string;
  /** Tên biến CSS mang màu định danh. */
  colorVar: string;
}

export const WORKSPACES: Record<Workspace, WorkspaceMeta> = {
  seeker: {
    id: "seeker",
    label: "Tìm nhà",
    tagline: "Tìm, lưu, so sánh tin và tra cứu giá thị trường",
    icon: Search,
    home: "/tin-dang",
    colorVar: "--ws-seeker",
  },
  owner: {
    id: "owner",
    label: "Chủ nhà",
    tagline: "Đăng tin, trả lời người hỏi thuê/mua và theo dõi hiệu quả tin",
    icon: Building2,
    home: "/tin-cua-toi",
    colorVar: "--ws-owner",
  },
  admin: {
    id: "admin",
    label: "Quản trị",
    tagline: "Duyệt tin, xử lý vi phạm, quản lý người dùng",
    icon: ShieldCheck,
    home: "/admin/overview",
    colorVar: "--ws-admin",
  },
};

/** Tiền tố đường dẫn thuộc không gian Chủ nhà. */
const OWNER_PREFIXES = [
  "/dang-tin",
  "/tin-cua-toi",
  "/thong-ke-tin",
  "/toa-nha",
  "/quan-ly",
  "/yeu-cau",
];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/**
 * Không gian của một trang, suy ra từ đường dẫn.
 *
 * `/yeu-cau` là trường hợp duy nhất phụ thuộc thêm tham số: cùng một trang có hai tab —
 * "Nhận được" là hộp thư của chủ nhà, "Đã gửi" là lịch sử của người tìm nhà. Người tìm nhà
 * bấm "Yêu cầu đã gửi" từ không gian của mình thì không được bị đẩy sang khung Chủ nhà.
 */
export function resolveWorkspace(pathname: string, tab?: string): Workspace {
  if (matches(pathname, "/admin")) return "admin";
  if (matches(pathname, "/yeu-cau"))
    return tab === "sent" || tab === "invites" ? "seeker" : "owner";
  if (OWNER_PREFIXES.some((p) => matches(pathname, p))) return "owner";
  return "seeker";
}
