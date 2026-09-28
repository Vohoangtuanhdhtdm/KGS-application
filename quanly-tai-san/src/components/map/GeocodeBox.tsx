// Ô tìm địa chỉ nổi trên bản đồ GL. Dùng Geocoding v6 "tạm thời" (100k lượt/tháng miễn phí):
// kết quả CHỈ dùng để đưa camera tới, không đặt ghim, không lưu — đúng điều khoản của loại
// geocoding này. Không dùng Search Box API vì hạn mức miễn phí chỉ 500 phiên/tháng.
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { MAPBOX_TOKEN, distanceMeters } from "@/lib/mapEngine";

interface Suggestion {
  id: string;
  name: string;
  place: string;
  lat: number;
  lng: number;
}

interface Props {
  /** Ưu tiên kết quả gần điểm này (tâm bản đồ hiện tại). */
  proximity: [number, number];
  onSelect: (lat: number, lng: number) => void;
  /** false: nằm trong luồng bố cục (ví dụ trong một thẻ điều khiển) thay vì nổi trên bản đồ. */
  floating?: boolean;
  placeholder?: string;
}

const MIN_CHARS = 3;
const DEBOUNCE_MS = 400;
const LIMIT = 8;
/** Kết quả trong bán kính này quanh tâm bản đồ được đưa lên đầu. */
const NEAR_METERS = 50_000;

export function GeocodeBox({
  proximity,
  onSelect,
  floating = true,
  placeholder = "Tìm địa chỉ để di chuyển bản đồ…",
}: Props) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  // Đã tìm xong mà không ra gì — phải NÓI ra, không thì người dùng tưởng ô tìm bị hỏng.
  const [noResult, setNoResult] = useState(false);
  const [active, setActive] = useState(-1);
  const prox = useRef(proximity);
  prox.current = proximity;
  // Chọn gợi ý thì ô được điền lại bằng tên đó — không được coi là người dùng gõ mới (sẽ
  // tìm lại, tốn thêm một lượt và bật lại danh sách vừa đóng).
  const skipNext = useRef(false);

  useEffect(() => {
    const text = q.trim();
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (text.length < MIN_CHARS) {
      setItems([]);
      setNoResult(false);
      return;
    }
    // Chờ người dùng ngừng gõ rồi mới gọi — mỗi lần gõ một chữ không nên tốn một lượt.
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      type Feature = {
        id: string;
        geometry: { coordinates: [number, number] };
        properties: { name?: string; place_formatted?: string };
      };
      const search = async (q: string): Promise<Feature[] | null> => {
        const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
        url.searchParams.set("q", q);
        url.searchParams.set("country", "vn");
        url.searchParams.set("language", "vi");
        url.searchParams.set("limit", String(LIMIT));
        url.searchParams.set("proximity", `${prox.current[1]},${prox.current[0]}`);
        url.searchParams.set("access_token", MAPBOX_TOKEN);
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) return null;
        return ((await res.json()) as { features?: Feature[] }).features ?? [];
      };
      try {
        // Dữ liệu Mapbox đã theo địa giới MỚI (sau sáp nhập 2025): "Quận 1" không còn, nên
        // gõ "Hàm Nghi, Quận 1" ra rỗng trong khi "Hàm Nghi" ra ngay. Người dùng vẫn quen gõ
        // kèm quận — bỏ phần quận/huyện đi; vẫn rỗng thì thử lại với phần trước dấu phẩy
        // (chỉ tốn thêm một lượt khi lượt đầu không ra gì).
        const cleaned =
          text
            .replace(/(^|[\s,])(quận|huyện|q\.)\s*[^,]*/giu, " ")
            .replace(/\s*,\s*(,\s*)+/g, ", ")
            .replace(/^[\s,]+|[\s,]+$/g, "")
            .trim() || text;
        let features = await search(cleaned);
        if (features && features.length === 0 && cleaned.includes(",")) {
          features = await search(cleaned.split(",")[0].trim());
        }
        if (!features) return setItems([]);
        const data = { features };
        const here = { lat: prox.current[0], lng: prox.current[1] };
        const all = (data.features ?? []).map((f) => ({
          id: f.id,
          name: f.properties.name ?? "",
          place: f.properties.place_formatted ?? "",
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
        }));
        // `proximity` của Geocoding v6 chỉ ưu tiên rất nhẹ: gõ "Chợ Bến Thành" khi đang xem
        // TP.HCM vẫn ra phố "Bến Bình" ở Hải Phòng đứng đầu. Đưa kết quả gần tâm bản đồ lên
        // trước, giữ nguyên thứ tự liên quan của Mapbox trong mỗi nhóm.
        const near = all.filter((s) => distanceMeters(here, s) <= NEAR_METERS);
        const far = all.filter((s) => distanceMeters(here, s) > NEAR_METERS);
        setItems([...near, ...far]);
        setNoResult(all.length === 0);
        setActive(-1);
        setOpen(true);
      } catch {
        // Huỷ do gõ tiếp, hoặc mất mạng — ô tìm chỉ là tiện ích phụ, im lặng là đủ.
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const choose = (s: Suggestion) => {
    onSelect(s.lat, s.lng);
    setOpen(false);
    skipNext.current = true;
    setQ(s.name);
  };

  return (
    <div
      className={
        floating ? "map-overlay absolute left-2 top-2 w-[min(320px,calc(100%-64px))]" : "relative"
      }
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!open || items.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % items.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
            } else if (e.key === "Enter") {
              // Enter trong ô tìm không được gửi form đăng tin bao quanh.
              e.preventDefault();
              choose(items[Math.max(active, 0)]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls="kgs-geocode-list"
          className="h-9 w-full rounded-md border bg-background pl-8 pr-2 text-sm shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {open && noResult && (
        <p
          role="status"
          className={`mt-1 rounded-md border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-lg ${
            floating ? "" : "absolute inset-x-0 bottom-full z-10 mb-1"
          }`}
        >
          Không tìm thấy. Ô này tìm được tên đường, số nhà, phường — chưa tìm được tên toà nhà hay
          công ty. Thử gõ như "Hàm Nghi" hoặc "12 Nguyễn Huệ".
        </p>
      )}
      {open && items.length > 0 && (
        <ul
          id="kgs-geocode-list"
          role="listbox"
          className={`mt-1 overflow-hidden rounded-md border bg-popover text-sm shadow-lg ${
            floating ? "" : "absolute inset-x-0 bottom-full z-10 mb-1"
          }`}
        >
          {items.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              className={`cursor-pointer px-3 py-2 ${i === active ? "bg-accent" : "hover:bg-accent"}`}
            >
              <div className="font-medium">{s.name}</div>
              {s.place && <div className="text-xs text-muted-foreground">{s.place}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
