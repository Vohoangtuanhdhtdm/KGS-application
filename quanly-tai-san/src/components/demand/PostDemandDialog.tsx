import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Handshake, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/AuthContext";
import { getErrorMessage } from "@/lib/api/errors";
import { savedSearchesApi, type SavedSearchCriteria } from "@/lib/api/savedSearches";
import { saveDemandDraft, type DemandDraft } from "@/lib/demandDraft";

const NOTE_MAX = 300;

/**
 * "Đăng nhu cầu — chủ nhà sẽ mời bạn": lưu bộ lọc và mở cho chủ nhà phù hợp trong một bước.
 *
 * Dùng chung cho mọi lối vào (trang chủ, Tìm nhà, KiGi, Nhu cầu của tôi). Khách chưa đăng nhập
 * thì bản nháp được cất lại rồi chuyển sang đăng nhập; trang gọi hộp này mở lại nó bằng
 * `useDemandDraftResume` khi quay về.
 */
export function PostDemandDialog({
  open,
  onOpenChange,
  criteria,
  suggestedName,
  draft,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  criteria: SavedSearchCriteria;
  suggestedName: string;
  draft?: DemandDraft | null;
}) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const qc = useQueryClient();

  const base = draft?.criteria ?? criteria;
  const [name, setName] = useState("");
  const [occupants, setOccupants] = useState("");
  const [availableBy, setAvailableBy] = useState("");
  const [pets, setPets] = useState(false);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);

  // Điền lại mỗi lần mở: hộp dùng chung, lần trước có thể mở với bộ lọc khác.
  useEffect(() => {
    if (!open) return;
    setName(draft?.name ?? suggestedName);
    setOccupants(base.occupants ? String(base.occupants) : "");
    setAvailableBy(base.availableBy?.slice(0, 10) ?? "");
    setPets(base.petsAllowed === true);
    setNote(draft?.note ?? "");
    setNotify(draft?.notify ?? true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const occupantsNum = occupants === "" ? null : Number(occupants);
  const occupantsValid =
    occupantsNum === null ||
    (Number.isInteger(occupantsNum) && occupantsNum >= 1 && occupantsNum <= 20);

  const fullCriteria = (): SavedSearchCriteria => ({
    ...base,
    occupants: occupantsNum,
    availableBy: availableBy || null,
    petsAllowed: pets ? true : null,
  });

  const post = useMutation({
    mutationFn: () =>
      savedSearchesApi.create(name.trim(), fullCriteria(), notify, true, note.trim() || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
      onOpenChange(false);
      toast.success("Đã đăng — chủ nhà phù hợp có thể mời bạn", {
        description:
          "Bạn không cần để lại số điện thoại. Chỉ khi bạn nhận lời mời, chủ nhà mới biết bạn là ai.",
        action: { label: "Xem nhu cầu", onClick: () => void navigate({ to: "/nhu-cau" }) },
      });
    },
    onError: (e) => toast.error(getErrorMessage(e, "Chưa đăng được nhu cầu")),
  });

  const submit = () => {
    if (!isAuthenticated) {
      saveDemandDraft({ name: name.trim(), criteria: fullCriteria(), note: note.trim(), notify });
      onOpenChange(false);
      void navigate({ to: "/login", search: { redirect: href } });
      return;
    }
    post.mutate();
  };

  const canSubmit = name.trim().length > 0 && occupantsValid && !post.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" /> Đăng nhu cầu tìm nhà
          </DialogTitle>
          <DialogDescription>
            Chủ nhà có căn phù hợp sẽ thấy nhu cầu này (không thấy tên hay số điện thoại của bạn) và
            gửi lời mời xem nhà.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="demand-name">Tên nhu cầu</Label>
            <Input
              id="demand-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="demand-occupants">Số người ở</Label>
              <Input
                id="demand-occupants"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                placeholder="Không bắt buộc"
                value={occupants}
                onChange={(e) => setOccupants(e.target.value)}
                aria-invalid={!occupantsValid}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demand-available">Dọn vào trước ngày</Label>
              <Input
                id="demand-available"
                type="date"
                value={availableBy}
                onChange={(e) => setAvailableBy(e.target.value)}
              />
            </div>
          </div>
          {!occupantsValid && <p className="text-xs text-destructive">Số người ở từ 1 đến 20.</p>}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={pets} onCheckedChange={(v) => setPets(v === true)} />
            Tôi có nuôi thú cưng
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="demand-note">Lời nhắn cho chủ nhà</Label>
            <Textarea
              id="demand-note"
              rows={3}
              maxLength={NOTE_MAX}
              placeholder="Ví dụ: 2 người đi làm ở Quận 1, cần chỗ để 2 xe máy"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
              {note.length}/{NOTE_MAX}
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
            Báo tôi khi có tin mới khớp
          </label>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {isAuthenticated ? (
            <Link
              to="/nhu-cau"
              className="self-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Nhu cầu của tôi
            </Link>
          ) : (
            <span className="self-center text-xs text-muted-foreground">
              Bạn sẽ đăng nhập trước khi đăng
            </span>
          )}
          <Button onClick={submit} disabled={!canSubmit}>
            {post.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Đăng nhu cầu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
