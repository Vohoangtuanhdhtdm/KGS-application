import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ListingTypeCode } from "@/constants/enums";
import { demandPulseApi } from "@/lib/api/demandPulse";
import { DemandPulseCard } from "./DemandPulseCard";
import { PostDemandDialog } from "./PostDemandDialog";
import { useDemandDraftResume } from "./useDemandDraftResume";

/**
 * Mục "Không muốn tự lục tìm?" trên trang chủ: lối vào thứ nhất của ghép đôi hai chiều, kèm các
 * khu đang có nhiều người tìm (Nhịp cầu) — người tìm thấy mình không đơn độc, chủ nhà thấy cầu thật.
 */
export function DemandBand({ type }: { type: ListingTypeCode }) {
  const [open, setOpen] = useState(false);
  const [draft, clearDraft] = useDemandDraftResume();
  const top = useQuery({
    queryKey: ["demand-pulse-top", type],
    queryFn: () => demandPulseApi.top(type),
    staleTime: 5 * 60_000,
  });
  const pulses = top.data ?? [];
  const isOpen = open || draft !== null;

  return (
    <section className="rounded-2xl border bg-card p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl space-y-2">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <Handshake className="h-3.5 w-3.5" /> Chủ nhà sẽ mời bạn
          </span>
          <h2 className="text-2xl font-semibold leading-tight tracking-tight">
            Không muốn tự lục tìm?
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Đăng nhu cầu một lần: khu vực, giá, số người ở. Chủ nhà có căn phù hợp sẽ gửi lời mời
            xem nhà — họ không thấy tên hay số điện thoại của bạn cho tới khi bạn nhận lời.
          </p>
        </div>
        <Button size="lg" className="w-fit" onClick={() => setOpen(true)}>
          <Handshake className="mr-1.5 h-4 w-4" />
          Đăng nhu cầu
        </Button>
      </div>

      {pulses.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-medium">Khu vực đang có nhiều người tìm</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {pulses.map((p) => (
              <DemandPulseCard key={`${p.city}|${p.district}`} pulse={p} />
            ))}
          </div>
        </div>
      )}

      <PostDemandDialog
        open={isOpen}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) clearDraft();
        }}
        criteria={{ type }}
        suggestedName="Nhu cầu tìm nhà của tôi"
        draft={draft}
      />
    </section>
  );
}
