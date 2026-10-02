import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, BellOff, BookmarkPlus, Handshake, Loader2, Search, Trash2 } from "lucide-react";
import {
  savedSearchesApi,
  toCriteria,
  type SavedSearchCriteria,
  type SavedSearchDto,
} from "@/lib/api/savedSearches";
import type { PublicListingFilters } from "@/lib/api/listings";
import { getErrorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const QUERY_KEY = ["saved-searches"];

interface Props {
  /** Bộ lọc đang áp dụng — thứ sẽ được cất khi bấm "Lưu bộ lọc này". */
  currentFilters: PublicListingFilters;
  /** Gợi ý tên, do trang tìm kiếm tóm tắt từ chính các chip đang bật. */
  suggestedName: string;
  /** Có tiêu chí nào đang bật không. Lưu một bộ lọc rỗng chỉ tạo rác. */
  hasAnyFilter: boolean;
  onApply: (criteria: SavedSearchCriteria) => void;
}

export function SavedSearchesPopover({
  currentFilters,
  suggestedName,
  hasAnyFilter,
  onApply,
}: Props) {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const list = useQuery({
    queryKey: QUERY_KEY,
    queryFn: savedSearchesApi.list,
    // Chỉ gọi khi đã đăng nhập VÀ popover đang mở: đây là thứ phụ trên trang tìm kiếm,
    // không đáng để mỗi lượt vào trang phải cõng thêm một request.
    enabled: isAuthenticated && open,
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  const create = useMutation({
    mutationFn: () =>
      savedSearchesApi.create(
        (name.trim() || suggestedName).slice(0, 120),
        toCriteria(currentFilters),
      ),
    onSuccess: () => {
      setName("");
      invalidate();
      toast.success("Đã lưu bộ lọc. Có tin mới khớp, hệ thống sẽ báo cho bạn.");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không lưu được bộ lọc")),
  });

  const toggleNotify = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      savedSearchesApi.setNotify(id, enabled),
    onSuccess: invalidate,
    onError: (e) => toast.error(getErrorMessage(e, "Không đổi được cài đặt thông báo")),
  });

  // ---- Ghép đôi hai chiều: cho chủ nhà phù hợp thấy nhu cầu này (ẩn danh) và mời xem nhà ----
  const [shareId, setShareId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const share = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      savedSearchesApi.setDiscoverable(id, enabled, note.trim() || null),
    onSuccess: (s) => {
      invalidate();
      setShareId(null);
      toast.success(
        s.discoverableByOwners
          ? "Đã mở cho chủ nhà phù hợp mời bạn xem nhà."
          : "Đã tắt — chủ nhà không còn thấy nhu cầu này.",
        s.discoverableByOwners
          ? { description: "Lời mời sẽ đến email và mục “Lời mời xem nhà”." }
          : undefined,
      );
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không đổi được cài đặt")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => savedSearchesApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success("Đã xoá bộ lọc.");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không xoá được bộ lọc")),
  });

  // Người chưa đăng nhập vẫn thấy nút, nhưng bấm vào thì được giải thích vì sao cần tài
  // khoản. Ẩn hẳn thì họ không bao giờ biết tính năng này tồn tại để mà muốn đăng ký.
  if (!isAuthenticated) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => toast.info("Đăng nhập để lưu bộ lọc và nhận báo khi có tin mới khớp.")}
      >
        <BookmarkPlus className="h-4 w-4" />
        Lưu bộ lọc
      </Button>
    );
  }

  const items = list.data ?? [];
  const totalNew = items.reduce((sum, s) => sum + s.newCount, 0);

  const applySaved = (s: SavedSearchDto) => {
    onApply(s.criteria);
    setOpen(false);
    // Đã mở ra xem thì coi như đã đọc — huy hiệu về 0 ở lần tải sau.
    if (s.newCount > 0) void savedSearchesApi.markSeen(s.id).then(invalidate);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <BookmarkPlus className="h-4 w-4" />
          Bộ lọc đã lưu
          {totalNew > 0 && (
            <Badge className="ml-0.5 h-5 min-w-5 px-1 justify-center">{totalNew}</Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 space-y-2">
          <p className="text-sm font-medium">Lưu bộ lọc hiện tại</p>
          {hasAnyFilter ? (
            <>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={suggestedName}
                maxLength={120}
              />
              <Button
                size="sm"
                className="w-full gap-1.5"
                disabled={create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BookmarkPlus className="h-4 w-4" />
                )}
                Lưu bộ lọc này
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Chọn ít nhất một tiêu chí (khu vực, khoảng giá, số phòng ngủ...) rồi mới lưu được.
            </p>
          )}
        </div>

        <Separator />

        <div className="max-h-[min(28rem,60vh)] overflow-y-auto">
          {list.isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Đang tải...</p>
          ) : list.isError ? (
            <p className="p-3 text-sm text-destructive">
              {getErrorMessage(list.error, "Không tải được danh sách")}
            </p>
          ) : items.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Chưa có bộ lọc nào được lưu.</p>
          ) : (
            items.map((s) => (
              <div key={s.id}>
                <div className="flex items-center gap-1 px-3 py-2 hover:bg-accent/50 group">
                  <button
                    type="button"
                    onClick={() => applySaved(s)}
                    className="flex-1 text-left min-w-0"
                  >
                    <span className="flex items-center gap-1.5">
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{s.name}</span>
                      {s.newCount > 0 && (
                        <Badge className="h-5 min-w-5 px-1 justify-center shrink-0">
                          {s.newCount}
                        </Badge>
                      )}
                    </span>
                  </button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label={s.notifyEnabled ? "Tắt báo tin mới" : "Bật báo tin mới"}
                    title={s.notifyEnabled ? "Đang báo tin mới" : "Đã tắt báo tin mới"}
                    onClick={() => toggleNotify.mutate({ id: s.id, enabled: !s.notifyEnabled })}
                  >
                    {s.notifyEnabled ? (
                      <Bell className="h-3.5 w-3.5" />
                    ) : (
                      <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 shrink-0 ${s.discoverableByOwners ? "text-primary" : "text-muted-foreground"}`}
                    aria-label="Cho chủ nhà phù hợp mời tôi xem nhà"
                    aria-expanded={shareId === s.id}
                    title={
                      s.discoverableByOwners
                        ? "Đang cho chủ nhà phù hợp mời bạn"
                        : "Cho chủ nhà phù hợp mời bạn xem nhà"
                    }
                    onClick={() => {
                      setShareId(shareId === s.id ? null : s.id);
                      setNote(s.demandNote ?? "");
                    }}
                  >
                    <Handshake className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Xoá bộ lọc ${s.name}`}
                    onClick={() => remove.mutate(s.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {shareId === s.id && (
                  <div className="mx-3 mb-2 space-y-2 rounded-md border bg-muted/40 p-2.5 text-xs">
                    <p className="font-medium text-foreground">
                      {s.discoverableByOwners
                        ? "Đang cho chủ nhà phù hợp mời bạn xem nhà"
                        : "Cho chủ nhà phù hợp mời bạn xem nhà?"}
                    </p>
                    <p className="text-muted-foreground">
                      Chủ nhà có tin khớp bộ lọc này sẽ thấy <strong>nhu cầu</strong> của bạn và lời
                      nhắn dưới đây — không thấy tên, số điện thoại hay vị trí bạn ghim. Họ mời thì
                      bạn tự quyết nhận lời hay không.
                    </p>
                    <Textarea
                      rows={2}
                      maxLength={300}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Lời nhắn cho chủ nhà (không bắt buộc), ví dụ: 2 người, đi làm ở Quận 1, cần dọn vào trước 15/11"
                      aria-label="Lời nhắn cho chủ nhà"
                      className="text-xs"
                    />
                    <div className="flex justify-end gap-1.5">
                      {s.discoverableByOwners && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          disabled={share.isPending}
                          onClick={() => share.mutate({ id: s.id, enabled: false })}
                        >
                          Tắt
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="h-7"
                        disabled={share.isPending}
                        onClick={() => share.mutate({ id: s.id, enabled: true })}
                      >
                        {share.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        {s.discoverableByOwners ? "Lưu lời nhắn" : "Bật"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
