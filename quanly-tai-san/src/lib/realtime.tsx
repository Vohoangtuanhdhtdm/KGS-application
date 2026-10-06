import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HubConnectionBuilder, LogLevel, type HubConnection } from "@microsoft/signalr";
import { useAuth } from "@/lib/auth/AuthContext";
import { API_BASE_URL, getAccessTokenForRealtime } from "@/lib/auth/api";

/** Gốc máy chủ (bỏ hậu tố /api) — hub nằm ở /hubs/notifications, ngoài nhánh /api. */
const HUB_URL = API_BASE_URL.replace(/\/api\/?$/, "") + "/hubs/notifications";

/**
 * Đồng bộ dữ liệu theo sự kiện từ máy chủ.
 *
 * Trước đây trạng thái tin ở "Tin của tôi" không đổi sau khi admin duyệt, cho tới khi chủ tin
 * đăng nhập lại: dữ liệu chỉ được tải lại khi tab bị ẩn rồi hiện lại, mà hai cửa sổ đặt cạnh
 * nhau thì không bao giờ "ẩn". Nay mỗi thông báo trong ứng dụng (duyệt, trả tin, gỡ tin, có
 * người hỏi thuê, được mời xem nhà…) được máy chủ đẩy qua SignalR, và mọi truy vấn ĐANG HIỂN
 * THỊ được làm mới — không cần biết thông báo đó chạm tới những màn hình nào.
 *
 * Chỉ nghe, không gửi gì lên. Mất kết nối thì tự nối lại; nối lại xong cũng làm mới một lượt
 * vì trong lúc mất kết nối có thể đã lỡ sự kiện.
 */
export function RealtimeSync() {
  const qc = useQueryClient();
  const { isAuthenticated, user } = useAuth();
  const userId = user?.userId;

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    const refreshActive = () => qc.invalidateQueries({ refetchType: "active" });

    const conn: HubConnection = new HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: async () => (await getAccessTokenForRealtime()) ?? "",
        // Token đi qua query (access_token), không cần cookie — khỏi đòi CORS credentials.
        withCredentials: false,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    conn.on("notification", refreshActive);
    // Quản trị viên: chủ tin vừa gửi duyệt, có người báo vi phạm, admin khác vừa xử lý tin…
    // (xem SignalAdmins ở backend) — hàng đợi và các số đếm tự làm mới.
    conn.on("admin-queue", refreshActive);
    conn.onreconnected(refreshActive);

    let stopped = false;
    const start = async (attempt = 0) => {
      try {
        await conn.start();
      } catch {
        // Máy chủ chưa sẵn sàng / mạng chập chờn: thử lại thưa dần, tối đa mỗi 30 giây.
        if (!stopped) setTimeout(() => start(attempt + 1), Math.min(30000, 2000 * 2 ** attempt));
      }
    };
    start();

    return () => {
      stopped = true;
      conn.off("notification");
      conn.off("admin-queue");
      void conn.stop();
    };
  }, [isAuthenticated, userId, qc]);

  return null;
}
