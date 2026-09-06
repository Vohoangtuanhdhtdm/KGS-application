/**
 * Cờ tính năng theo giai đoạn.
 *
 * Kho mã này chứa cả những màn hình thuộc giai đoạn sau — nhiều nhất là khu quản lý tài sản
 * (hợp đồng, thu chi, nhắc lịch, đối tác, bản đồ tài sản), vốn thuộc **Giai đoạn 4**. Chúng
 * đã chạy được, nên xoá đi là phí; nhưng để nguyên trong thanh điều hướng thì người dùng
 * thử sản phẩm ở Giai đoạn 1 gặp một menu trộn lẫn hai sản phẩm khác nhau và không hiểu
 * cái này rốt cuộc là gì.
 *
 * ẨN chứ không XOÁ: route vẫn tồn tại và vẫn vào được bằng URL trực tiếp — đủ để trình bày
 * trong đồ án — chỉ là không còn lối vào nào từ giao diện chính.
 */

/** Bật lại khu quản lý tài sản (Giai đoạn 4) bằng VITE_ENABLE_ASSET_MANAGEMENT=true. */
export const ENABLE_ASSET_MANAGEMENT =
  (import.meta.env.VITE_ENABLE_ASSET_MANAGEMENT as string | undefined) === "true";
