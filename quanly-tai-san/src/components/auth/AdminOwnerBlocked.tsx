import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Tài khoản quản trị mở trang của không gian Chủ nhà (gõ thẳng đường dẫn, link cũ, lịch sử
 * trình duyệt).
 *
 * Quản trị viên không đồng thời là Chủ nhà: họ duyệt tin của người khác, nên không đăng và
 * không quản lý tin của chính mình. Backend cũng chặn (chính sách Owner), màn hình này chỉ để
 * nói rõ VÌ SAO thay vì để các ô dữ liệu lỗi 403 lần lượt.
 */
export function AdminOwnerBlocked() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-ws-admin-soft text-ws-admin">
        <ShieldCheck className="h-6 w-6" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Đây là chức năng của Chủ nhà</h1>
        <p className="text-sm text-muted-foreground">
          Tài khoản quản trị chỉ dùng để quản trị hệ thống và quản lý tin đăng, không đăng hay quản
          lý tin riêng. Muốn đăng tin, hãy dùng một tài khoản thường.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/admin/overview">Về khu quản trị</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/admin/all-listings">Quản lý tin đăng</Link>
        </Button>
      </div>
    </div>
  );
}
