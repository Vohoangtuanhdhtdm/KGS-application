import type { ReactNode } from "react";

export interface MarkerData {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  /** Màu ghim (chỉ bản GL). Mặc định màu thương hiệu. */
  color?: string;
}

/** Props chung của bản đồ đơn giản — cả bản GL lẫn bản Leaflet dùng chung. */
export interface SimpleMapProps {
  center: [number, number];
  zoom?: number;
  markers?: MarkerData[];
  height?: string | number;
  onPick?: (lat: number, lng: number) => void;
  pickerMarker?: { lat: number; lng: number } | null;
  circleRadius?: number; // meters
  /**
   * Hiện ô tìm địa chỉ để DI CHUYỂN CAMERA tới đó. Chỉ bản GL có: kết quả Geocoding tạm thời
   * của Mapbox chỉ được hiển thị trên bản đồ Mapbox và không được lưu — nên kết quả tìm chỉ
   * đưa camera tới, người dùng vẫn tự bấm/kéo ghim (toạ độ do người dùng đặt thì lưu được).
   */
  geocodeSearch?: boolean;
  /**
   * Đường đi (Mapbox Directions) để vẽ lên bản đồ — chỉ bản GL, vì điều khoản Mapbox bắt
   * buộc kết quả Directions hiển thị trên bản đồ Mapbox. Có đường thì khung nhìn ôm trọn nó.
   */
  route?: GeoJSON.LineString | null;
  className?: string;
  children?: ReactNode;
}
