import { useRef, useState } from "react";
import { TileLayer } from "react-leaflet";
import { WifiOff } from "lucide-react";
import { TILE_PROVIDERS } from "@/lib/mapTiles";

/**
 * Lớp ảnh nền bản đồ: tự chuyển nguồn khi nguồn hiện tại hỏng, và nói ra khi hết nguồn.
 *
 * Vì sao cần cả hai. Khi nguồn tile không tới được — bị phần mềm chặn quảng cáo chặn tên
 * miền, bị nhà mạng chặn, hoặc mất mạng — Leaflet vẫn dựng đủ khung, vẫn hiện marker, vẫn
 * hiện nút zoom. Chỉ ảnh nền là trống. Người dùng nhìn vào một vùng trắng có vài viên giá
 * lơ lửng và kết luận đúng một điều: sản phẩm này hỏng.
 *
 * Đó là kiểu hỏng tệ nhất — hỏng mà không nói. Ở đây: đếm tile lỗi, đủ nhiều thì đổi sang
 * nguồn kế tiếp; hết nguồn thì hiện thông báo nói rõ chuyện gì xảy ra và người dùng làm
 * được gì. Marker giữ nguyên bên dưới, vì vị trí tương đối của chúng vẫn có ích kể cả khi
 * không có nền.
 */

/** Dưới ngưỡng này có thể chỉ là vài tile lẻ hỏng — chuyện bình thường, chưa đáng đổi nguồn. */
const FAIL_THRESHOLD = 6;

export function BaseTileLayer() {
  const [providerIndex, setProviderIndex] = useState(0);
  const failCount = useRef(0);

  const exhausted = providerIndex >= TILE_PROVIDERS.length;
  const provider = TILE_PROVIDERS[Math.min(providerIndex, TILE_PROVIDERS.length - 1)];

  const handleError = () => {
    failCount.current += 1;
    if (failCount.current < FAIL_THRESHOLD) return;

    failCount.current = 0;
    // Vượt qua độ dài mảng một bậc = đã thử hết. Trạng thái đó khác với "đang dùng nguồn
    // cuối" và cần phân biệt, vì chỉ khi hết hẳn mới nên làm phiền người dùng.
    setProviderIndex((i) => i + 1);
  };

  return (
    <>
      {!exhausted && (
        <TileLayer
          // key ép Leaflet dựng lại lớp tile khi đổi nguồn; thiếu nó thì URL đổi nhưng các
          // tile đã hỏng vẫn nằm nguyên trong bộ nhớ đệm của lớp cũ.
          key={provider.name}
          url={provider.url}
          attribution={provider.attribution}
          subdomains={provider.subdomains ?? []}
          maxZoom={provider.maxZoom}
          eventHandlers={{
            tileerror: handleError,
            tileload: () => {
              failCount.current = 0;
            },
          }}
        />
      )}

      {exhausted && (
        <div
          className="map-overlay pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3"
          role="status"
        >
          <div className="pointer-events-auto max-w-md rounded-md border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium">
              <WifiOff className="h-4 w-4 text-warning-foreground" />
              Không tải được ảnh nền bản đồ
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Vị trí các tin đăng vẫn hiển thị đúng. Ảnh nền thường bị chặn bởi phần mềm chặn
              quảng cáo hoặc DNS của nhà mạng — thử tắt chúng cho trang này, hoặc dùng danh
              sách bên cạnh.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
