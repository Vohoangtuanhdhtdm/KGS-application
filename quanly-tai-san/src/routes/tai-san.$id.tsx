import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assetsApi } from "@/lib/api/assets";
import { ASSET_TYPE, OWNERSHIP_TYPE } from "@/constants/enums";
import { AssetStatusBadgeCode } from "@/components/EnumBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/api/errors";
import { ApiError } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MapPin,
  Ruler,
  Calendar,
  Wallet,
  ImageIcon,
  RefreshCw,
  Link2,
  ArrowRight,
} from "lucide-react";
import { AssetMediaTab } from "@/components/media/AssetMediaTab";
import { EquipmentTab } from "@/components/assets/EquipmentTab";
import { MaintenanceTab } from "@/components/assets/MaintenanceTab";
import { UsagePeriodsTab } from "@/components/assets/UsagePeriodsTab";
import { SaleListingTab } from "@/components/assets/SaleListingTab";
import { AssetUnitsTab } from "@/components/units/AssetUnitsTab";
import { AssetContractsTab } from "@/components/contracts/AssetContractsTab";
import { AssetDocumentsTab } from "@/components/assets/AssetDocumentsTab";
import { ClientMap } from "@/components/map/ClientMap";

export const Route = createFileRoute("/tai-san/$id")({
  // ?tab=sale để mở thẳng tab Rao bán (dùng bởi link "Xem chi tiết" ở trang /rao-ban)
  validateSearch: (s: Record<string, unknown>): { tab?: string } =>
    typeof s.tab === "string" ? { tab: s.tab } : {},
  head: () => ({ meta: [{ title: "Chi tiết tài sản — Quản Lý Tài Sản" }] }),
  component: AssetDetail,
});

function AssetDetail() {
  const { id } = Route.useParams();
  const { tab: tabParam } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [delOpen, setDelOpen] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);
  const [tab, setTab] = useState(tabParam ?? "overview");

  const query = useQuery({
    queryKey: ["asset", id],
    queryFn: () => assetsApi.detail(id),
    retry: 1,
  });

  const removeMut = useMutation({
    mutationFn: () => assetsApi.remove(id),
    onSuccess: () => {
      toast.success("Đã xoá tài sản");
      qc.invalidateQueries({ queryKey: ["assets"] });
      navigate({ to: "/tai-san" });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) setDelError(getErrorMessage(err));
      else {
        toast.error(getErrorMessage(err, "Không xoá được tài sản"));
        setDelOpen(false);
      }
    },
  });

  if (query.isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-[1200px]">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="p-6 max-w-[600px]">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/tai-san">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Về danh sách
          </Link>
        </Button>
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <p className="text-sm text-destructive">
              {getErrorMessage(query.error, "Không tìm thấy tài sản")}
            </p>
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Thử lại
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const a = query.data;

  return (
    <div className="p-6 space-y-5 max-w-[1200px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/tai-san">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Về danh sách
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tai-san/$id/sua" params={{ id }}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Sửa
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              setDelError(null);
              setDelOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Xoá
          </Button>
        </div>
      </div>

      <Card>
        <div className="relative h-56 bg-muted overflow-hidden rounded-t-lg">
          {a.thumbnail?.url ? (
            <img src={a.thumbnail.url} alt={a.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <CardContent className="p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{a.name}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <MapPin className="h-4 w-4" />
                {[a.address.detail, a.address.ward, a.address.district, a.address.city]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AssetStatusBadgeCode code={a.status} />
              <Badge variant="secondary">{OWNERSHIP_TYPE[a.ownershipType]}</Badge>
              <Badge variant="outline">{ASSET_TYPE[a.type]}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="units">Tầng/Phòng ({a.unitCount})</TabsTrigger>
          <TabsTrigger value="contracts">Hợp đồng ({a.activeContractCount})</TabsTrigger>
          <TabsTrigger value="media">Ảnh</TabsTrigger>
          <TabsTrigger value="equipment">Thiết bị</TabsTrigger>
          <TabsTrigger value="maintenance">Sửa chữa</TabsTrigger>
          {a.ownershipType === 1 && <TabsTrigger value="usage">Lịch sử sử dụng</TabsTrigger>}
          {a.ownershipType === 1 && <TabsTrigger value="sale">Rao bán</TabsTrigger>}
          <TabsTrigger value="docs">Giấy tờ</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Thông tin</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row icon={Ruler} label="Diện tích" value={a.area ? `${a.area} m²` : "—"} />
                <Row
                  icon={Wallet}
                  label="Giá trị hiện tại"
                  value={a.currentValue ? formatCurrency(a.currentValue) : "—"}
                />
                <Row
                  icon={Calendar}
                  label={a.ownershipType === 2 ? "Ngày bắt đầu thuê" : "Ngày mua"}
                  value={formatDate(a.acquisitionDate)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ghi chú</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {a.notes || "—"}
                </p>
              </CardContent>
            </Card>
          </div>
          {/* Trạng thái liên kết tin đăng — chỉ đọc; thao tác nằm ở tab Rao bán */}
          {a.linkedPropertyId !== null && (
            <div className="flex items-center gap-2 text-sm">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span>Đã liên kết với tin đăng công khai</span>
              {a.ownershipType === 1 && (
                <button
                  type="button"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                  onClick={() => setTab("sale")}
                >
                  Xem chi tiết
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {a.location && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vị trí</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientMap
                  center={[a.location.latitude, a.location.longitude]}
                  zoom={15}
                  height={300}
                  markers={[
                    {
                      id: a.id,
                      lat: a.location.latitude,
                      lng: a.location.longitude,
                      title: a.name,
                    },
                  ]}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Toạ độ: {a.location.latitude.toFixed(5)}, {a.location.longitude.toFixed(5)}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="units">
          <AssetUnitsTab assetId={id} />
        </TabsContent>
        <TabsContent value="contracts">
          <AssetContractsTab assetId={id} />
        </TabsContent>
        <TabsContent value="media">
          <AssetMediaTab assetId={id} />
        </TabsContent>
        <TabsContent value="equipment">
          <EquipmentTab assetId={id} />
        </TabsContent>
        <TabsContent value="maintenance">
          <MaintenanceTab assetId={id} />
        </TabsContent>
        {a.ownershipType === 1 && (
          <TabsContent value="usage">
            <UsagePeriodsTab assetId={id} />
          </TabsContent>
        )}
        {a.ownershipType === 1 && (
          <TabsContent value="sale">
            <SaleListingTab assetId={id} />
          </TabsContent>
        )}
        <TabsContent value="docs">
          <AssetDocumentsTab assetId={id} />
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={delOpen}
        onOpenChange={(v) => {
          if (!removeMut.isPending) {
            setDelOpen(v);
            if (!v) setDelError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá tài sản?</AlertDialogTitle>
            <AlertDialogDescription>
              {delError ? (
                <span className="text-destructive">{delError}</span>
              ) : (
                <>
                  Thao tác này không thể hoàn tác. Tài sản <b>{a.name}</b> sẽ bị xoá vĩnh viễn.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMut.isPending}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                removeMut.mutate();
              }}
              disabled={removeMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMut.isPending ? "Đang xoá..." : "Xoá"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground w-40">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
