import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  contractsApi,
  toIsoUtc,
  type ExpiringContract,
  type RenewContractInput,
} from "@/lib/api/contracts";
import { getErrorMessage } from "@/lib/api/errors";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Điền sẵn form đúng một lần cho mỗi hợp đồng, ngay khi tải xong chi tiết của nó.
 *
 * Chỉ prefill khi dữ liệu thật sự có `endDate`: dialog này giờ nằm ngay trên dashboard
 * chính, một response thiếu field mà ném lỗi sẽ làm trắng cả trang bản đồ chứ không chỉ
 * hỏng riêng dialog.
 */
function usePrefillOnce(
  id: string | undefined,
  detail: { endDate?: string; rentAmount?: number } | undefined,
  cb: (d: { endDate: string; rentAmount: number }) => void,
) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!id) {
      last.current = null;
      return;
    }
    if (last.current === id || !detail?.endDate) return;
    last.current = id;
    cb({ endDate: detail.endDate, rentAmount: detail.rentAmount ?? 0 });
  }, [id, detail, cb]);
}

/**
 * Gia hạn nhanh từ danh sách "sắp hết hạn" mà không phải mở trang chi tiết hợp đồng.
 * Trước đây nằm trong trang Tổng quan; tách ra để panel "Cần chú ý" trên bản đồ dùng lại
 * khi trang đó bị gộp bỏ.
 */
export function QuickRenewDialog({
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

  const detailQ = useQuery({
    queryKey: ["contract", target?.id],
    queryFn: () => contractsApi.detail(target!.id),
    enabled: !!target,
  });
  const detail = detailQ.data;

  usePrefillOnce(target?.id, detail, (d) => {
    setStartDate(d.endDate.slice(0, 10));
    setEndDate("");
    setRent(d.rentAmount);
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
