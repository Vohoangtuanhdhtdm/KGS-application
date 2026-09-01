import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assetsApi, type AssetDocumentDto } from "@/lib/api/assets";
import type { LeaseContractDto } from "@/lib/api/contracts";
import { getErrorMessage } from "@/lib/api/errors";
import { DOCUMENT_TYPE } from "@/constants/enums";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function ContractDocumentsBlock({ contract }: { contract: LeaseContractDto }) {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState<AssetDocumentDto | null>(null);

  const query = useQuery({
    queryKey: ["asset-documents", contract.assetId],
    queryFn: () => assetsApi.documents.list(contract.assetId),
  });

  const remove = useMutation({
    mutationFn: (documentId: string) => assetsApi.documents.remove(contract.assetId, documentId),
    onSuccess: () => {
      toast.success("Đã xoá tài liệu");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["asset-documents", contract.assetId] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không xoá được tài liệu")),
  });

  const isRenewal = !!contract.parentContractId;
  const items = (query.data ?? []).filter((d) => d.leaseContractId === contract.id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Tệp hợp đồng</CardTitle>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tải lên file hợp đồng
        </Button>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="text-sm text-destructive">
            {getErrorMessage(query.error, "Không tải được danh sách tài liệu")}
          </p>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            Chưa có file hợp đồng đính kèm.
            <div className="mt-3">
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Tải lên file hợp đồng
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((d) => {
              const isPdf = d.file.contentType === "application/pdf";
              return (
                <div key={d.id} className="flex items-center gap-3 flex-wrap border rounded-md p-3">
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
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <DocumentUploadDialog
        assetId={contract.assetId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        fixedType={isRenewal ? 4 : 3}
        leaseContractId={contract.id}
        defaultTitle={`Hợp đồng thuê - ${contract.counterpartyName} - ${formatDate(contract.startDate)}`}
        defaultIssueDate={contract.startDate.slice(0, 10)}
        hint={
          isRenewal
            ? "Hợp đồng này là gia hạn — tài liệu đính kèm sẽ được đánh dấu là Phụ lục hợp đồng."
            : undefined
        }
      />

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
    </Card>
  );
}
