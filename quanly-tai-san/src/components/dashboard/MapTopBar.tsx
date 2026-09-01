import { useState } from "react";
import { Search, SlidersHorizontal, List, Menu, X } from "lucide-react";
import { ASSET_STATUS, type AssetStatusCode } from "@/constants/enums";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type StatusFilter = "all" | AssetStatusCode;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: 2, label: ASSET_STATUS[2] },
  { value: 3, label: ASSET_STATUS[3] },
  { value: 4, label: ASSET_STATUS[4] },
];

export interface MapTopBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  status: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
  countOf: (v: StatusFilter) => number;
  onOpenList: () => void;
  onOpenRail?: () => void;
}

export function MapTopBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  countOf,
  onOpenList,
  onOpenRail,
}: MapTopBarProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="map-topbar flex h-14 items-center gap-2 px-2.5">
      {onOpenRail && (
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0"
          aria-label="Mở thanh điều hướng"
          onClick={onOpenRail}
        >
          <Menu className="h-4 w-4" />
        </Button>
      )}

      <div
        className="relative transition-[width] duration-200"
        style={{ width: focused ? 320 : 220 }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Tìm tài sản..."
          aria-label="Tìm tài sản theo tên"
          className="h-9 border-transparent bg-muted/60 pr-8 pl-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Xoá từ khoá"
            className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-sm text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-9 shrink-0">
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            Lọc
            {status !== "all" && <span className="ml-1 text-[#F2A93B]">•</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-52 p-2">
          <div className="space-y-1">
            {FILTERS.map((f) => (
              <button
                key={String(f.value)}
                type="button"
                onClick={() => onStatusChange(f.value)}
                aria-pressed={status === f.value}
                className={`flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none ${
                  status === f.value ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                {f.label}
                <span className="tabular-nums opacity-70">{countOf(f.value)}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Button size="sm" variant="ghost" className="h-9 shrink-0" onClick={onOpenList}>
        <List className="mr-1.5 h-3.5 w-3.5" />
        Danh sách
      </Button>
    </div>
  );
}
