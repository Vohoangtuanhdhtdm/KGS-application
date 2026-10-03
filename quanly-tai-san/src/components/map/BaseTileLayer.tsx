import { useEffect, useRef, useState } from "react";
import { TileLayer } from "react-leaflet";
import { WifiOff } from "lucide-react";
import { getTileProviders, type TileVariant } from "@/lib/mapTiles";

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

/** Nguồn chưa tải được tile nào thì chỉ cần bấy nhiêu lỗi là đủ kết luận nó không dùng được. */
const DEAD_ON_ARRIVAL = 3;

/**
 * Chờ tối đa bấy nhiêu mili-giây cho tile ĐẦU TIÊN của một nguồn.
 *
 * Đếm lỗi chỉ bắt được kiểu hỏng có tiếng: máy chủ trả 404, tên miền không phân giải
 * được, kết nối bị từ chối — mọi trường hợp đó Leaflet đều phát `tileerror`. Nhưng kiểu
 * hỏng hay gặp nhất khi bị chặn ở tầng DNS hoặc tường lửa lại là kiểu KHÔNG có tiếng:
 * yêu cầu treo, không lỗi, không xong. Khi ấy `tileerror` không bao giờ nổ, bộ đếm đứng
 * yên ở 0, và người dùng ngồi nhìn một khung trắng vĩnh viễn — đúng cái tình trạng mà cả
 * tệp này sinh ra để tránh.
 */
const FIRST_TILE_TIMEOUT_MS = 8_000;

export function BaseTileLayer({ variant = "streets" }: { variant?: TileVariant } = {}) {
  const TILE_PROVIDERS = getTileProviders(variant);
  const [providerIndex, setProviderIndex] = useState(0);
  const failCount = useRef(0);
  const loadedOnce = useRef(false);
  /**
   * Nguồn đang dùng — ghi ĐỒNG BỘ ngay lúc quyết định đổi, không chờ React vẽ lại.
   *
   * Một nguồn hỏng thường hỏng cả loạt: 16–20 tile báo lỗi gần như cùng lúc, trước khi React
   * kịp tháo lớp tile cũ. Bản trước chỉ có state, nên các lỗi đến sau vẫn được tính — lần đổi
   * thứ hai, thứ ba chồng lên nhau, bộ đếm nhảy qua cả Esri (nguồn vẫn dùng được) và rơi thẳng
   * vào "hết nguồn". Đã gặp thật trên máy phát triển: OSM bị chặn, Esri tải bình thường, vậy
   * mà bản đồ vẫn báo "Không tải được ảnh nền". Giờ lỗi của một nguồn đã bị thay thế bị bỏ qua.
   */
  const active = useRef(0);

  const exhausted = providerIndex >= TILE_PROVIDERS.length;
  const provider = TILE_PROVIDERS[Math.min(providerIndex, TILE_PROVIDERS.length - 1)];

  /** Bỏ nguồn `from`, chuyển sang nguồn kế tiếp — chỉ khi `from` vẫn là nguồn đang dùng. */
  const advance = (from: number) => {
    if (active.current !== from) return;
    active.current = from + 1;
    failCount.current = 0;
    // Vượt qua độ dài mảng một bậc = đã thử hết. Trạng thái đó khác với "đang dùng nguồn
    // cuối" và cần phân biệt, vì chỉ khi hết hẳn mới nên làm phiền người dùng.
    setProviderIndex(from + 1);
  };

  // Mỗi lần đổi nguồn là một lần chờ mới.
  useEffect(() => {
    if (exhausted) return;
    loadedOnce.current = false;
    const from = providerIndex;
    const timer = window.setTimeout(() => {
      if (!loadedOnce.current) advance(from);
    }, FIRST_TILE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [providerIndex, exhausted]);

  const handleError = (from: number) => {
    if (active.current !== from) return; // lỗi muộn của một nguồn đã bị thay
    failCount.current += 1;
    // Nguồn CHƯA TỪNG tải được tile nào mà đã hỏng vài tile thì gần như chắc chắn là chết cả
    // nguồn (token bị từ chối, hết hạn mức, tên miền bị chặn), không phải vài tile lẻ. Ngưỡng
    // 6 không áp được ở đây: với tile 512px của Mapbox, cả khung nhìn chỉ có khoảng 4 tile, nên
    // Mapbox hỏng sẽ KHÔNG BAO GIỜ chạm ngưỡng 6 — người dùng phải nhìn khung trắng chờ bộ hẹn
    // giờ 8 giây mới được lùi sang nguồn miễn phí.
    const deadOnArrival = !loadedOnce.current && failCount.current >= DEAD_ON_ARRIVAL;
    if (failCount.current < FAIL_THRESHOLD && !deadOnArrival) return;
    advance(from);
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
          tileSize={provider.tileSize ?? 256}
          zoomOffset={provider.zoomOffset ?? 0}
          // Hai thiết lập giữ số lượt tải tile ở mức cần thiết — với Mapbox, mỗi tile là một
          // lượt tính vào hạn mức miễn phí. Mặc định Leaflet tải tile cho MỌI mức zoom trung
          // gian trong lúc hoạt ảnh phóng to chạy, và tải liên tục trong lúc người dùng còn
          // đang kéo bản đồ; cả hai đều là tile người dùng không kịp nhìn thấy.
          updateWhenZooming={false}
          updateWhenIdle
          eventHandlers={{
            tileerror: () => handleError(providerIndex),
            tileload: () => {
              if (active.current !== providerIndex) return;
              loadedOnce.current = true;
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
              <WifiOff className="h-4 w-4 text-warning" />
              Không tải được ảnh nền bản đồ
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Vị trí các tin đăng vẫn hiển thị đúng. Ảnh nền thường bị chặn bởi phần mềm chặn quảng
              cáo hoặc DNS của nhà mạng — thử tắt chúng cho trang này, hoặc dùng danh sách bên cạnh.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
