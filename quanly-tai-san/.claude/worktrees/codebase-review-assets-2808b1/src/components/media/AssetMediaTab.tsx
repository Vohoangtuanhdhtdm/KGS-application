import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assetsApi } from "@/lib/api/assets";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Upload, Trash2, Star, ImageIcon, Loader2, X } from "lucide-react";

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX = 10 * 1024 * 1024;

interface PendingFile {
  file: File;
  previewUrl: string;
}

export function AssetMediaTab({ assetId }: { assetId: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = useQuery({
    queryKey: ["asset-media", assetId],
    queryFn: () => assetsApi.media.list(assetId),
  });

  const upload = useMutation({
    mutationFn: (files: File[]) => assetsApi.media.upload(assetId, files),
    onSuccess: (items) => {
      toast.success(`Đã tải lên ${items.length} ảnh`);
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPending([]);
      qc.invalidateQueries({ queryKey: ["asset-media", assetId] });
      qc.invalidateQueries({ queryKey: ["asset", assetId] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không tải được ảnh")),
  });

  // fetch không expose tiến độ upload → progress mô phỏng tới 90%, chốt 100% khi xong
  useEffect(() => {
    if (!upload.isPending) {
      setProgress(0);
      return;
    }
    setProgress(10);
    const t = setInterval(() => setProgress((p) => Math.min(p + 8, 90)), 350);
    return () => clearInterval(t);
  }, [upload.isPending]);

  const remove = useMutation({
    mutationFn: (mediaId: string) => assetsApi.media.remove(assetId, mediaId),
    onSuccess: () => {
      toast.success("Đã xoá ảnh");
      qc.invalidateQueries({ queryKey: ["asset-media", assetId] });
      qc.invalidateQueries({ queryKey: ["asset", assetId] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không xoá được ảnh")),
  });

  const setThumb = useMutation({
    mutationFn: (mediaId: string) => assetsApi.media.setThumbnailFromMedia(assetId, mediaId),
    onSuccess: () => {
      toast.success("Đã đặt làm ảnh đại diện");
      qc.invalidateQueries({ queryKey: ["asset", assetId] });
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không đặt được ảnh đại diện")),
  });

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const added: PendingFile[] = [];
    for (const f of Array.from(fileList).slice(0, 10)) {
      if (!ACCEPT.includes(f.type) && !f.name.toLowerCase().endsWith(".heic")) {
        toast.error(`${f.name}: định dạng không hỗ trợ (chỉ JPEG/PNG/WEBP/HEIC)`);
        continue;
      }
      if (f.size > MAX) {
        toast.error(`${f.name}: vượt quá 10MB`);
        continue;
      }
      added.push({ file: f, previewUrl: URL.createObjectURL(f) });
    }
    if (added.length > 0) setPending((prev) => [...prev, ...added].slice(0, 10));
    if (inputRef.current) inputRef.current.value = "";
  };

  const removePending = (url: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.previewUrl === url);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.previewUrl !== url);
    });
  };

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    );
  }

  const items = (query.data ?? []).slice().sort((a, b) => {
    const ta = a.takenAt ? new Date(a.takenAt).getTime() : 0;
    const tb = b.takenAt ? new Date(b.takenAt).getTime() : 0;
    return tb - ta;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent
          className="p-6 border-dashed border-2 flex flex-col items-center justify-center text-center gap-2 hover:bg-muted/40 cursor-pointer transition"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm font-medium">Kéo-thả ảnh vào đây hoặc bấm để chọn</div>
          <div className="text-xs text-muted-foreground">
            JPEG / PNG / WEBP / HEIC · tối đa 10MB · tối đa 10 file/lần
          </div>
          <input
            ref={inputRef}
            type="file"
            hidden
            multiple
            accept="image/*"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-medium">Ảnh chờ tải lên ({pending.length})</div>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {pending.map((p) => (
                <div
                  key={p.previewUrl}
                  className="relative rounded-md overflow-hidden border bg-muted aspect-square"
                >
                  <img
                    src={p.previewUrl}
                    alt={p.file.name}
                    className="w-full h-full object-cover"
                  />
                  {!upload.isPending && (
                    <button
                      type="button"
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                      onClick={() => removePending(p.previewUrl)}
                      aria-label={`Bỏ ${p.file.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {upload.isPending && (
              <div className="space-y-1.5">
                <Progress value={progress} />
                <div className="flex items-center gap-2 text-xs text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Đang tải lên...
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => upload.mutate(pending.map((p) => p.file))}
                disabled={upload.isPending}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {upload.isPending ? "Đang tải lên..." : `Tải lên ${pending.length} ảnh`}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={upload.isPending}
                onClick={() => {
                  pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
                  setPending([]);
                }}
              >
                Huỷ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            Chưa có ảnh nào. Thêm ảnh để tài sản dễ nhận diện hơn.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((m) => (
            <div
              key={m.id}
              className="group relative rounded-md overflow-hidden border bg-muted aspect-square"
            >
              <img
                src={m.file.url}
                alt={m.caption ?? ""}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {m.takenAt && (
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent text-xs text-white">
                  {formatDate(m.takenAt)}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 group-hover:opacity-100 transition">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setThumb.mutate(m.id)}
                  disabled={setThumb.isPending}
                >
                  <Star className="h-3.5 w-3.5 mr-1" />
                  Đại diện
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => remove.mutate(m.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
