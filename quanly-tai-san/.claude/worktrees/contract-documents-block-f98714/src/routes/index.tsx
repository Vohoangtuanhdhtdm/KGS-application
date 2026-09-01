import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Trang "Tổng quan" đã được gộp vào dashboard Bản đồ tài sản: tổng giá trị, cơ cấu danh
 * mục, số hợp đồng đang hiệu lực và danh sách hợp đồng sắp hết hạn (kèm gia hạn nhanh)
 * nay nằm ở 3 lớp thông tin nổi trên bản đồ.
 *
 * Vẫn GIỮ route "/" thay vì xoá hẳn file: rất nhiều nơi trỏ về "/" (trang 404, trang lỗi,
 * bookmark của người dùng, link ngoài). Xoá đi sẽ biến tất cả thành 404.
 */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/ban-do", replace: true });
  },
});
