import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { listingsApi } from "@/lib/api/listings";
import type { ListingTypeCode } from "@/constants/enums";

/**
 * Ô tìm khu vực trên trang tìm kiếm.
 *
 * Bản trước đem chuỗi người dùng gõ đi hỏi Nominatim (OpenStreetMap) để đổi ra toạ độ, rồi
 * tìm theo bán kính quanh toạ độ đó. Cách đó sai ở ba tầng:
 *
 * 1. **Hỏi dịch vụ ngoài về một thứ dữ liệu của chính mình đã trả lời được.** Người gõ vào
 *    ô này gần như luôn gõ tên đơn vị hành chính, mà hệ thống thì biết chính xác những khu
 *    vực nào đang có tin.
 *
 * 2. **Gọi trên từng nhịp gõ.** Nó chờ 500ms rồi bắn, nên gõ "Quận Bình Thạnh" sinh ra cả
 *    truy vấn cho "Quận", "Quận B"... Nominatim quy định ~1 request/giây và cấm dùng kiểu
 *    gợi ý-khi-gõ; cách gọi đó đủ để bị chặn IP.
 *
 * 3. **Hỏng thì im lặng.** Lỗi bị nuốt trong một khối catch rỗng: người dùng gõ tên khu
 *    vực, con quay chạy rồi tắt, không có gì xảy ra và không một lời giải thích.
 *
 * Bản này lấy danh sách khu vực từ CHÍNH tin đăng (`/listings/areas`), tải một lần rồi lọc
 * tại chỗ, khớp không phụ thuộc dấu tiếng Việt.
 *
 * Vì sao không dùng danh mục hành chính `vietnam-provinces` mà ứng dụng đã đóng gói sẵn:
 * danh mục ghi "Thành phố Hồ Chí Minh", còn dữ liệu tin đăng ghi "TP. Hồ Chí Minh", mà bộ
 * lọc so khớp chuỗi CHÍNH XÁC — lấy tên từ danh mục thì mọi lượt tìm đều trả về 0 kết quả.
 * Lấy từ dữ liệu thật thì tên khớp đúng theo định nghĩa. Được thêm một điều nữa: danh sách
 * chỉ chứa khu vực CÓ tin, nên không bao giờ gợi ý người dùng vào một chỗ trống, và hiện
 * được luôn số tin của từng khu vực.
 */

export interface AreaPick {
  city: string;
  /** Rỗng khi người dùng chọn cả tỉnh/thành. */
  district: string;
}

