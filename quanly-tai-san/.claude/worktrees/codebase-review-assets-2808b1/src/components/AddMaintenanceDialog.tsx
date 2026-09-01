import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export function AddMaintenanceDialog({ assetId, open, onOpenChange }: { assetId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const store = useStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [cost, setCost] = useState(0);
  const [contractorId, setContractorId] = useState<string | undefined>();

  const contractors = store.contacts.filter((c) => c.type === "Nhà thầu");

  const handleSave = () => {
    if (!title.trim()) { toast.error("Vui lòng nhập tiêu đề"); return; }
    store.addMaintenance({
      id: `m-${Date.now()}`, assetId, title, description,
      startDate: new Date(startDate).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      cost, contractorId,
    });
    toast.success("Đã ghi nhận sửa chữa", { description: cost > 0 ? "Đã tự động tạo một dòng chi trong Sổ thu chi" : undefined });
    setTitle(""); setDescription(""); setEndDate(""); setCost(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi nhận sửa chữa</DialogTitle>
          <DialogDescription>Chi phí sẽ tự động xuất hiện trong Sổ thu chi của tài sản.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Tiêu đề *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Sơn lại phòng khách" /></div>
          <div className="space-y-2"><Label>Mô tả</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Ngày bắt đầu</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Ngày hoàn thành</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Chi phí (VNĐ)</Label><Input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} /></div>
          <div className="space-y-2">
            <Label>Nhà thầu</Label>
            <Select value={contractorId} onValueChange={setContractorId}>
              <SelectTrigger><SelectValue placeholder="Chọn nhà thầu (tuỳ chọn)" /></SelectTrigger>
              <SelectContent>
                {contractors.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button onClick={handleSave}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
