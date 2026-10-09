import { createFileRoute } from "@tanstack/react-router";
import { RemindersPage } from "@/components/management/RemindersPage";

// Trang nằm ở components/management để bản đồ /quan-ly/ban-do mở được nó dạng sheet. File route
// chỉ còn khai báo Route — export thêm thứ gì khác thì router không tách được trang ra chunk
// riêng, và cả trang (kèm thư viện biểu đồ) bị nạp ngay từ lần mở đầu tiên của MỌI trang.
export const Route = createFileRoute("/quan-ly/nhac-lich/")({
  head: () => ({ meta: [{ title: "Nhắc lịch — KGS" }] }),
  component: RemindersPage,
});
