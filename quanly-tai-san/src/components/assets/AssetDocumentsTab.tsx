import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { assetsApi, type AssetDocumentDto } from "@/lib/api/assets";
import { contractsApi } from "@/lib/api/contracts";
import { getErrorMessage } from "@/lib/api/errors";
import { DOCUMENT_TYPE } from "@/constants/enums";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { DocumentUploadDialog } from "@/components/assets/DocumentUploadDialog";
import { FileText, ImageIcon, Plus, Trash2, ExternalLink, FolderOpen } from "lucide-react";

export function AssetDocumentsTab({ assetId }: { assetId: string }) {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState<AssetDocumentDto | null>(null);

  const query = useQuery({
    queryKey: ["asset-documents", assetId],
    queryFn: () => assetsApi.documents.list(assetId),
  });

  const contractsQ = useQuery({
    queryKey: ["contracts", { assetId }],
    queryFn: () => contractsApi.list({ assetId, pageSize: 100 }),
  });
  const contractsById = new Map((contractsQ.data?.items ?? []).map((c) => [c.id, c]));

  const remove = useMutation({
    mutationFn: (documentId: string) => assetsApi.documents.remove(assetId, documentId),
    onSuccess: () => {
      toast.success("Đã xoá tài liệu");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["asset-documents", assetId] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không xoá được tài liệu")),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          {getErrorMessage(query.error, "Không tải được danh sách giấy tờ")}
        </CardContent>
      </Card>
    );
  }

  const items = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tải lên giấy tờ
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            Chưa có giấy tờ nào đính kèm.
            <div className="mt-3">
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Tải lên giấy tờ
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((d) => {
            const isPdf = d.file.contentType === "application/pdf";
            const linkedContract = d.leaseContractId ? contractsById.get(d.leaseContractId) : null;
            return (
              <Card key={d.id}>
                <CardContent className="p-3 flex items-center gap-3 flex-wrap">
                  {isPdf ? (
                    <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{d.title}</span>
                      <Badge variant="outline">{DOCUMENT_TYPE[d.type]}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {d.issueDate ? `Ngày ký: ${formatDate(d.issueDate)}` : "—"}
                    </div>
                    {d.leaseContractId && (
                      <Link
                        to="/hop-dong/$id"
                        params={{ id: d.leaseContractId }}
                        className="inline-block mt-1"
                      >
                        <Badge
                          variant="outline"
                          className="bg-info/15 text-info border-info/30 hover:bg-info/25"
                        >
                          Gắn với HĐ:{" "}
                          {linkedContract
                            ? `${linkedContract.counterpartyName} (${formatDate(linkedContract.startDate)}-${formatDate(linkedContract.endDate)})`
                            : "Xem hợp đồng"}
                        </Badge>
                      </Link>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" asChild>
                      <a href={d.file.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleting(d)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DocumentUploadDialog assetId={assetId} open={uploadOpen} onOpenChange={setUploadOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá tài liệu?</AlertDialogTitle>
            <AlertDialogDescription>
              Tài liệu <b>{deleting?.title}</b> sẽ bị xoá vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(ev) => {
                ev.preventDefault();
                if (deleting) remove.mutate(deleting.id);
              }}
            >
              {remove.isPending ? "Đang xoá..." : "Xoá"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
