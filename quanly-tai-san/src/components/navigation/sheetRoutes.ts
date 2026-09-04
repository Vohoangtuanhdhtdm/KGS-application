import type { ComponentType } from "react";
import { ContractListPage } from "@/routes/quan-ly.hop-dong.index";
import { CashflowPage } from "@/routes/quan-ly.thu-chi.index";
import { RemindersPage } from "@/routes/quan-ly.nhac-lich.index";
import { ContactsPage } from "@/routes/quan-ly.doi-tac.index";

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
