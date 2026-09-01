/**
 * Geocode địa chỉ → toạ độ, dùng Nominatim (OpenStreetMap) public instance.
 *
 * ⚠️ Nominatim public instance MIỄN PHÍ nhưng giới hạn ~1 request/giây, KHÔNG có SLA cho
 * ứng dụng production nghiêm túc. Ở quy mô hiện tại, debounce 500ms trước khi gọi (xem
 * tin-dang.index.tsx) + không gọi lại khi query không đổi là đủ an toàn.
 * Nếu sau này gặp lỗi timeout/rate-limit (429) thường xuyên: hướng xử lý là thêm 1 endpoint
 * proxy nhỏ ở backend gọi hộ Nominatim kèm cache theo query — CHƯA cần làm bây giờ, chỉ ghi
 * chú lại cho người sau.
 */
export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query,
  )}&format=json&limit=1&countrycodes=vn`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (data.length === 0) return null;
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}
