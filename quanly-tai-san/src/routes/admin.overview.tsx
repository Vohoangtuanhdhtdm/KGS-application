import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowRight,
  Gauge,
  type LucideIcon,
  Clock,
  Flag,
  Inbox,
  Lock,
  ShieldCheck,
  Users,
  Home,
} from "lucide-react";
import { AdminRoute } from "@/components/auth/ProtectedRoute";
import { adminOverviewApi, type CountItem } from "@/lib/api/admin";
import { REPORT_REASON } from "@/lib/api/listings";
import { getErrorMessage } from "@/lib/api/errors";
import { ASSET_TYPE, MODERATION_REASON } from "@/constants/enums";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/overview")({
  head: () => ({ meta: [{ title: "Tổng quan quản trị — KGS" }] }),
  component: () => (
    <AdminRoute>
      <OverviewPage />
    </AdminRoute>
  ),
});

/**
 * Mỗi biểu đồ ở đây là MỘT chuỗi số liệu, một màu (--chart-1). Có chủ ý: bảng màu chart-1..5
 * của ứng dụng không qua được kiểm tra màu phân loại (đỏ/hổ phách gần như trùng với người mù
 * màu), nên không dựng biểu đồ nhiều chuỗi phải phân biệt bằng màu. Một chuỗi thì không cần
 * chú giải — tiêu đề biểu đồ nói nó là gì — và giá trị có nhãn trực tiếp hoặc trong tooltip.
 */
const BAR = "var(--color-chart-1)";
const PERIODS = [7, 30, 90] as const;

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--color-popover-foreground)",
    boxShadow: "var(--shadow-e2)",
  },
  labelStyle: { color: "var(--color-muted-foreground)", fontSize: 11 },
  itemStyle: { color: "var(--color-popover-foreground)" },
  cursor: { fill: "var(--color-muted)", opacity: 0.6 },
};

function hours(h: number | null | undefined): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} phút`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0).replace(".", ",")} giờ`;
  return `${Math.round(h / 24)} ngày`;
}

