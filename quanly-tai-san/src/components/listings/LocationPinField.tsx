import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { ClientMap } from "@/components/map/ClientMap";

export interface LatLngValue {
  lat: number;
  lng: number;
}

const DEFAULT_CENTER: [number, number] = [10.7769, 106.7009];

/**
 * Ghim vị trí bất động sản khi đăng tin.
 *
 * Trước đây trang đăng tin không có chỗ nào đặt toạ độ, nên MỌI tin tạo từ giao diện đều
 * không có vị trí — không hiện trên bản đồ tìm kiếm, không lọt vào "tìm trong bán kính".
 *
 * Toạ độ luôn do người đăng tự đặt (bấm hoặc kéo ghim). Ô tìm địa chỉ trên bản đồ chỉ đưa
 * camera tới khu vực, không tự cắm ghim: kết quả geocoding miễn phí của Mapbox không được
 * phép lưu lại, còn điểm người dùng tự chọn thì lưu được — và cũng chính xác hơn, vì
 * geocoding ở Việt Nam hay chỉ trúng tới tên đường chứ không tới số nhà trong hẻm.
 */
export function LocationPinField({
  value,
  onChange,
  disabled,
}: {
  value: LatLngValue | null;
  onChange: (v: LatLngValue) => void;
  disabled?: boolean;
}) {
  // Tâm bản đồ tách khỏi ghim: nếu tâm bám theo ghim, mỗi lần bấm bản đồ lại bay và phóng
  // về một mức cố định, kéo người dùng khỏi chỗ họ đang xem. Chỉ căn theo ghim đúng một lần
  // — khi ghim đã lưu được nạp về lúc sửa tin.
  const [center, setCenter] = useState<[number, number]>(
    value ? [value.lat, value.lng] : DEFAULT_CENTER,
  );
  const [zoom, setZoom] = useState(value ? 16 : 12);
  const centeredOnSaved = useRef(!!value);
  useEffect(() => {
    if (value && !centeredOnSaved.current) {
      centeredOnSaved.current = true;
      setCenter([value.lat, value.lng]);
      setZoom(16);
    }
  }, [value]);

  const pick = (lat: number, lng: number) => {
    centeredOnSaved.current = true;
    onChange({ lat, lng });
  };

  return (
    <div className="space-y-2">
      <ClientMap
        center={center}
        zoom={zoom}
        height={320}
        onPick={disabled ? undefined : pick}
        pickerMarker={value}
        geocodeSearch={!disabled}
      />
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {value ? (
          <span>
            Đã ghim tại {value.lat.toFixed(5)}, {value.lng.toFixed(5)}.
            {!disabled && " Kéo ghim hoặc bấm chỗ khác để chỉnh."}
          </span>
        ) : (
          <span>
            Bấm lên bản đồ để ghim đúng vị trí. Tin có ghim mới hiện trên bản đồ tìm kiếm và trong
            kết quả "tìm quanh đây" của người thuê.
          </span>
        )}
      </p>
    </div>
  );
}
