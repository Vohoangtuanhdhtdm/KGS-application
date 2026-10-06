import { useQuery } from "@tanstack/react-query";
import { adminBuildingsApi } from "@/lib/api/admin";
import { getErrorMessage } from "@/lib/api/errors";
import { BuildingExplorer } from "@/components/building/BuildingExplorer";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Mô hình toà nhà đúng như người tìm nhà thấy — kể cả khi đang ẩn hoặc chưa công khai. Dùng ở
 * trang Toà nhà 3D và ở khung duyệt tin của một căn (căn đó được chọn sẵn).
 */
export function AdminBuildingViewDialog({
  assetId,
  title,
  focusUnitName,
  onClose,
}: {
  assetId: string;
  title: string;
  /** Tin đang duyệt là của căn này — chọn sẵn căn đó trên mô hình. */
  focusUnitName?: string | null;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["admin-building", assetId],
    queryFn: () => adminBuildingsApi.get(assetId),
  });
  const model = q.data
    ? {
        ...q.data,
        focusUnitId: focusUnitName
          ? (q.data.units.find((u) => u.name === focusUnitName)?.id ?? null)
          : q.data.focusUnitId,
      }
    : null;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[96vh] w-[96vw] max-w-6xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Xem như người tìm nhà{q.data && !q.data.published ? " (mô hình hiện đang ẩn)" : ""}.
            Ảnh, giá và trạng thái căn lấy từ tin đang hiển thị.
          </DialogDescription>
        </DialogHeader>
        {model ? (
          model.footprint.length >= 3 ? (
            <BuildingExplorer model={model} height="clamp(340px, 62vh, 620px)" editorPreview />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Toà nhà chưa có khung 3D — chủ nhà chưa dựng mô hình.
            </p>
          )
        ) : q.isError ? (
          <p className="text-sm text-destructive">{getErrorMessage(q.error)}</p>
        ) : (
          <Skeleton className="h-[480px] w-full" />
        )}
      </DialogContent>
    </Dialog>
  );
}
