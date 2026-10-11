import { Handshake } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Khớp CloseOutcomeStatsDto ở backend (ListingClosing.Summarize). */
export interface CloseOutcomeStats {
  viaKgs: number;
  elsewhere: number;
  withdrawn: number;
  expired: number;
  reportedTaken: number;
  unknown: number;
  /** Phần tin có khách qua KGS trong các tin đã có khách — null khi chưa có tin nào có khách. */
  viaKgsShare: number | null;
}

const ROWS: { key: keyof Omit<CloseOutcomeStats, "viaKgsShare">; label: string; color: string }[] =
  [
    { key: "viaKgs", label: "Có khách qua KGS", color: "#059669" },
    { key: "elsewhere", label: "Có khách qua kênh khác", color: "#0891b2" },
    { key: "withdrawn", label: "Không cho thuê/bán nữa", color: "#94a3b8" },
    { key: "expired", label: "Hết hạn hiển thị", color: "#cbd5e1" },
    { key: "reportedTaken", label: "Đóng theo phản ánh", color: "#f59e0b" },
    { key: "unknown", label: "Chưa rõ lý do (đóng trước khi có mục này)", color: "#e2e8f0" },
  ];

/**
 * "Tin đã đóng vì sao" — điểm cuối của chuỗi kết nối. Con số chính là tỷ lệ có khách nhờ KGS
 * trong số tin đã có khách: rút tin hay hết hạn không phải là thất bại của việc kết nối, nên
 * không kéo tỷ lệ xuống.
 */
export function CloseOutcomesCard({
  stats,
  scope,
}: {
  stats: CloseOutcomeStats;
  /** "của bạn" / "trong kỳ" — chen vào câu mô tả. */
  scope: string;
}) {
  const total = ROWS.reduce((n, r) => n + stats[r.key], 0);
  const deals = stats.viaKgs + stats.elsewhere;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Handshake className="h-4 w-4 text-emerald-600" /> Kết quả tin đã đóng
        </CardTitle>
        <CardDescription>
          {total} tin đã đóng {scope}. Người đăng chọn lý do khi đóng tin; hết hạn và đóng theo phản
          ánh do hệ thống ghi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <p className="text-3xl font-semibold tabular-nums text-emerald-700">
              {stats.viaKgsShare == null ? "—" : `${Math.round(stats.viaKgsShare * 100)}%`}
            </p>
            <p className="text-xs text-muted-foreground">
              kết nối thành công qua KGS
              {deals > 0 && ` (${stats.viaKgs}/${deals} tin đã có khách)`}
            </p>
          </div>
        </div>
        {total > 0 && (
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            {ROWS.filter((r) => stats[r.key] > 0).map((r) => (
              <span
                key={r.key}
                style={{ width: `${(stats[r.key] / total) * 100}%`, background: r.color }}
              />
            ))}
          </div>
        )}
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {ROWS.filter((r) => r.key !== "unknown" || stats.unknown > 0).map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
                {r.label}
              </span>
              <span className="font-medium tabular-nums">{stats[r.key]}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
