import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AssetStatus, ContractStatus, UnitStatus } from "@/lib/types";

const assetTone: Record<AssetStatus, string> = {
  "Đang sử dụng": "bg-info/15 text-info border-info/30",
  "Đang cho thuê": "bg-success/15 text-success border-success/30",
  "Đang rao bán": "bg-warning/20 text-warning-foreground border-warning/40",
  "Trống": "bg-muted text-muted-foreground border-border",
  "Đã bán": "bg-secondary text-secondary-foreground border-border",
  "Hết hợp đồng thuê": "bg-destructive/15 text-destructive border-destructive/30",
};

const contractTone: Record<ContractStatus, string> = {
  "Nháp": "bg-muted text-muted-foreground border-border",
  "Đang hiệu lực": "bg-success/15 text-success border-success/30",
  "Hết hạn": "bg-destructive/15 text-destructive border-destructive/30",
  "Đã chấm dứt": "bg-secondary text-secondary-foreground border-border",
  "Đã gia hạn": "bg-info/15 text-info border-info/30",
};

const unitTone: Record<UnitStatus, string> = {
  "Trống": "bg-muted text-muted-foreground border-border",
  "Đang cho thuê": "bg-success/15 text-success border-success/30",
  "Đang sửa chữa": "bg-warning/20 text-warning-foreground border-warning/40",
};

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return <Badge variant="outline" className={cn("font-medium", assetTone[status])}>{status}</Badge>;
}
export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <Badge variant="outline" className={cn("font-medium", contractTone[status])}>{status}</Badge>;
}
export function UnitStatusBadge({ status }: { status: UnitStatus }) {
  return <Badge variant="outline" className={cn("font-medium", unitTone[status])}>{status}</Badge>;
}
