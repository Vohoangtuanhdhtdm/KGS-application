import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Handshake, Plus } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MyDemandCard, demandState } from "@/components/demand/MyDemandCard";
import { PostDemandDialog } from "@/components/demand/PostDemandDialog";
import { useDemandDraftResume } from "@/components/demand/useDemandDraftResume";
import { InvitationsList } from "@/components/matchmaking/InvitationsList";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { savedSearchesApi } from "@/lib/api/savedSearches";

export const Route = createFileRoute("/nhu-cau")({
  head: () => ({ meta: [{ title: "Nhu cầu của tôi — KGS" }] }),
  component: () => (
    <ProtectedRoute>
      <MyDemandsPage />
    </ProtectedRoute>
  ),
});

const ORDER = { open: 0, expired: 1, alerts: 2 } as const;

/**
 * "Nhu cầu của tôi": các nhu cầu đã đăng (bộ lọc đã lưu, có hoặc không mở cho chủ nhà) và lời
 * mời xem nhà chủ nhà gửi tới. Thay cho tab "Lời mời xem nhà" cũ ở /yeu-cau — người tìm thấy
 * nhu cầu và lời mời nó mang lại ở cùng một chỗ.
 */
function MyDemandsPage() {
  const [open, setOpen] = useState(false);
  const [draft, clearDraft] = useDemandDraftResume();
  const list = useQuery({ queryKey: ["saved-searches"], queryFn: savedSearchesApi.list });
  const searches = [...(list.data ?? [])].sort(
    (a, b) => ORDER[demandState(a)] - ORDER[demandState(b)],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Nhu cầu của tôi</h1>
          <p className="text-sm text-muted-foreground">
            Nhu cầu đang mở thì chủ nhà có căn phù hợp sẽ thấy (không thấy tên hay số điện thoại của
            bạn) và gửi lời mời xem nhà.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Đăng nhu cầu mới
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Nhu cầu đã đăng</h2>
        {list.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : searches.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <Handshake className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-2 font-medium">Bạn chưa đăng nhu cầu nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cho biết bạn cần căn thế nào — chủ nhà phù hợp sẽ mời bạn đi xem.
            </p>
            <Button className="mt-4" onClick={() => setOpen(true)}>
              Đăng nhu cầu
            </Button>
          </div>
        ) : (
          searches.map((s) => <MyDemandCard key={s.id} search={s} />)
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Lời mời xem nhà</h2>
        <InvitationsList />
      </section>

      <PostDemandDialog
        open={open || draft !== null}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) clearDraft();
        }}
        criteria={{ type: 2 }}
        suggestedName="Nhu cầu tìm nhà của tôi"
        draft={draft}
      />
    </div>
  );
}
