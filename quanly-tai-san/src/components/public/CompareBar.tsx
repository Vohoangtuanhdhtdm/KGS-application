import { Link } from "@tanstack/react-router";
import { X, Scale, ImageIcon } from "lucide-react";
import { useCompareList } from "@/hooks/useCompareList";
import { Button } from "@/components/ui/button";

/**
 * Thanh nổi đáy hiện khi có ít nhất một tin đang chờ so sánh.
 *
 * Đặt ở __root.tsx cho mọi trang công khai (trang chủ, tìm kiếm, chi tiết tin) — chọn
 * tin ở trang này rồi lướt sang trang khác vẫn phải thấy thanh này, vì đó chính xác là
 * luồng thật: xem tin A, thấy hay, lướt tiếp sang tin B để so.
 *
 * Tự ẩn khi rỗng, không chiếm chỗ hay che nội dung lúc người dùng chưa chọn gì.
 */
// BottomTabBar (điều hướng chính khi đã đăng nhập) nổi ở bottom-5, chỉ trên mobile
// (md:hidden). Đặt thanh này cao hơn hẳn để không chồng lên đó; desktop không có
// BottomTabBar nên hạ xuống sát đáy như bình thường.
//
// z-50, KHÔNG phải z-40: trang tìm kiếm trên mobile hiện danh sách trong một Drawer
// (MobileListSheet) cũng z-40, và Drawer đó được portal ra SAU trong DOM nên ở z-index
// bằng nhau nó vẽ đè lên — thanh này từng render đúng vị trí trong DOM nhưng nằm HẲN dưới
// tấm sheet, không ai bấm được. Vượt hẳn qua z-40 là cách chắc chắn nhất để không phải
// đoán thứ tự portal của từng trang dùng chung component này.
export function CompareBar({
  bottomOffsetClassName = "bottom-20 md:bottom-4",
}: {
  bottomOffsetClassName?: string;
}) {
  const { items, remove, clear, max } = useCompareList();

  if (items.length === 0) return null;

  return (
    <div
      className={`fixed inset-x-0 ${bottomOffsetClassName} z-50 mx-auto flex w-[calc(100%-1.5rem)] max-w-xl items-center gap-3 rounded-lg border bg-card/95 p-2.5 shadow-[--shadow-e3] backdrop-blur`}
    >
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {items.map((it) => (
          <div key={it.id} className="relative shrink-0">
            <div className="h-11 w-11 overflow-hidden rounded-md bg-muted">
              {it.thumbnailUrl ? (
                <img src={it.thumbnailUrl} alt={it.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label={`Bỏ "${it.title}" khỏi so sánh`}
              onClick={() => remove(it.id)}
              className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-foreground text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {items.length}/{max} tin
        </span>
        <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
          Xoá hết
        </Button>
        {items.length < 2 ? (
          // Link luôn "bấm được" nên chưa đủ 2 tin thì không render Link — render nút
          // khoá thật, tránh một đường dẫn tưởng chạy nhưng phía kia không có gì để so.
          <Button size="sm" disabled title="Chọn thêm ít nhất 1 tin nữa để so sánh">
            <Scale className="h-3.5 w-3.5" />
            So sánh
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link to="/so-sanh">
              <Scale className="h-3.5 w-3.5" />
              So sánh
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
