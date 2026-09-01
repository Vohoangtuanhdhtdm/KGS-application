import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  contractsApi,
  toIsoUtc,
  type RenewContractInput,
  type TerminateContractInput,
} from "@/lib/api/contracts";
import {
  CONTRACT_DIRECTION,
  CONTRACT_STATUS,
  CONTRACT_STATUS_CLASS,
  PAYMENT_CYCLE,
  TAX_RESPONSIBILITY,
} from "@/constants/enums";
import { formatDate, formatCurrency } from "@/lib/format";
import { getErrorMessage } from "@/lib/api/errors";
import { CurrencyInput } from "@/components/CurrencyInput";
import { ContractDocumentsBlock } from "@/components/contracts/ContractDocumentsBlock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, RefreshCw, XCircle, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/hop-dong/$id")({
  head: () => ({ meta: [{ title: "Chi tiết hợp đồng — Quản Lý Tài Sản" }] }),
  component: ContractDetailPage,
});

function ContractDetailPage() {
  const { id } = Route.useParams();
  const [renewOpen, setRenewOpen] = useState(false);
  const [termOpen, setTermOpen] = useState(false);

  const q = useQuery({ queryKey: ["contract", id], queryFn: () => contractsApi.detail(id) });

  if (q.isLoading)
    return (
      <div className="p-6 max-w-4xl space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (q.isError || !q.data)
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">
          {getErrorMessage(q.error, "Không tìm thấy hợp đồng")}
        </p>
      </div>
    );

  const c = q.data;
  const isActive = c.status === 2;

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/hop-dong">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Về danh sách
        </Link>
      </Button>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold">Hợp đồng thuê</h1>
            <Badge variant="outline" className={CONTRACT_STATUS_CLASS[c.status]}>
              {CONTRACT_STATUS[c.status]}
            </Badge>
            <Badge variant="outline">{CONTRACT_DIRECTION[c.direction]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            <Link
              to="/tai-san/$id"
              params={{ id: c.assetId }}
              className="hover:underline text-primary"
            >
              {c.assetName}
            </Link>
            {c.assetUnitName && <> · {c.assetUnitName}</>}
          </p>
        </div>
        {isActive && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRenewOpen(true)}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Gia hạn
            </Button>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => setTermOpen(true)}
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Chấm dứt
            </Button>
          </div>
        )}
      </div>

      {c.parentContractId && (
        <Card>
          <CardContent className="p-3 text-sm flex items-center gap-2">
            <span className="text-muted-foreground">Được gia hạn từ hợp đồng trước</span>
            <Link
              to="/hop-dong/$id"
              params={{ id: c.parentContractId }}
              className="text-primary hover:underline"
            >
              Xem hợp đồng gốc →
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Đối tác</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>
              <b>{c.counterpartyName}</b>
            </div>
            {c.counterpartyPhone && (
              <div className="text-muted-foreground">SĐT: {c.counterpartyPhone}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kỳ hạn</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>
              Từ: <b>{formatDate(c.startDate)}</b>
            </div>
            <div>
              Đến: <b>{formatDate(c.endDate)}</b>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tài chính</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>
              Tiền thuê: <b>{formatCurrency(c.rentAmount)}</b> /{" "}
              {PAYMENT_CYCLE[c.paymentCycle].toLowerCase()}
            </div>
            <div>
              Ngày thanh toán: <b>Ngày {c.paymentDueDay} mỗi kỳ</b>
            </div>
            {c.depositAmount != null && (
              <div>
                Tiền cọc: <b>{formatCurrency(c.depositAmount)}</b>
              </div>
            )}
            {c.nextRentIncreaseDate && (
              <div>
                Ngày tăng giá kế tiếp: <b>{formatDate(c.nextRentIncreaseDate)}</b>
              </div>
            )}
            <div>
              Ai chịu thuế: <b>{TAX_RESPONSIBILITY[c.taxResponsibility]}</b>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ghi chú</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">
            {c.notes || "—"}
          </CardContent>
        </Card>
      </div>

      <ContractDocumentsBlock contract={c} />

      <RenewDialog id={id} contract={c} open={renewOpen} onOpenChange={setRenewOpen} />
      <TerminateDialog id={id} open={termOpen} onOpenChange={setTermOpen} />
    </div>
  );
}

function RenewDialog({
  id,
  contract,
  open,
  onOpenChange,
}: {
  id: string;
  contract: { endDate: string; rentAmount: number };
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(contract.endDate.slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [rent, setRent] = useState<number | null>(contract.rentAmount);
  const [notes, setNotes] = useState("");

  const mut = useMutation({
    mutationFn: (b: RenewContractInput) => contractsApi.renew(id, b),
    onSuccess: (newContract) => {
      toast.success("Đã gia hạn hợp đồng");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["contract", id] });
      qc.invalidateQueries({ queryKey: ["reminders"] });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gia hạn hợp đồng</DialogTitle>
          <DialogDescription>Tạo hợp đồng kế tiếp nối với hợp đồng hiện tại.</DialogDescription>
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
          <Button onClick={submit} disabled={mut.isPending}>
            {mut.isPending ? "Đang gia hạn..." : "Gia hạn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TerminateDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");

  const mut = useMutation({
    mutationFn: (b: TerminateContractInput) => contractsApi.terminate(id, b),
    onSuccess: () => {
      toast.success("Đã chấm dứt hợp đồng");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["contract", id] });
      qc.invalidateQueries({ queryKey: ["reminders"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không chấm dứt được")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chấm dứt hợp đồng</DialogTitle>
          <DialogDescription>
            Thao tác này sẽ tắt các nhắc lịch liên quan và chuyển tài sản/phòng về trạng thái{" "}
            <b>Trống</b>.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm flex gap-2 items-start">
          <AlertTriangle className="h-4 w-4 text-warning-foreground shrink-0 mt-0.5" />
          <span>Không thể hoàn tác. Hãy chắc chắn về quyết định này.</span>
        </div>
        <div className="space-y-3 mt-3">
          <div className="space-y-1.5">
            <Label>Ngày chấm dứt *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Lý do</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Người thuê trả nhà sớm..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Huỷ
          </Button>
          <Button
            variant="destructive"
            onClick={() => mut.mutate({ terminatedAt: toIsoUtc(date), reason: reason.trim() })}
            disabled={mut.isPending}
          >
            {mut.isPending ? "Đang xử lý..." : "Chấm dứt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
