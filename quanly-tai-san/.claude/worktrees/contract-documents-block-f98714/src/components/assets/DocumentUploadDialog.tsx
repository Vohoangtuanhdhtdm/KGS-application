import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assetsApi, type AssetDocumentDto } from "@/lib/api/assets";
import { getErrorMessage } from "@/lib/api/errors";
import { DOCUMENT_TYPE, enumOptions, type DocumentTypeCode } from "@/constants/enums";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Upload } from "lucide-react";

const ACCEPT_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_PDF = 25 * 1024 * 1024;

function validateDocumentFile(file: File): string | null {
  if (!ACCEPT_TYPES.includes(file.type)) {
    return `${file.name}: định dạng không hỗ trợ (chỉ PDF/JPEG/PNG)`;
  }
  const max = file.type === "application/pdf" ? MAX_PDF : MAX_IMAGE;
  if (file.size > max) {
    return `${file.name}: vượt quá ${max === MAX_PDF ? "25MB" : "10MB"}`;
  }
  return null;
}

interface DocumentUploadDialogProps {
  assetId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Khi có: loại tài liệu cố định, không cho người dùng chọn. */
  fixedType?: DocumentTypeCode;
  leaseContractId?: string | null;
  defaultTitle?: string;
  defaultIssueDate?: string;
  hint?: string;
  onUploaded?: (doc: AssetDocumentDto) => void;
}

export function DocumentUploadDialog({
  assetId,
  open,
  onOpenChange,
  fixedType,
  leaseContractId,
  defaultTitle = "",
  defaultIssueDate = "",
  hint,
  onUploaded,
}: DocumentUploadDialogProps) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<DocumentTypeCode>(fixedType ?? 1);
  const [title, setTitle] = useState(defaultTitle);
  const [issueDate, setIssueDate] = useState(defaultIssueDate);
  const [notes, setNotes] = useState("");

  const reset = () => {
    setFile(null);
    setType(fixedType ?? 1);
    setTitle(defaultTitle);
    setIssueDate(defaultIssueDate);
    setNotes("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const upload = useMutation({
    mutationFn: () =>
      assetsApi.documents.upload(assetId, {
        file: file!,
        type: fixedType ?? type,
        title: title.trim(),
        issueDate,
        leaseContractId: leaseContractId ?? null,
        notes: notes.trim() || null,
      }),
    onSuccess: (doc) => {
      toast.success("Đã tải lên tài liệu");
      qc.invalidateQueries({ queryKey: ["asset-documents", assetId] });
      reset();
      onOpenChange(false);
      onUploaded?.(doc);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không tải lên được tài liệu")),
  });

  const handleFile = (fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    const err = validateDocumentFile(f);
    if (err) {
      toast.error(err);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(f);
  };

  const submit = () => {
    if (!file) {
      toast.error("Vui lòng chọn file");
      return;
    }
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề");
      return;
    }
    if (!issueDate) {
      toast.error("Vui lòng chọn ngày ký");
      return;
    }
    upload.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!upload.isPending) {
          if (!v) reset();
          onOpenChange(v);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tải lên tài liệu</DialogTitle>
          <DialogDescription>Chấp nhận file PDF, JPEG, PNG.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {hint && (
            <div className="rounded-md border border-info/40 bg-info/10 p-2.5 text-xs text-info-foreground">
              {hint}
            </div>
          )}
          <div className="space-y-2">
            <Label>File *</Label>
            <Input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(e) => handleFile(e.target.files)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)}MB
              </p>
            )}
          </div>
          {!fixedType && (
            <div className="space-y-2">
              <Label>Loại tài liệu *</Label>
              <Select
                value={String(type)}
                onValueChange={(v) => setType(Number(v) as DocumentTypeCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enumOptions(DOCUMENT_TYPE).map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Tiêu đề *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Ngày ký *</Label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Ghi chú</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={upload.isPending}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={upload.isPending}>
            <Upload className="h-4 w-4 mr-1.5" />
            {upload.isPending ? "Đang tải lên..." : "Tải lên"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
