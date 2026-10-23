import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import type { DemandPulse } from "@/lib/api/demandPulse";
import { busiestBand, seekingVerb } from "./DemandPulseLine";

/** Thẻ Nhịp cầu trên trang chủ: một khu vực đang có nhiều người tìm. Bấm để xem tin ở đó. */
export function DemandPulseCard({ pulse }: { pulse: DemandPulse }) {
  const band = busiestBand(pulse);
  return (
    <Link
      to="/tin-dang"
      search={{
        type: pulse.type ?? undefined,
        city: pulse.city,
        district: pulse.district ?? undefined,
      }}
      className="group flex flex-col gap-1 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
    >
      <span className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
        <Users className="h-5 w-5 text-primary" />
        {pulse.people}
      </span>
      <span className="text-sm">
        người {seekingVerb(pulse.type)} ở{" "}
        <span className="font-medium">{pulse.district ?? pulse.city}</span>
      </span>
      {band && (
        <span className="text-xs text-muted-foreground">
          {band.people} người tìm mức {band.label}
        </span>
      )}
    </Link>
  );
}
