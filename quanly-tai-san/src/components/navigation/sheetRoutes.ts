import { lazy, type ComponentType } from "react";

// Nạp lười: chỉ khi người dùng mở sheet nào thì mới tải trang đó (thu chi kéo theo cả thư viện
// biểu đồ). Nơi hiển thị (FeatureSheet) bọc Suspense.
const ContractListPage = lazy(() =>
  import("@/components/management/ContractListPage").then((m) => ({ default: m.ContractListPage })),
);
const CashflowPage = lazy(() =>
  import("@/components/management/CashflowPage").then((m) => ({ default: m.CashflowPage })),
);
const RemindersPage = lazy(() =>
  import("@/components/management/RemindersPage").then((m) => ({ default: m.RemindersPage })),
);
const ContactsPage = lazy(() =>
  import("@/components/management/ContactsPage").then((m) => ({ default: m.ContactsPage })),
);

/**
 * Các tính năng QUẢN LÝ TÀI SẢN mở dạng sheet đè lên bản đồ.
 *
 * Sau khi định vị lại (Giai đoạn 1), toàn bộ khu quản lý chuyển xuống /quan-ly/*, và cơ
 * chế sheet chỉ còn dùng trong nội bộ khu đó — cụ thể là khi đang đứng trên bản đồ
 * /quan-ly/ban-do, nơi mở sheet giữ được vị trí và mức phóng của bản đồ.
 *
 * `path` là route THẬT của tính năng, vẫn dùng được khi gõ thẳng URL.
 * `key` là giá trị của search param `?sheet=`.
 */
export interface SheetRoute {
  key: string;
  title: string;
  path: string;
  Component: ComponentType<{ embedded?: boolean }>;
}

export const SHEET_ROUTES: SheetRoute[] = [
  { key: "hop-dong", title: "Hợp đồng", path: "/quan-ly/hop-dong", Component: ContractListPage },
  { key: "thu-chi", title: "Sổ thu chi", path: "/quan-ly/thu-chi", Component: CashflowPage },
  { key: "nhac-lich", title: "Nhắc lịch", path: "/quan-ly/nhac-lich", Component: RemindersPage },
  { key: "doi-tac", title: "Sổ đối tác", path: "/quan-ly/doi-tac", Component: ContactsPage },
];

export const SHEET_KEYS = SHEET_ROUTES.map((r) => r.key);

export function findSheet(key: string | undefined): SheetRoute | undefined {
  return key ? SHEET_ROUTES.find((r) => r.key === key) : undefined;
}
