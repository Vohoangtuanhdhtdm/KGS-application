import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assetsApi } from "@/lib/api/assets";
import {
  contractsApi,
  toIsoUtc,
  type ExpiringContract,
  type RenewContractInput,
} from "@/lib/api/contracts";
import { CONTRACT_DIRECTION } from "@/constants/enums";
import { formatDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/api/errors";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Building2, FileText, CalendarClock, ArrowRight, RefreshCw, Megaphone } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Tổng quan — Quản Lý Tài Sản" }] }),
  component: Dashboard,
});

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 text-3xl font-semibold truncate">{value}</div>
            {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function daysLeftClass(d: number): string {
  if (d <= 7) return "bg-destructive/15 text-destructive border-destructive/30";
  if (d <= 15) return "bg-warning/25 text-warning-foreground border-warning/40";
  return "bg-warning/10 text-warning-foreground border-warning/30";
}

function Dashboard() {
  const [renewTarget, setRenewTarget] = useState<ExpiringContract | null>(null);

  const assetsQ = useQuery({
    queryKey: ["assets", { page: 1, pageSize: 1 }],
    queryFn: () => assetsApi.list({ page: 1, pageSize: 1 }),
  });
  const activeContractsQ = useQuery({
    queryKey: ["contracts", { status: 2, page: 1, pageSize: 1 }],
    queryFn: () => contractsApi.list({ status: 2, page: 1, pageSize: 1 }),
  });
  const expiringQ = useQuery({
    queryKey: ["contracts-expiring", 30],
    queryFn: () => contractsApi.expiring(30),
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trang tổng quan</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Toàn cảnh danh mục tài sản và các mốc quan trọng.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          icon={Building2}
          label="Tổng tài sản"
          value={assetsQ.isLoading ? "…" : String(assetsQ.data?.totalCount ?? 0)}
        />
        <StatCard
          icon={FileText}
          label="Hợp đồng đang hiệu lực"
          value={activeContractsQ.isLoading ? "…" : String(activeContractsQ.data?.totalCount ?? 0)}
        />
      </div>

      <Link
        to="/my-listings"
        className="flex items-center gap-3 rounded-md border bg-primary/5 hover:bg-primary/10 transition-colors px-4 py-3 text-sm"
      >
        <Megaphone className="h-4 w-4 text-primary shrink-0" />
        <span className="flex-1">Xem tin đăng của bạn đang hiển thị công khai như thế nào</span>
        <ArrowRight className="h-4 w-4 text-primary shrink-0" />
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Hợp đồng sắp hết hạn
          </CardTitle>
          <Link
            to="/hop-dong"
            className="text-xs text-primary flex items-center gap-1 hover:underline"
          >
            Xem tất cả
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {expiringQ.isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}
          {expiringQ.isError && (
            <p className="text-sm text-destructive">
              {getErrorMessage(expiringQ.error, "Không tải được danh sách")}
            </p>
          )}
          {expiringQ.data && expiringQ.data.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Không có hợp đồng nào sắp hết hạn trong 30 ngày tới.
            </p>
          )}
          {expiringQ.data &&
            expiringQ.data.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/30 flex-wrap"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    <Link
                      to="/tai-san/$id"
                      params={{ id: c.assetId }}
                      className="hover:text-primary hover:underline"
                    >
                      {c.assetName}
                    </Link>
                    {c.assetUnitName && (
                      <span className="text-muted-foreground"> · {c.assetUnitName}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {CONTRACT_DIRECTION[c.direction]} · {c.counterpartyName} · Hết hạn{" "}
                    {formatDate(c.endDate)}
                  </div>
                </div>
                <Badge variant="outline" className={`${daysLeftClass(c.daysLeft)} shrink-0`}>
                  Còn {c.daysLeft} ngày
                </Badge>
                <Button size="sm" variant="outline" onClick={() => setRenewTarget(c)}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Gia hạn
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>

      <RenewFromDashboardDialog
        target={renewTarget}
        onOpenChange={(v) => {
          if (!v) setRenewTarget(null);
        }}
      />
    </div>
  );
}

function RenewFromDashboardDialog({
  target,
  onOpenChange,
}: {
  target: ExpiringContract | null;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rent, setRent] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  // Reset khi mở dialog mới
  const contractDetailQ = useQuery({
    queryKey: ["contract", target?.id],
    queryFn: () => contractsApi.detail(target!.id),
    enabled: !!target,
  });

  // Prefill khi có detail
  const detail = contractDetailQ.data;
  const currentTargetId = target?.id;
  // dùng useState effect thay thế bằng useMemo phản ứng — kiểm soát prefill 1 lần
  useMemoPrefill(currentTargetId, detail, (d) => {
    setStartDate(d ? d.endDate.slice(0, 10) : "");
    setEndDate("");
    setRent(d ? d.rentAmount : null);
    setNotes("");
  });

  const mut = useMutation({
    mutationFn: (b: RenewContractInput) => contractsApi.renew(target!.id, b),
    onSuccess: (newContract) => {
      toast.success("Đã gia hạn hợp đồng");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["contracts-expiring"] });
      onOpenChange(false);
      navigate({ to: "/hop-dong/$id", params: { id: newContract.id } });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không gia hạn được")),
  });

  const submit = () => {
    if (!startDate || !endDate || !rent) {
      toast.error("Vui lòng điền đủ thông tin");
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      toast.error("Ngày kết thúc phải sau ngày bắt đầu");
      return;
    }
    mut.mutate({
      newStartDate: toIsoUtc(startDate),
      newEndDate: toIsoUtc(endDate),
      newRentAmount: rent,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gia hạn hợp đồng</DialogTitle>
          <DialogDescription>
            {target?.assetName}
            {target?.assetUnitName ? ` · ${target.assetUnitName}` : ""} · {target?.counterpartyName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bắt đầu *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Kết thúc *</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tiền thuê mới *</Label>
            <CurrencyInput value={rent} onChange={setRent} />
          </div>
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={mut.isPending || !detail}>
            {mut.isPending ? "Đang gia hạn..." : "Gia hạn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper: gọi callback một lần khi id/detail sẵn sàng
import { useEffect, useRef } from "react";
function useMemoPrefill(
  id: string | undefined,
  detail: unknown,
  cb: (d: { endDate: string; rentAmount: number } | null) => void,
) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!id) {
      last.current = null;
      return;
    }
    if (last.current === id) return;
    if (detail) {
      last.current = id;
      cb(detail as { endDate: string; rentAmount: number });
    }
  }, [id, detail, cb]);
}
