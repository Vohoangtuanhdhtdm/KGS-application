import { WORKSPACES, type Workspace } from "@/lib/workspace";
import { WS_CLASS } from "./wsStyles";

/** Nhãn "đang ở không gian nào" — luôn hiện cạnh logo. */
export function WorkspaceBadge({ ws, className = "" }: { ws: Workspace; className?: string }) {
  const meta = WORKSPACES[ws];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${WS_CLASS[ws].soft} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
