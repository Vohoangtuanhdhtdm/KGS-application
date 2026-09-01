import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assetsApi, type UpdateAssetInput } from "@/lib/api/assets";
import {
  ASSET_TYPE,
  OWNERSHIP_TYPE,
  ASSET_STATUS,
  enumOptions,
  type AssetTypeCode,
  type AssetStatusCode,
  type OwnershipTypeCode,
} from "@/constants/enums";
import { CurrencyInput } from "@/components/CurrencyInput";
import { getErrorMessage } from "@/lib/api/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { VietnamAddressPicker } from "@/components/assets/VietnamAddressPicker";
import {
  AssetSpecsFields,
  emptySpecs,
  specsFromApi,
  specsToApi,
  type SpecsState,
} from "@/components/assets/AssetSpecsFields";

export const Route = createFileRoute("/tai-san/$id_/sua")({
  head: () => ({ meta: [{ title: "Sửa tài sản — Quản Lý Tài Sản" }] }),
  component: EditAsset,
});

function toIsoUtcOrNull(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
}

function EditAsset() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["asset", id],
    queryFn: () => assetsApi.detail(id),
    retry: 1,
  });

  const [name, setName] = useState("");
  const [type, setType] = useState<AssetTypeCode>(1);
  const [ownershipType, setOwnershipType] = useState<OwnershipTypeCode>(1);
  const [status, setStatus] = useState<AssetStatusCode>(4);
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [detail, setDetail] = useState("");
  const [area, setArea] = useState<number | null>(null);
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [specs, setSpecs] = useState<SpecsState>(emptySpecs);

  useEffect(() => {
    const a = query.data;
    if (!a) return;
    setName(a.name);
    setType(a.type);
    setOwnershipType(a.ownershipType);
    setStatus(a.status);
    setCity(a.address.city);
    setDistrict(a.address.district);
    setWard(a.address.ward);
    setDetail(a.address.detail ?? "");
    setArea(a.area);
    setCurrentValue(a.currentValue);
    setAcquisitionDate(a.acquisitionDate ? a.acquisitionDate.slice(0, 10) : "");
    setNotes(a.notes ?? "");
    setSpecs(specsFromApi(a));
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (body: UpdateAssetInput) => assetsApi.update(id, body),
    onSuccess: () => {
      toast.success("Đã cập nhật tài sản");
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["asset", id] });
      navigate({ to: "/tai-san/$id", params: { id } });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không cập nhật được tài sản")),
  });

  if (query.isLoading)
    return (
      <div className="p-6 max-w-3xl space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (query.isError || !query.data)
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">
          {getErrorMessage(query.error, "Không tìm thấy tài sản")}
        </p>
      </div>
    );

  const submit = () => {
    if (!name.trim() || !city.trim() || !district.trim() || !ward.trim()) {
      toast.error("Vui lòng nhập tên và địa chỉ đầy đủ");
      return;
    }
    mutation.mutate({
      name: name.trim(),
      type,
      ownershipType,
      status,
      address: {
        city: city.trim(),
        district: district.trim(),
        ward: ward.trim(),
        detail: detail.trim() || null,
      },
      location: query.data.location,
      area,
      currentValue: ownershipType === 2 ? null : currentValue,
      acquisitionDate: toIsoUtcOrNull(acquisitionDate),
      notes: notes.trim() || null,
      ...specsToApi(specs),
    });
  };

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/tai-san/$id" params={{ id }}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Quay lại
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sửa tài sản</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cập nhật thông tin và trạng thái tài sản.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Thông tin cơ bản</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tên tài sản *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Loại</Label>
              <Select
                value={String(type)}
                onValueChange={(v) => setType(Number(v) as AssetTypeCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enumOptions(ASSET_TYPE).map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hình thức</Label>
              <Select
                value={String(ownershipType)}
                onValueChange={(v) => setOwnershipType(Number(v) as OwnershipTypeCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enumOptions(OWNERSHIP_TYPE).map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select
                value={String(status)}
                onValueChange={(v) => setStatus(Number(v) as AssetStatusCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enumOptions(ASSET_STATUS).map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Địa chỉ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <VietnamAddressPicker
            city={city}
            district={district}
            ward={ward}
            onChange={(v) => {
              setCity(v.city);
              setDistrict(v.district);
              setWard(v.ward);
            }}
          />
          <div className="space-y-2">
            <Label>Số nhà, đường</Label>
            <Input value={detail} onChange={(e) => setDetail(e.target.value)} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Giá trị & ghi chú</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Diện tích (m²)</Label>
              <Input
                inputMode="decimal"
                value={area ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setArea(v === "" ? null : Number(v));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{ownershipType === 2 ? "Ngày bắt đầu thuê" : "Ngày mua"}</Label>
              <Input
                type="date"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
              />
            </div>
          </div>
          {ownershipType !== 2 && (
            <div className="space-y-2">
              <Label>Giá trị hiện tại</Label>
              <CurrencyInput value={currentValue} onChange={setCurrentValue} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Ghi chú</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>
      <AssetSpecsFields value={specs} onChange={setSpecs} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link to="/tai-san/$id" params={{ id }}>
            Huỷ
          </Link>
        </Button>
        <Button onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      </div>
    </div>
  );
}
