import { ASSET_TYPE, type AssetTypeCode } from "@/constants/enums";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DIRECTION_OPTIONS,
  FURNITURE_OPTIONS,
  HAS_TITLE,
  LEGAL_OPTIONS,
  typeOrder,
  visibleFields,
  type PropertyFilterState,
} from "@/lib/propertyFilters";

const toggle = <T,>(list: T[], v: T) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
const num = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) || n < 0 ? null : n;
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function MinRow({
  label,
  value,
  options,
  suffix,
  onChange,
}: {
  label: string;
  value: number | null;
  options: number[];
  suffix: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        <Chip active={value == null} onClick={() => onChange(null)}>
          Tất cả
        </Chip>
        {options.map((n) => (
          <Chip key={n} active={value === n} onClick={() => onChange(n)}>
            {n}
            {suffix}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/**
 * Bộ lọc đặc điểm bất động sản — cho MỌI loại hình, cả mua lẫn thuê.
 *
 * Trước đây bộ lọc chỉ có giá, phòng ngủ và các điều kiện thuê phòng; người mua đất nền hay
 * thuê văn phòng không diễn đạt được nhu cầu của mình. Các trường hiện ra theo ngữ cảnh: chọn
 * "Đất" thì không hỏi phòng tắm, chọn "Cho thuê" thì không hỏi sổ hồng.
 */
export function PropertyFiltersPanel({
  value: s,
  onChange,
  mode,
}: {
  value: PropertyFilterState;
  onChange: (next: PropertyFilterState) => void;
  mode: 1 | 2;
}) {
  const show = visibleFields(s, mode);
  const hasTitle =
    HAS_TITLE.every((x) => s.legal.includes(x)) && s.legal.length === HAS_TITLE.length;

  return (
    <div className="space-y-3.5">
      <div className="space-y-1.5">
        <Label className="text-xs">Loại hình</Label>
        <div className="flex flex-wrap gap-1.5">
          {typeOrder(mode).map((t) => (
            <Chip
              key={t}
              active={s.types.includes(t)}
              onClick={() => onChange({ ...s, types: toggle(s.types, t) as AssetTypeCode[] })}
            >
              {ASSET_TYPE[t]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Diện tích (m²)</Label>
        <div className="flex items-center gap-2">
          <Input
            inputMode="decimal"
            placeholder="Từ"
            aria-label="Diện tích từ (m²)"
            className="h-8"
            value={s.areaMin ?? ""}
            onChange={(e) => onChange({ ...s, areaMin: num(e.target.value) })}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            inputMode="decimal"
            placeholder="Đến"
            aria-label="Diện tích đến (m²)"
            className="h-8"
            value={s.areaMax ?? ""}
            onChange={(e) => onChange({ ...s, areaMax: num(e.target.value) })}
          />
        </div>
      </div>

      {show.rooms && (
        <MinRow
          label="Phòng tắm tối thiểu"
          value={s.bathroomsMin}
          options={[1, 2, 3]}
          suffix="+"
          onChange={(v) => onChange({ ...s, bathroomsMin: v })}
        />
      )}
      {show.floors && (
        <MinRow
          label="Số tầng tối thiểu"
          value={s.floorsMin}
          options={[1, 2, 3, 4, 5]}
          suffix="+"
          onChange={(v) => onChange({ ...s, floorsMin: v })}
        />
      )}
      {show.frontage && (
        <MinRow
          label="Mặt tiền tối thiểu"
          value={s.frontageMin}
          options={[3, 4, 5, 8, 10]}
          suffix=" m"
          onChange={(v) => onChange({ ...s, frontageMin: v })}
        />
      )}

      {show.direction && (
        <div className="space-y-1.5">
          <Label className="text-xs">Hướng</Label>
          <div className="flex flex-wrap gap-1.5">
            {DIRECTION_OPTIONS.map((d) => (
              <Chip
                key={d}
                active={s.directions.includes(d)}
                onClick={() => onChange({ ...s, directions: toggle(s.directions, d) })}
              >
                {d}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {show.legal && (
        <div className="space-y-1.5">
          <Label className="text-xs">Pháp lý</Label>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={hasTitle}
              onClick={() => onChange({ ...s, legal: hasTitle ? [] : [...HAS_TITLE] })}
            >
              Có sổ
            </Chip>
            {LEGAL_OPTIONS.map((l) => (
              <Chip
                key={l}
                active={!hasTitle && s.legal.includes(l)}
                onClick={() => onChange({ ...s, legal: toggle(hasTitle ? [] : s.legal, l) })}
              >
                {l}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {show.furniture && (
        <div className="space-y-1.5">
          <Label className="text-xs">Nội thất</Label>
          <div className="flex flex-wrap gap-1.5">
            {FURNITURE_OPTIONS.map((f) => (
              <Chip
                key={f}
                active={s.furniture.includes(f)}
                onClick={() => onChange({ ...s, furniture: toggle(s.furniture, f) })}
              >
                {f}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
