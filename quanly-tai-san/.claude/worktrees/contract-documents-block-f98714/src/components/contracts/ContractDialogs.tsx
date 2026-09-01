import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import type { LeaseContract } from "@/lib/types";

interface Props {
  contractId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function RenewContractDialog({ contractId, open, onOpenChange }: Props) {
  const store = useStore();
  const contract = store.contracts.find((c) => c.id === contractId);
  const [newRent, setNewRent] = useState(contract?.rentAmount ?? 0);
  const [months, setMonths] = useState(12);

  if (!contract) return null;

  const handleRenew = () => {
    const start = new Date(contract.endDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    const nc: LeaseContract = {
      ...contract,
      id: `k-${Date.now()}`,
      code: `${contract.code}-GH`,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      rentAmount: newRent,
      status: "Đang hiệu lực",
      parentContractId: contract.id,
    };
    store.renewContract(contract.id, nc);
    toast.success("Đã tạo hợp đồng gia hạn", {
      description: `HĐ mới ${nc.code} có hiệu lực đến ${formatDate(nc.endDate)}`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gia hạn hợp đồng {contract.code}</DialogTitle>
          <DialogDescription>
            Tạo hợp đồng nối tiếp bắt đầu từ ngày {formatDate(contract.endDate)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border p-3 bg-muted/40 text-sm">
            <div className="text-xs text-muted-foreground">Hợp đồng hiện tại</div>
            <div className="font-medium mt-0.5">{contract.code}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Giá thuê hiện tại: {formatCurrency(contract.rentAmount)} / {contract.paymentCycle}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Giá thuê mới (VNĐ)</Label>
            <Input
              type="number"
              value={newRent}
              onChange={(e) => setNewRent(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Thời hạn mới (tháng)</Label>
            <Input
              type="number"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              min={1}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={handleRenew}>Xác nhận gia hạn</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TerminateContractDialog({ contractId, open, onOpenChange }: Props) {
  const store = useStore();
  const contract = store.contracts.find((c) => c.id === contractId);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  if (!contract) return null;

  const handleTerminate = () => {
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do chấm dứt");
      return;
    }
    store.terminateContract(contract.id, new Date(date).toISOString(), reason);
    toast.success("Đã chấm dứt hợp đồng");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chấm dứt hợp đồng {contract.code}</DialogTitle>
          <DialogDescription>Xác nhận chấm dứt hợp đồng trước hạn.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Ngày chấm dứt</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Lý do</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Người thuê yêu cầu trả nhà sớm..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button variant="destructive" onClick={handleTerminate}>
            Xác nhận chấm dứt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
