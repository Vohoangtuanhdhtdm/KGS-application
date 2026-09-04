import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Eye,
  Heart,
  Lightbulb,
  MessageSquare,
} from "lucide-react";
import { analyticsApi, type DailyViewPoint } from "@/lib/api/analytics";
import { getErrorMessage } from "@/lib/api/errors";
import { formatCurrency } from "@/lib/format";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/thong-ke-tin")({
  head: () => ({ meta: [{ title: "Thống kê tin đăng — Quản Lý Tài Sản" }] }),
  component: () => (
    <ProtectedRoute>
      <ListingAnalyticsPage />
    </ProtectedRoute>
  ),
});

const VIEW_COLOR = "#2563eb";

/** "04/09" — trục ngày 30 mốc, ghi đủ năm thì chữ chồng lên nhau. */
function shortDay(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ViewChart({ data }: { data: DailyViewPoint[] }) {
  const rows = data.map((p) => ({ ...p, label: shortDay(p.date) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={rows} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="viewFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={VIEW_COLOR} stopOpacity={0.3} />
            <stop offset="100%" stopColor={VIEW_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
        {/* interval={4} — 30 mốc ngày mà ghi hết thì nhãn chồng lên nhau không đọc được */}
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={4} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={40} />
        <Tooltip
          formatter={(v: number) => [`${v} lượt xem`, ""]}
          labelFormatter={(l) => `Ngày ${l}`}
        />
        <Area
          type="monotone"
          dataKey="views"
          stroke={VIEW_COLOR}
          strokeWidth={2}
          fill="url(#viewFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Eye;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function ListingAnalyticsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: analyticsApi.summary,
    retry: 1,
  });

  const detail = useQuery({
    queryKey: ["analytics-listing", selectedId],
    queryFn: () => analyticsApi.forListing(selectedId!),
    enabled: selectedId != null,
    retry: 1,
  });

  if (summary.isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-4 max-w-[1000px] mx-auto">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (summary.isError || !summary.data) {
    return (
      <div className="p-4 lg:p-6 max-w-[600px] mx-auto">
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 mx-auto text-destructive/60" />
            <p className="text-sm text-destructive">
              {getErrorMessage(summary.error, "Không tải được thống kê")}
            </p>
            <Button size="sm" variant="outline" onClick={() => summary.refetch()}>
              Thử lại
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = summary.data;

  if (s.totalListings === 0) {
    return (
      <div className="p-4 lg:p-6 max-w-[600px] mx-auto">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-3">
            <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p>Bạn chưa có tin đăng nào để thống kê.</p>
            <Button size="sm" asChild>
              <Link to="/dang-tin">Đăng tin đầu tiên</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = detail.data;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1000px] mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/tin-cua-toi">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Tin của tôi
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Thống kê tin đăng</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Câu hỏi thật sự không phải "tin có bao nhiêu lượt xem" mà "vì sao chưa ai gọi".
          Các con số dưới đây để tách ra một trong ba nguyên nhân: không ai nhìn thấy tin,
          có nhìn nhưng chưa đủ thuyết phục, hay giá lệch mặt bằng.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          icon={Eye}
          label="Lượt xem 30 ngày"
          value={s.totalViews30Days}
          hint="đã lọc trùng theo người/ngày"
        />
        <StatTile icon={MessageSquare} label="Yêu cầu xem nhà" value={s.totalInquiries} />
        <StatTile icon={Heart} label="Lượt lưu tin" value={s.totalSaved} />
        <StatTile
          icon={BarChart3}
          label="Tin đang hiển thị"
          value={`${s.approvedListings}/${s.totalListings}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lượt xem 30 ngày qua — tất cả tin</CardTitle>
        </CardHeader>
        <CardContent>
          <ViewChart data={s.dailyViews} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Theo từng tin</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {s.listings.map((row) => (
              <button
                key={row.listingId}
                type="button"
                onClick={() =>
                  setSelectedId((cur) => (cur === row.listingId ? null : row.listingId))
                }
                className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${
                  selectedId === row.listingId ? "bg-accent/60" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{row.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {row.views30Days}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {row.inquiryCount}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {row.savedCount}
                      </span>
                    </div>
                  </div>
                  <div className="w-24 shrink-0">
                    <div className="text-xs text-muted-foreground mb-1">
                      Đầy đủ {row.completenessPercent}%
                    </div>
                    <Progress value={row.completenessPercent} className="h-1.5" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {detail.isLoading ? "Đang tải..." : (d?.title ?? "Chi tiết")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : detail.isError || !d ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(detail.error, "Không tải được thống kê của tin này")}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatTile icon={Eye} label="Tổng lượt xem" value={d.totalViews} />
                  <StatTile icon={Eye} label="7 ngày qua" value={d.views7Days} />
                  <StatTile
                    icon={MessageSquare}
                    label="Tỉ lệ liên hệ"
                    value={`${d.inquiryRatePercent}%`}
                    hint={`${d.inquiryCount} yêu cầu`}
                  />
                  <StatTile icon={Heart} label="Lượt lưu" value={d.savedCount} />
                </div>

                <ViewChart data={d.dailyViews} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-md border p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">So với khu vực</p>
                    {d.areaMedianPrice == null ? (
                      // Nói thẳng vì sao không có số, thay vì hiện một ô trống. Người dùng
                      // thấy ô trống sẽ tưởng hệ thống hỏng.
                      <p className="text-sm">
                        Khu vực mới có {d.areaListingCount} tin cùng loại — chưa đủ để so
                        sánh giá một cách có nghĩa.
                      </p>
                    ) : (
                      <>
                        <p className="text-sm">
                          Trung vị khu vực:{" "}
                          <span className="font-medium">
                            {formatCurrency(d.areaMedianPrice, { compact: true })}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            ({d.areaListingCount} tin)
                          </span>
                        </p>
                        {d.priceDiffPercent != null && (
                          <Badge
                            variant={
                              Math.abs(d.priceDiffPercent) <= 10
                                ? "secondary"
                                : d.priceDiffPercent > 0
                                  ? "destructive"
                                  : "default"
                            }
                            className="font-normal"
                          >
                            {d.priceDiffPercent > 0 ? "Cao hơn" : "Thấp hơn"}{" "}
                            {Math.abs(d.priceDiffPercent)}% mặt bằng
                          </Badge>
                        )}
                      </>
                    )}
                  </div>

                  <div className="rounded-md border p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Chất lượng tin</p>
                    <p className="text-sm">
                      Độ đầy đủ {d.completenessPercent}% · {d.imageCount} ảnh
                    </p>
                    <Progress value={d.completenessPercent} className="h-1.5 mt-1" />
                  </div>
                </div>

                {d.suggestions.length > 0 && (
                  <div className="rounded-md border border-warning/40 bg-warning/10 p-3 space-y-1.5">
                    <p className="text-sm font-medium inline-flex items-center gap-1.5">
                      <Lightbulb className="h-4 w-4" />
                      Nên làm gì tiếp
                    </p>
                    <ul className="text-sm space-y-1 list-disc pl-5">
                      {d.suggestions.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {d.slug && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/tin-dang/$slug" params={{ slug: d.slug }} target="_blank">
                      Xem tin công khai
                    </Link>
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