function OverviewPage() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const q = useQuery({
    queryKey: ["admin-overview", days],
    queryFn: () => adminOverviewApi.get(days),
    placeholderData: keepPreviousData,
  });
  const d = q.data;

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Gauge className="h-5 w-5 text-muted-foreground" /> Tổng quan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hệ thống đang khoẻ không: hàng đợi có dồn, duyệt nhanh hay chậm, người đăng hay sai ở
            đâu, báo vi phạm có được xử lý kịp.
          </p>
        </div>
        <div
          className="inline-flex rounded-md border p-0.5"
          role="group"
          aria-label="Khoảng thời gian"
        >
          {PERIODS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={days === p ? "default" : "ghost"}
              className="h-8 rounded-sm"
              onClick={() => setDays(p)}
            >
              {p} ngày
            </Button>
          ))}
        </div>
      </div>

      {q.error && <p className="text-sm text-destructive">{getErrorMessage(q.error)}</p>}
      {!d && q.isLoading && <Skeleton className="h-[600px] w-full" />}

      {d && (
        <>
          {/* ---- Việc cần làm ngay ---- */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              icon={ShieldCheck}
              label="Tin chờ duyệt"
              value={d.kpis.pendingQueue}
              hint={
                d.kpis.oldestPendingHours != null
                  ? `Lâu nhất đã đợi ${hours(d.kpis.oldestPendingHours)}`
                  : "Hàng đợi trống"
              }
              to="/admin/listings"
              alert={(d.kpis.oldestPendingHours ?? 0) > 24}
            />
            <Tile
              icon={Flag}
              label="Báo vi phạm chờ xử lý"
              value={d.kpis.pendingReports}
              hint={`Trung vị xử lý ${hours(d.reports.medianHoursToHandle)}`}
              to="/admin/reports"
              alert={d.kpis.pendingReports > 0}
            />
            <Tile
              icon={Home}
              label="Tin đang hiển thị"
              value={d.kpis.listingsLive}
              hint={`${d.kpis.listingsNew} tin mới trong ${days} ngày`}
              to="/admin/all-listings"
            />
            <Tile
              icon={Users}
              label="Người dùng"
              value={d.kpis.usersTotal}
              hint={`${d.kpis.usersNew} mới · ${d.kpis.lockedUsers} đang khoá`}
              to="/admin/users"
            />
          </div>

          {/* ---- Kiểm duyệt ---- */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Kiểm duyệt trong {days} ngày</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="grid grid-cols-2 gap-3 self-start">
                <Stat
                  label="Duyệt ngay vòng đầu"
                  value={
                    d.moderation.firstRoundApprovalPercent != null
                      ? `${d.moderation.firstRoundApprovalPercent.toString().replace(".", ",")}%`
                      : "—"
                  }
                  hint="Phần còn lại bị trả về hoặc từ chối ở lần đầu"
                />
                <Stat
                  label="Thời gian duyệt (trung vị)"
                  value={hours(d.moderation.medianHoursToDecision)}
                  hint={`90% xong trong ${hours(d.moderation.p90HoursToDecision)}`}
                />
                <Stat
                  label="Quyết định"
                  value={String(d.moderation.decisions)}
                  hint={`${d.moderation.approved} duyệt · ${d.moderation.changesRequested} trả về · ${d.moderation.rejected} từ chối`}
                />
                <Stat
                  label="Gỡ / đóng do vi phạm"
                  value={String(d.moderation.takenDown)}
                  hint="Sau báo vi phạm hoặc khoá tài khoản"
                />
              </div>
              <HBarChart
                title="Lý do trả về / từ chối phổ biến"
                empty="Chưa có tin nào bị trả về trong kỳ."
                data={label(
                  d.moderation.topReasons,
                  (k) => MODERATION_REASON[Number(k) as keyof typeof MODERATION_REASON] ?? "Khác",
                )}
                unit="lần"
              />
            </CardContent>
          </Card>

          {/* ---- Hoạt động theo ngày ---- */}
          <div className="grid gap-4 lg:grid-cols-2">
            <DailyChart
              title="Tin đăng mới mỗi ngày"
              data={d.daily.map((x) => ({ date: x.date, v: x.newListings }))}
              unit="tin"
            />
            <DailyChart
              title="Yêu cầu xem nhà mỗi ngày"
              data={d.daily.map((x) => ({ date: x.date, v: x.inquiries }))}
              unit="yêu cầu"
            />
          </div>

          {/* ---- Báo vi phạm & thị trường ---- */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Báo vi phạm</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {d.reports.received} báo · {d.reports.resolved} xác nhận · {d.reports.dismissed}{" "}
                  không vi phạm · {d.reports.pending} đang chờ
                </p>
              </CardHeader>
              <CardContent>
                <HBarChart
                  data={label(
                    d.reports.byReason,
                    (k) => REPORT_REASON[Number(k) as keyof typeof REPORT_REASON] ?? "Khác",
                  )}
                  empty="Chưa có báo vi phạm trong kỳ."
                  unit="báo"
                  bare
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tin đang hiển thị theo loại hình</CardTitle>
              </CardHeader>
              <CardContent>
                <HBarChart
                  data={label(
                    d.liveByType,
                    (k) => ASSET_TYPE[Number(k) as keyof typeof ASSET_TYPE] ?? "Khác",
                  )}
                  empty="Chưa có tin đang hiển thị."
                  unit="tin"
                  bare
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Theo tỉnh / thành</CardTitle>
              </CardHeader>
              <CardContent>
                <HBarChart
                  data={label(d.liveByCity, (k) => k.replace(/^(Thành phố|Tỉnh) /, ""))}
                  empty="Chưa có tin đang hiển thị."
                  unit="tin"
                  bare
                />
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">
            <Inbox className="mr-1 inline h-3.5 w-3.5" />
            {d.kpis.inquiriesNew} yêu cầu xem nhà và {d.kpis.invitationsNew} lời mời xem nhà (ghép
            đôi) trong {days} ngày.
            <Lock className="ml-3 mr-1 inline h-3.5 w-3.5" />
            Số liệu tính theo giờ Việt Nam, cập nhật mỗi lần mở trang.
            <Clock className="ml-3 mr-1 inline h-3.5 w-3.5" />
            Thời gian duyệt đo từ lúc gửi duyệt tới quyết định đầu tiên sau đó.
          </p>
        </>
      )}
    </div>
  );
}

function label(items: CountItem[], name: (k: string) => string) {
  return items.map((i) => ({ name: name(i.key), v: i.count }));
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  to,
  alert,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
  to: string;
  alert?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Icon className="h-4 w-4" /> {label}
        </span>
        <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">
        {value.toLocaleString("vi-VN")}
      </div>
      <div
        className={`mt-0.5 text-xs ${alert ? "font-medium text-warning" : "text-muted-foreground"}`}
      >
        {hint}
      </div>
    </Link>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function DailyChart({
  title,
  data,
  unit,
}: {
  title: string;
  data: { date: string; v: number }[];
  unit: string;
}) {
  const rows = data.map((x) => ({ ...x, label: `${x.date.slice(8, 10)}/${x.date.slice(5, 7)}` }));
  const total = data.reduce((s, x) => s + x.v, 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          Tổng {total} {unit}
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={rows}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            barCategoryGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v: number) => [`${v} ${unit}`, ""]}
              separator=""
            />
            <Bar dataKey="v" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Thanh ngang dựng bằng HTML thay cho Recharts: nhãn ở đây dài ("Thông tin sai (giá, diện
 * tích, địa chỉ)") và thẻ thì hẹp — trục chữ của Recharts có bề rộng cố định nên nhãn bị vỡ
 * dòng chồng lên nhau. Ở đây nhãn đủ một dòng, số đứng cạnh (nhãn trực tiếp, không cần
 * tooltip), thanh tỉ lệ nằm dưới.
 */
function HBarChart({
  title,
  data,
  empty,
  unit,
  bare,
}: {
  title?: string;
  data: { name: string; v: number }[];
  empty: string;
  unit: string;
  bare?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.v));
  const body =
    data.length === 0 ? (
      <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
    ) : (
      <ul className="space-y-2.5">
        {data.map((d) => (
          <li key={d.name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate" title={d.name}>
                {d.name}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {d.v} {unit}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-r bg-muted" aria-hidden="true">
              <div
                className="h-2 rounded-r"
                style={{ width: `${(100 * d.v) / max}%`, background: BAR }}
              />
            </div>
          </li>
        ))}
      </ul>
    );
  if (bare) return body;
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{title}</div>
      {body}
    </div>
  );
}
