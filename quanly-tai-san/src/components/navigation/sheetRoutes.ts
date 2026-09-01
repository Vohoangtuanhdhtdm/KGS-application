import type { ComponentType } from "react";
import { ContractListPage } from "@/routes/hop-dong.index";
import { CashflowPage } from "@/routes/thu-chi.index";
import { RemindersPage } from "@/routes/nhac-lich.index";
import { ContactsPage } from "@/routes/doi-tac.index";
import { MyListingsPage } from "@/routes/my-listings";
import { InquiriesPage } from "@/routes/yeu-cau.index";
import { SavedListingsPage } from "@/routes/da-luu.index";

/**
 * Các tính năng phụ mở dạng sheet đè lên bản đồ.
 *
 * `path` là route THẬT của tính năng — vẫn dùng được khi gõ thẳng URL (render trang đầy
 * đủ). `key` là giá trị của search param `?sheet=` trên /ban-do khi mở dạng sheet.
 */
export interface SheetRoute {
  key: string;
  title: string;
  path: string;
  Component: ComponentType<{ embedded?: boolean }>;
}

export const SHEET_ROUTES: SheetRoute[] = [
  { key: "hop-dong", title: "Hợp đồng", path: "/hop-dong", Component: ContractListPage },
  { key: "thu-chi", title: "Sổ thu chi", path: "/thu-chi", Component: CashflowPage },
  { key: "nhac-lich", title: "Nhắc lịch", path: "/nhac-lich", Component: RemindersPage },
  { key: "doi-tac", title: "Sổ đối tác", path: "/doi-tac", Component: ContactsPage },
  {
    key: "my-listings",
    title: "Tin đăng của tôi",
    path: "/my-listings",
    Component: MyListingsPage,
  },
  { key: "yeu-cau", title: "Yêu cầu xem nhà", path: "/yeu-cau", Component: InquiriesPage },
  { key: "da-luu", title: "Tin đã lưu", path: "/da-luu", Component: SavedListingsPage },
];

export const SHEET_KEYS = SHEET_ROUTES.map((r) => r.key);

export function findSheet(key: string | undefined): SheetRoute | undefined {
  return key ? SHEET_ROUTES.find((r) => r.key === key) : undefined;
}
