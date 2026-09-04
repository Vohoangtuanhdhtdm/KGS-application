import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reportsApi, type VacantUnitDto } from "@/lib/api/reports";
import { remindersApi, type ReminderDto } from "@/lib/api/reminders";
import { contractsApi } from "@/lib/api/contracts";
import { inquiriesApi } from "@/lib/api/engagement";
import { getErrorMessage } from "@/lib/api/errors";
import { formatCurrency, formatDate, daysUntil } from "@/lib/format";
import { REMINDER_TYPE } from "@/constants/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CircleCheck,
  DoorOpen,
  Inbox,
  Map as MapIcon,
  Megaphone,
  TrendingUp,
  Wallet,
} from "lucide-react";

/**
 * BÀN VẬN HÀNH — trang chủ mới.
 *
 * Trước đây "/" chuyển hướng thẳng sang /ban-do, tức là bản đồ đóng vai trang chủ và mọi
 * tính năng quản lý mở dạng sheet đè lên nó. Cấu trúc đó nói với người dùng rằng bản đồ là
 * sản phẩm, còn hợp đồng và dòng tiền là phụ lục — với người thuê nguyên căn chia phòng cho
 * thuê lại thì đúng ngược lại.
 *
 * Màn hình này trả lời ba câu hỏi vận hành của buổi sáng:
 *   1. Tháng này lãi thật bao nhiêu, sau khi đã trừ tiền trả chủ nhà?
 *   2. Hôm nay tôi cần làm gì?
 *   3. Phòng nào đang trống, và trống bao lâu rồi?
 *
 * Bản đồ vẫn còn nguyên, chỉ thôi làm khung xương chính — nay là một lối vào từ đây.
 */
export const Route = createFileRoute("/quan-ly/")({
  head: () => ({ meta: [{ title: "Bàn vận hành — Quản Lý Tài Sản" }] }),
  component: OperationsDesk,
});