/** Bỏ dấu tiếng Việt để "quan binh thanh" khớp được "Quận Bình Thạnh". */
function boDau(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

interface Muc {
  key: string;
  /** Dòng chính hiện trong danh sách gợi ý. */
  nhan: string;
  /** Dòng phụ — tên tỉnh/thành, để phân biệt các quận trùng tên giữa các tỉnh. */
  phu: string;
  city: string;
  district: string;
  soTin: number;
  /** Các từ đã bỏ dấu; khớp khi MỌI từ người dùng gõ đều xuất hiện. */
  tu: string[];
}

/** Dựng bảng tra từ danh sách khu vực có tin: từng quận, cộng thêm mục gộp cả tỉnh/thành. */
function dungBangTra(khuVuc: { city: string; district: string; count: number }[]): Muc[] {
  const ds: Muc[] = [];
  const theoTinh = new Map<string, number>();

  for (const k of khuVuc) {
    theoTinh.set(k.city, (theoTinh.get(k.city) ?? 0) + k.count);
    ds.push({
      key: `d:${k.city}:${k.district}`,
      nhan: k.district,
      phu: k.city,
      city: k.city,
      district: k.district,
      soTin: k.count,
      tu: boDau(`${k.district} ${k.city}`).split(/\s+/).filter(Boolean),
    });
  }

  for (const [city, count] of theoTinh) {
    ds.push({
      key: `p:${city}`,
      nhan: city,
      phu: "Toàn tỉnh/thành",
      city,
      district: "",
      soTin: count,
      tu: boDau(city).split(/\s+/).filter(Boolean),
    });
  }

  // Khu vực nhiều tin lên trước: người dùng gõ hai chữ mơ hồ thì chỗ có nhiều tin nhất
  // gần như luôn là chỗ họ định tới.
  return ds.sort((a, b) => b.soTin - a.soTin);
}

const SO_GOI_Y = 8;

export function AreaSearchBox({
  city,
  district,
  type,
  onPick,
  onClear,
  className,
}: {
  city: string;
  district: string;
  /** Loại tin đang xem — số tin cạnh mỗi gợi ý phải đếm đúng loại đó. */
  type: ListingTypeCode;
  onPick: (v: AreaPick) => void;
  onClear: () => void;
  className?: string;
}) {
  // Danh sách khu vực đổi rất chậm (chỉ khi có tin ở một quận mới), nên giữ lâu trong bộ
  // nhớ đệm thay vì tải lại mỗi lần mở trang tìm kiếm.
  const khuVucQuery = useQuery({
    queryKey: ["listing-areas", type],
    queryFn: () => listingsApi.areas(type),
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const bang = useMemo(
    () => dungBangTra(khuVucQuery.data ?? []),
    [khuVucQuery.data],
  );

  /** Nhãn của khu vực đang chọn — cũng là thứ hiện trong ô khi người dùng không gõ. */
  const nhanDangChon = district || city;

  const [q, setQ] = useState("");
  const [dangGo, setDangGo] = useState(false);
  const [moGoiY, setMoGoiY] = useState(false);
  const [viTri, setViTri] = useState(0);
  const boc = useRef<HTMLDivElement>(null);

  // Khu vực đổi từ nơi khác (áp bộ lọc đã lưu, form "Tìm theo nhu cầu", gỡ chip) thì ô
  // phải theo — nếu không, ô hiện một đằng mà bộ lọc chạy một nẻo.
  useEffect(() => {
    if (!dangGo) setQ("");
  }, [city, district, dangGo]);

  const goiY = useMemo(() => {
    const tuGo = boDau(q).split(/\s+/).filter(Boolean);
    if (tuGo.length === 0 || boDau(q).length < 2) return [];
    // Khớp theo TỪNG TỪ chứ không theo cả chuỗi: gõ "binh thanh ho chi minh" vẫn ra, dù
    // thứ tự từ trong tên thật không giống thứ tự người dùng gõ.
    return bang
      .filter((m) => tuGo.every((t) => m.tu.some((w) => w.startsWith(t))))
      .slice(0, SO_GOI_Y);
  }, [q, bang]);

  // Gõ đủ dài mà không ra gì thì phải NÓI, thay vì để người dùng nhìn một ô im lìm.
  const khongKhop =
    dangGo && !khuVucQuery.isLoading && boDau(q).length >= 2 && goiY.length === 0;

  useEffect(() => {
    setViTri(0);
  }, [q]);

  useEffect(() => {
    const ngoai = (e: MouseEvent) => {
      if (boc.current && !boc.current.contains(e.target as Node)) {
        setMoGoiY(false);
        setDangGo(false);
        setQ("");
      }
    };
    document.addEventListener("mousedown", ngoai);
    return () => document.removeEventListener("mousedown", ngoai);
  }, []);

  const chon = (m: Muc) => {
    onPick({ city: m.city, district: m.district });
    setQ("");
    setDangGo(false);
    setMoGoiY(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && goiY.length > 0) {
      e.preventDefault();
      setMoGoiY(true);
      setViTri((i) => (i + 1) % goiY.length);
    } else if (e.key === "ArrowUp" && goiY.length > 0) {
      e.preventDefault();
      setViTri((i) => (i - 1 + goiY.length) % goiY.length);
    } else if (e.key === "Enter") {
      // Chỉ tìm khi người dùng CHỦ ĐỘNG xác nhận, không tìm trên từng nhịp gõ.
      e.preventDefault();
      if (goiY[viTri]) chon(goiY[viTri]);
    } else if (e.key === "Escape") {
      setMoGoiY(false);
      setDangGo(false);
      setQ("");
    }
  };

  return (
    <div ref={boc} className={`relative ${className ?? ""}`}>
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        role="combobox"
        aria-expanded={moGoiY && (goiY.length > 0 || khongKhop)}
        aria-controls="goi-y-khu-vuc"
        aria-autocomplete="list"
        aria-label="Tìm theo tỉnh/thành hoặc quận/huyện"
        placeholder="Tỉnh/thành hoặc quận/huyện"
        className="pl-9 pr-8 h-9"
        value={dangGo ? q : nhanDangChon}
        onChange={(e) => {
          setDangGo(true);
          setMoGoiY(true);
          setQ(e.target.value);
        }}
        onFocus={() => {
          setDangGo(true);
          setQ("");
        }}
        onKeyDown={onKeyDown}
      />

      {nhanDangChon && !dangGo && (
        <button
          type="button"
          aria-label="Bỏ lọc khu vực"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {moGoiY && (goiY.length > 0 || khongKhop) && (
        <div
          id="goi-y-khu-vuc"
          role="listbox"
          className="map-overlay absolute left-0 right-0 top-[calc(100%+4px)] max-h-72 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
        >
          {khongKhop ? (
            <p className="px-2.5 py-2 text-sm text-muted-foreground">
              {khuVucQuery.isError
                ? "Không tải được danh sách khu vực. Kiểm tra kết nối rồi thử lại."
                : `Chưa có tin đăng nào ở khu vực khớp “${q.trim()}”. Danh sách chỉ gợi ý những nơi đang có tin.`}
            </p>
          ) : (
            goiY.map((m, i) => (
              <button
                key={m.key}
                type="button"
                role="option"
                aria-selected={i === viTri}
                onMouseEnter={() => setViTri(i)}
                onClick={() => chon(m)}
                className={`flex w-full items-baseline justify-between gap-3 rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors ${
                  i === viTri ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                }`}
              >
                <span className="truncate">
                  <span className="font-medium">{m.nhan}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{m.phu}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {m.soTin} tin
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
