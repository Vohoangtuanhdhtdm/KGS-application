import { createFileRoute } from "@tanstack/react-router";
import { ContactsPage } from "@/components/management/ContactsPage";

// Trang nằm ở components/management để bản đồ /quan-ly/ban-do mở được nó dạng sheet. File route
// chỉ còn khai báo Route — export thêm thứ gì khác thì router không tách được trang ra chunk
// riêng, và cả trang (kèm thư viện biểu đồ) bị nạp ngay từ lần mở đầu tiên của MỌI trang.
export const Route = createFileRoute("/quan-ly/doi-tac/")({
  head: () => ({ meta: [{ title: "Sổ đối tác — KGS" }] }),
  component: ContactsPage,
});
