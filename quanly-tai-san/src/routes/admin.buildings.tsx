import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Box, Building2, Eye, EyeOff, Loader2, Search } from "lucide-react";
import { adminBuildingsApi, type AdminBuildingRow } from "@/lib/api/admin";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { AdminBuildingViewDialog } from "@/components/admin/AdminBuildingViewDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
 * TOÀ NHÀ 3D — góc nhìn quản trị.
 *
 * Chủ nhà tự dựng mô hình và tự bật "Công khai"; tin đăng qua kiểm duyệt còn mô hình thì
 * không. Trang này cho admin thấy mọi toà nhà, mở mô hình ra xem đúng như người tìm nhà thấy,
 * và ẩn mô hình sai khỏi trang công khai (kèm lý do gửi chủ nhà) — tin của các căn vẫn hiện.
 */
export const Route = createFileRoute("/admin/buildings")({
  head: () => ({ meta: [{ title: "Toà nhà 3D — Quản trị KGS" }] }),
  component: AdminBuildingsPage,
});

type ModelFilter = "" | "published" | "hidden" | "none";

const HIDE_TEMPLATES = [
  "Khung toà nhà lấy nhầm toà bên cạnh — vị trí trên bản đồ không khớp địa chỉ.",
  "Số tầng / số căn không khớp với thực tế hoặc với các tin đã đăng.",
  "Mô hình có căn đặt sai tầng, gây hiểu nhầm cho người tìm nhà.",
];

function AdminBuildingsPage() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [model, setModel] = useState<ModelFilter>("");
  const [viewing, setViewing] = useState<AdminBuildingRow | null>(null);
  const [hiding, setHiding] = useState<AdminBuildingRow | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const query = useQuery({
    queryKey: ["admin-buildings", q, model],
    queryFn: () => adminBuildingsApi.list({ q: q || undefined, model: model || undefined }),
    placeholderData: keepPreviousData,
  });
  const rows = query.data ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-buildings"] });
    qc.invalidateQueries({ queryKey: ["admin-building"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };
  const hide = useMutation({
    mutationFn: () => adminBuildingsApi.hide(hiding!.assetId, reason.trim()),
    onSuccess: () => {
      toast.success("Đã ẩn mô hình 3D", { description: "Chủ nhà nhận thông báo kèm lý do." });
      setHiding(null);
      setReason("");
      refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không ẩn được mô hình")),
  });
  const show = useMutation({
    mutationFn: (id: string) => adminBuildingsApi.show(id),
    onSuccess: () => {
      toast.success("Đã công khai lại mô hình 3D");
      refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không công khai được")),
  });

  const totals = {
    all: rows.length,
    published: rows.filter((r) => r.hasModel && r.published).length,
    units: rows.reduce((s, r) => s + r.units, 0),
    live: rows.reduce((s, r) => s + r.liveListings, 0),
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Box className="h-5 w-5 text-muted-foreground" /> Toà nhà 3D
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mọi toà nhà / khu trọ nhiều căn. Chủ nhà tự công khai mô hình 3D — mở ra xem và ẩn mô hình
          sai khỏi trang công khai; tin của các căn vẫn hiển thị.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Toà nhà" value={totals.all} />
        <Stat label="Mô hình đang công khai" value={totals.published} />
        <Stat label="Căn" value={totals.units} />
        <Stat label="Tin của căn đang hiển thị" value={totals.live} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tên toà nhà, địa chỉ, chủ nhà…"
            className="pl-9"
          />
        </div>
        <div
          className="inline-flex rounded-lg border bg-card p-0.5"
          role="group"
          aria-label="Mô hình"
        >
          {(
            [
              ["", "Tất cả"],
              ["published", "Đang công khai"],
              ["hidden", "Đang ẩn"],
              ["none", "Chưa dựng"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={model === v}
              onClick={() => setModel(v)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                model === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden py-0">
        {query.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-14 text-center text-sm text-muted-foreground">Không có toà nhà nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Toà nhà</th>
                  <th className="px-3 py-2.5 font-medium">Chủ nhà</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tầng</th>
                  <th className="px-3 py-2.5 text-right font-medium">Căn trống</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tin của căn</th>
                  <th className="px-3 py-2.5 font-medium">Mô hình 3D</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.assetId} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[r.addressDetail, r.district].filter(Boolean).join(", ")} · tạo{" "}
                        {formatDate(r.createdAt)}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Link to="/admin/users" className="hover:underline" title={r.ownerEmail}>
                        {r.ownerName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.floors}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span className="font-medium text-emerald-700">{r.vacantUnits}</span>/
                      {r.units}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {r.liveListings}
                      {r.pendingListings > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          +{r.pendingListings} chờ
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <ModelBadge row={r} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!r.hasModel}
                          onClick={() => setViewing(r)}
                        >
                          <Building2 className="mr-1 h-3.5 w-3.5" /> Xem 3D
                        </Button>
                        {r.hasModel &&
                          (r.published ? (
                            <Button size="sm" variant="ghost" onClick={() => setHiding(r)}>
                              <EyeOff className="mr-1 h-3.5 w-3.5" /> Ẩn
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={show.isPending}
                              onClick={() => show.mutate(r.assetId)}
                            >
                              <Eye className="mr-1 h-3.5 w-3.5" /> Công khai
                            </Button>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {viewing && <ViewDialog row={viewing} onClose={() => setViewing(null)} />}

      <Dialog open={!!hiding} onOpenChange={(v) => !v && setHiding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ẩn mô hình 3D: {hiding?.name}</DialogTitle>
            <DialogDescription>
              Người tìm nhà sẽ không xem được mô hình nữa; tin của các căn vẫn hiển thị. Lý do được
              gửi cho chủ nhà để họ sửa rồi tự công khai lại.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Chọn nhanh</Label>
            <div className="flex flex-col gap-1.5">
              {HIDE_TEMPLATES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setReason(t)}
                  className={`rounded-md border px-3 py-2 text-left text-sm ${
                    reason === t ? "border-primary bg-primary/5" : "hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Label htmlFor="hide-reason">Lý do gửi chủ nhà</Label>
            <Textarea
              id="hide-reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setHiding(null)}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 10 || hide.isPending}
              onClick={() => hide.mutate()}
            >
              {hide.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Ẩn mô hình
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModelBadge({ row: r }: { row: AdminBuildingRow }) {
  if (!r.hasModel)
    return (
      <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
        Chưa dựng
      </span>
    );
  return r.published ? (
    <span className="whitespace-nowrap rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
      Đang công khai
    </span>
  ) : (
    <span className="whitespace-nowrap rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
      Đang ẩn
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="gap-1 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function ViewDialog({ row, onClose }: { row: AdminBuildingRow; onClose: () => void }) {
  return <AdminBuildingViewDialog assetId={row.assetId} title={row.name} onClose={onClose} />;
}
