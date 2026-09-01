import { useQuery } from "@tanstack/react-query";
import { remindersApi } from "@/lib/api/reminders";

/** Cửa sổ "sắp tới" cho badge — khớp mặc định của /reminders/upcoming. */
const UPCOMING_DAYS = 7;

/**
 * Số nhắc lịch sắp tới, hiển thị làm badge trên tab "Nhắc lịch".
 * Dùng chung queryKey với các nơi khác gọi upcoming để React Query tự chia sẻ cache.
 */
export function useReminderBadge(): number {
  const q = useQuery({
    queryKey: ["reminders-upcoming", UPCOMING_DAYS],
    queryFn: () => remindersApi.upcoming(UPCOMING_DAYS),
    retry: 1,
  });
  return q.data?.length ?? 0;
}
