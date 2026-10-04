import {
  AirVent,
  ArrowUpDown,
  Bath,
  Car,
  ChefHat,
  Check,
  Fan,
  Flame,
  type LucideIcon,
  Refrigerator,
  ShieldCheck,
  Sofa,
  Warehouse,
  WashingMachine,
  Wifi,
} from "lucide-react";
import { AMENITIES, type AmenityKey } from "@/constants/enums";

const ICONS: Record<AmenityKey, LucideIcon> = {
  air_conditioner: AirVent,
  water_heater: Flame,
  private_bathroom: Bath,
  private_kitchen: ChefHat,
  loft: Warehouse,
  balcony: Fan,
  window: Fan,
  wifi: Wifi,
  parking: Car,
  elevator: ArrowUpDown,
  security: ShieldCheck,
  furnished: Sofa,
  washing_machine: WashingMachine,
  fridge: Refrigerator,
};

/** Tiện nghi dạng lưới có biểu tượng — liếc là thấy, thay cho một dải chip chữ nhỏ. */
export function AmenityGrid({ amenities }: { amenities: string[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
      {amenities.map((a) => {
        const Icon = ICONS[a as AmenityKey] ?? Check;
        return (
          <li key={a} className="flex items-center gap-2.5 text-sm">
            <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {AMENITIES[a as AmenityKey] ?? a}
          </li>
        );
      })}
    </ul>
  );
}
