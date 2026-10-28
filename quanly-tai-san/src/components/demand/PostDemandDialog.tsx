import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { toastIfPendingReview } from "./demandToast";
import { saveDemandDraft, withPostDemandFlag, type DemandDraft } from "@/lib/demandDraft";
import { listingsApi } from "@/lib/api/listings";
import { CurrencyInput } from "@/components/CurrencyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ListingTypeCode } from "@/constants/enums";

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

  // Nhu cầu mở cho chủ nhà phải có khu vực — không có thì nó khớp mọi tin cả nước (máy chủ cũng
  // chặn). Mở từ trang chủ hay khi chưa lọc khu vực thì hỏi luôn tỉnh/thành, quận và giá tối đa.
  const needsArea =
    !base.city?.trim() &&
    !base.newProvinceCode &&
    !(base.latitude != null && base.longitude != null && base.radiusMeters != null);
  const [areaCity, setAreaCity] = useState("");
  const [areaDistrict, setAreaDistrict] = useState("");
  const [areaPriceMax, setAreaPriceMax] = useState<number | null>(null);
  const areas = useQuery({
    queryKey: ["listing-areas", base.type ?? null],
    queryFn: () => listingsApi.areas((base.type ?? undefined) as ListingTypeCode | undefined),
    enabled: open && needsArea,
    staleTime: 10 * 60_000,
  });
  const cityOptions = [...new Set((areas.data ?? []).map((a) => a.city))].sort((a, b) =>
    a.localeCompare(b, "vi"),
  );
  const districtOptions = [
    ...new Set(
      (areas.data ?? []).filter((a) => a.city === areaCity && a.district).map((a) => a.district),
    ),
  ].sort((a, b) => a.localeCompare(b, "vi"));

  // Điền lại mỗi lần mở: hộp dùng chung, lần trước có thể mở với bộ lọc khác.
  useEffect(() => {
    if (!open) return;
    setName(draft?.name ?? suggestedName);
    setOccupants(base.occupants ? String(base.occupants) : "");
    setAvailableBy(base.availableBy?.slice(0, 10) ?? "");
    setPets(base.petsAllowed === true);
    setNote(draft?.note ?? "");
    setNotify(draft?.notify ?? true);
    setAreaCity("");
    setAreaDistrict("");
    setAreaPriceMax(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const occupantsNum = occupants === "" ? null : Number(occupants);
  const occupantsValid =
    occupantsNum === null ||
    (Number.isInteger(occupantsNum) && occupantsNum >= 1 && occupantsNum <= 20);

  const fullCriteria = (): SavedSearchCriteria => ({
    ...base,
    ...(needsArea
      ? { city: areaCity || null, district: areaDistrict || null, priceMax: areaPriceMax }
      : {}),
    occupants: occupantsNum,
    availableBy: availableBy || null,
    petsAllowed: pets ? true : null,
  });

  const post = useMutation({
    mutationFn: () =>
      savedSearchesApi.create(name.trim(), fullCriteria(), notify, true, note.trim() || null),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["saved-searches"] });
      onOpenChange(false);
      if (toastIfPendingReview(s)) return;
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
      // Cờ trên đường quay về: bản nháp có mất thì trang vẫn mở lại hộp.
      void navigate({ to: "/login", search: { redirect: withPostDemandFlag(href) } });
      return;
    }
    post.mutate();
  };

  const canSubmit =
    name.trim().length > 0 && occupantsValid && (!needsArea || !!areaCity) && !post.isPending;

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

          {needsArea && (
            <div className="space-y-3 rounded-md border border-dashed p-3">
              <p className="text-sm font-medium">Bạn muốn tìm ở đâu?</p>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={areaCity}
                  onValueChange={(v) => {
                    setAreaCity(v);
                    setAreaDistrict("");
                  }}
                >
                  <SelectTrigger aria-label="Tỉnh/thành">
                    <SelectValue placeholder="Tỉnh/thành *" />
                  </SelectTrigger>
                  <SelectContent>
                    {cityOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={areaDistrict} onValueChange={setAreaDistrict} disabled={!areaCity}>
                  <SelectTrigger aria-label="Quận/huyện">
                    <SelectValue placeholder="Quận/huyện" />
                  </SelectTrigger>
                  <SelectContent>
                    {districtOptions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Giá tối đa</Label>
                <CurrencyInput
                  value={areaPriceMax}
                  onChange={setAreaPriceMax}
                  placeholder="Không bắt buộc"
                />
              </div>
            </div>
          )}

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
