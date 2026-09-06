import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Nút quay lại thật.
 *
 * Trang chi tiết tin đăng trước đây dùng `<Link to="/tin-dang">` kèm mũi tên trái. Nó TRÔNG
 * như nút quay lại nhưng thực chất là một liên kết cố định: vào tin từ trang chủ rồi bấm
 * mũi tên, người dùng bị ném sang trang tìm kiếm — một trang họ chưa từng ở.
 *
 * Đó không chỉ là đi sai chỗ. Nó còn phá luôn nút Back của trình duyệt ở lần bấm sau, vì
 * /tin-dang vừa được đẩy thêm vào lịch sử; Back khi đó quay về chính trang chi tiết vừa rời.
 *
 * Nút này quay lại đúng nơi người dùng vừa đến, và khi không có lịch sử trong ứng dụng —
 * mở từ liên kết chia sẻ, mở tab mới — thì nó ĐỔI CẢ NHÃN thành nơi nó thực sự dẫn tới.
 * Nhãn phải nói thật về đích đến, nếu không thì lại là cái bẫy cũ với một hình dạng khác.
 */
export function BackButton({
  fallbackTo = "/tin-dang",
  fallbackLabel = "Xem tất cả tin đăng",
  label = "Quay lại",
}: {
  fallbackTo?: string;
  fallbackLabel?: string;
  label?: string;
}) {
  const router = useRouter();
  const canGoBack = useCanGoBack();

  if (!canGoBack) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link to={fallbackTo}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {fallbackLabel}
        </Link>
      </Button>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
      <ArrowLeft className="h-4 w-4 mr-1" />
      {label}
    </Button>
  );
}
