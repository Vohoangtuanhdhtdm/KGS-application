import { createFileRoute } from "@tanstack/react-router";
import { ContractListPage } from "@/components/management/ContractListPage";

// Trang nằm ở components/management để bản đồ /quan-ly/ban-do mở được nó dạng sheet. File route
// chỉ còn khai báo Route — export thêm thứ gì khác thì router không tách được trang ra chunk
// riêng, và cả trang (kèm thư viện biểu đồ) bị nạp ngay từ lần mở đầu tiên của MỌI trang.
export const Route = createFileRoute("/quan-ly/hop-dong/")({
  head: () => ({ meta: [{ title: "Quản lý hợp đồng — KGS" }] }),
  component: ContractListPage,
});