function OperationsDesk() {
  const now = new Date();

  const dashboardQ = useQuery({
    queryKey: ["ops-dashboard", now.getFullYear(), now.getMonth() + 1],
    queryFn: () => reportsApi.dashboard(),
    retry: 1,
  });

  const d = dashboardQ.data;

  return (
    <div className="p-6 space-y-6 max-w-[1200px]">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bàn vận hành</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tháng {now.getMonth() + 1}/{now.getFullYear()}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/quan-ly/ban-do">
            <MapIcon className="h-4 w-4 mr-1.5" />
            Xem bản đồ
          </Link>
        </Button>
      </div>

      {dashboardQ.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : dashboardQ.isError ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            {getErrorMessage(dashboardQ.error, "Không tải được số liệu vận hành")}
          </CardContent>
        </Card>
      ) : d ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Con số quan trọng nhất của cả sản phẩm: lãi ĐÃ TRỪ tiền trả chủ nhà.
              Ghi rõ khoản trả chủ nhà ngay dưới — đó là thứ Excel không tự tính. */}
          <Kpi
            primary
            icon={TrendingUp}
            label="Lãi thật tháng này"
            value={formatCurrency(d.profit)}
            sub={
              d.rentExpense > 0
                ? `Đã trừ ${formatCurrency(d.rentExpense)} trả chủ nhà`
                : "Chưa có khoản trả chủ nhà"
            }
          />
          <Kpi
            icon={Wallet}
            label="Đã thu tiền thuê"
            value={formatCurrency(d.rentIncome)}
            sub={`Chi khác ${formatCurrency(d.otherExpense)}`}
          />
          <Kpi
            icon={DoorOpen}
            label="Lấp đầy"
            value={`${d.unitsOccupied}/${d.unitsTotal}`}
            sub={
              d.unitsVacant > 0
                ? `${d.unitsVacant} trống${d.unitsMaintenance > 0 ? ` · ${d.unitsMaintenance} đang sửa` : ""}`
                : "Không còn phòng trống"
            }
            tone={d.unitsVacant > 0 ? "warn" : "ok"}
          />
          <Kpi
            icon={Wallet}
            label="Cọc đang giữ"
            value={formatCurrency(d.depositHeld)}
            sub="Phải trả lại — không tính vào lãi"
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr] items-start">
        <TodoPanel />
        <VacancyPanel units={d?.vacantUnits ?? []} loading={dashboardQ.isLoading} />
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  primary = false,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  primary?: boolean;
  tone?: "warn" | "ok";
}) {
  return (
    <Card className={primary ? "border-primary/40 bg-primary/5" : undefined}>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <div
          className={`text-xl font-semibold tabular-nums ${
            primary ? "text-primary" : tone === "warn" ? "text-warning-foreground" : ""
          }`}
        >
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Việc cần làm — gộp ba nguồn vốn nằm ở ba màn hình khác nhau: nhắc lịch đến hạn, hợp đồng
 * sắp hết hạn, và yêu cầu xem nhà chưa xử lý.
 *
 * Nút "Đã thu/Đã trả" đặt NGAY TRÊN DÒNG, không bắt điều hướng sang /nhac-lich. Nếu người
 * dùng bỏ qua bước xác nhận này thì ô "Lãi thật" phía trên sẽ báo thấp giả tạo và mất niềm
 * tin ngay tuần đầu — nên phải làm cho nó rẻ nhất có thể.
 */
function TodoPanel() {
  const qc = useQueryClient();

  const remindersQ = useQuery({
    queryKey: ["reminders-upcoming", 14],
    queryFn: () => remindersApi.upcoming(14),
    retry: 1,
  });

  const expiringQ = useQuery({
    queryKey: ["contracts-expiring", 30],
    queryFn: () => contractsApi.expiring(30),
    retry: 1,
  });

  const inquiriesQ = useQuery({
    queryKey: ["inquiries", "received", 1],
    queryFn: () => inquiriesApi.received(1),
    retry: 1,
  });

  const settle = useMutation({
    mutationFn: (r: ReminderDto) => remindersApi.settle(r.id),
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: ["ops-dashboard"] });
      qc.invalidateQueries({ queryKey: ["reminders-upcoming", 14] });
      qc.invalidateQueries({ queryKey: ["cashflows"] });
      toast.success("Đã ghi vào sổ thu chi", {
        description: `${formatCurrency(entry.amount)} — ${entry.description ?? entry.assetName}`,
      });
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không ghi được bút toán")),
  });

  const reminders = remindersQ.data ?? [];
  const expiring = expiringQ.data ?? [];
  const newInquiries = inquiriesQ.data ?? [];
  const loading = remindersQ.isLoading || expiringQ.isLoading || inquiriesQ.isLoading;
  const empty = !loading && reminders.length === 0 && expiring.length === 0 && newInquiries.length === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Việc cần làm</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {loading ? (
          <div className="space-y-2 py-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : empty ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Không có việc nào đến hạn trong 2 tuần tới.
          </p>
        ) : (
          <>
            {newInquiries.length > 0 && (
              <Row
                when="Mới"
                what={`${newInquiries.length} yêu cầu xem nhà chưa xử lý`}
                right={
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/yeu-cau">
                      <Inbox className="h-3.5 w-3.5 mr-1.5" />
                      Xem
                    </Link>
                  </Button>
                }
              />
            )}

            {reminders.map((r) => {
              const left = daysUntil(r.dueDate);
              const settleable = r.leaseContractId !== null && (r.type === 1 || r.type === 2);
              return (
                <Row
                  key={r.id}
                  when={left <= 0 ? "Đến hạn" : `Còn ${left} ngày`}
                  overdue={left <= 0}
                  what={r.title}
                  hint={REMINDER_TYPE[r.type]}
                  right={
                    settleable ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={settle.isPending}
                        onClick={() => settle.mutate(r)}
                      >
                        <CircleCheck className="h-3.5 w-3.5 mr-1.5" />
                        {r.type === 1 ? "Đã thu" : "Đã trả"}
                      </Button>
                    ) : null
                  }
                />
              );
            })}

            {expiring.map((c) => (
              <Row
                key={c.id}
                when={`Còn ${c.daysLeft} ngày`}
                overdue={c.daysLeft <= 7}
                what={`HĐ hết hạn: ${c.assetName}${c.assetUnitName ? ` — ${c.assetUnitName}` : ""}`}
                hint={c.counterpartyName}
                right={
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/quan-ly/hop-dong/$id" params={{ id: c.id }}>
                      Tái ký
                    </Link>
                  </Button>
                }
              />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  when,
  what,
  hint,
  right,
  overdue = false,
}: {
  when: string;
  what: string;
  hint?: string;
  right?: React.ReactNode;
  overdue?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-b-0 border-dashed">
      <span
        className={`text-xs tabular-nums whitespace-nowrap w-20 shrink-0 ${
          overdue ? "text-destructive font-medium" : "text-muted-foreground"
        }`}
      >
        {when}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm truncate">{what}</div>
        {hint && <div className="text-xs text-muted-foreground truncate">{hint}</div>}
      </div>
      {right}
    </div>
  );
}

/**
 * Phòng trống là doanh thu đang chảy mất, nên hiển thị SỐ NGÀY đã trống chứ không chỉ
 * trạng thái. Phòng nào chưa có tin đăng thì đưa thẳng nút đăng tin ra — đây chính là chỗ
 * hai nửa sản phẩm (quản lý và marketplace) gặp nhau.
 */
function VacancyPanel({ units, loading }: { units: VacantUnitDto[]; loading: boolean }) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Phòng trống</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {loading ? (
          <div className="space-y-2 py-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : units.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Tất cả phòng đều đang có khách. 🎉
          </p>
        ) : (
          units.map((u) => {
            const days = u.vacantSince ? Math.max(0, -daysUntil(u.vacantSince)) : null;
            return (
              <div
                key={`${u.assetId}-${u.unitId ?? "whole"}`}
                className="flex items-center gap-3 py-2 border-b last:border-b-0 border-dashed"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">
                    {u.unitName}
                    {u.area ? <span className="text-muted-foreground"> · {u.area} m²</span> : null}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.assetName}</div>
                </div>

                {days !== null ? (
                  <Badge variant="outline" className="whitespace-nowrap">
                    Trống {days} ngày
                  </Badge>
                ) : (
                  <Badge variant="outline" className="whitespace-nowrap">
                    Chưa cho thuê
                  </Badge>
                )}

                {u.hasLiveListing ? (
                  <Badge
                    variant="outline"
                    className="bg-success/10 text-success border-success/30 whitespace-nowrap"
                  >
                    Đang đăng tin
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate({ to: "/quan-ly/tai-san/$id", params: { id: u.assetId } })}
                  >
                    <Megaphone className="h-3.5 w-3.5 mr-1.5" />
                    Đăng tin
                  </Button>
                )}
              </div>
            );
          })
        )}
        {units.length > 0 && (
          <p className="pt-2 text-xs text-muted-foreground">
            Sắp theo thời gian trống lâu nhất. Cập nhật lần cuối {formatDate(new Date())}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
