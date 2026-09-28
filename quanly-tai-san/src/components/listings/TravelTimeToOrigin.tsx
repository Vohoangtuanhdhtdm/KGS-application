import { useQuery } from "@tanstack/react-query";
import { Clock, Loader2 } from "lucide-react";
import {
  fetchRoute,
  formatDistance,
  formatDuration,
  profileLabel,
  type TravelProfile,
} from "@/lib/mapboxNav";

/**
 * Dòng "tới chỗ làm: 12 phút" trong thẻ xem nhanh của một tin khi đang tìm theo thời gian đi.
 *
 * Vùng tô chỉ cho biết "dưới 15 phút"; người dùng so hai căn thì cần con số của từng căn.
 * Gọi Directions khi người dùng BẤM mở thẻ (1 lượt/lần, nhớ trong phiên) — không gọi cho cả
 * danh sách, vì 20 thẻ × mỗi lần đổi bộ lọc sẽ đốt hạn mức miễn phí rất nhanh.
 */
export function TravelTimeToOrigin({
  from,
  to,
  toLabel,
  profile,
}: {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  toLabel: string;
  profile: TravelProfile;
}) {
  const q = useQuery({
    queryKey: ["route", from.lat, from.lng, to.lat, to.lng, profile],
    queryFn: ({ signal }) => fetchRoute(from, to, profile, signal),
    staleTime: Infinity,
    retry: 1,
  });
  return (
    <p className="mt-2 flex items-start gap-1.5 border-t pt-2 text-xs" aria-live="polite">
      <Clock className="mt-px h-3.5 w-3.5 shrink-0 text-primary" />
      <span>
        Tới {toLabel.toLowerCase()}:{" "}
        {q.isLoading ? (
          <Loader2 className="inline h-3 w-3 animate-spin" />
        ) : q.data ? (
          <>
            <strong>{formatDuration(q.data.durationSeconds)}</strong> ·{" "}
            {formatDistance(q.data.distanceMeters)} bằng {profileLabel(profile)}
          </>
        ) : (
          <span className="text-muted-foreground">không tính được</span>
        )}
      </span>
    </p>
  );
}
