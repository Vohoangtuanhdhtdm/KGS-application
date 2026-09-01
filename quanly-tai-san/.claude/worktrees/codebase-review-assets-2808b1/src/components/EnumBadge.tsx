import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ASSET_STATUS,
  ASSET_STATUS_CLASS,
  UNIT_STATUS,
  UNIT_STATUS_CLASS,
  CONTRACT_STATUS,
  CONTRACT_STATUS_CLASS,
  CONTACT_TYPE,
  CONTACT_TYPE_CLASS,
  type AssetStatusCode,
  type UnitStatusCode,
  type ContractStatusCode,
  type ContactTypeCode,
} from "@/constants/enums";

export function AssetStatusBadgeCode({ code }: { code: AssetStatusCode }) {
  return <Badge variant="outline" className={cn("font-medium", ASSET_STATUS_CLASS[code])}>{ASSET_STATUS[code]}</Badge>;
}
export function UnitStatusBadgeCode({ code }: { code: UnitStatusCode }) {
  return <Badge variant="outline" className={cn("font-medium", UNIT_STATUS_CLASS[code])}>{UNIT_STATUS[code]}</Badge>;
}
export function ContractStatusBadgeCode({ code }: { code: ContractStatusCode }) {
  return <Badge variant="outline" className={cn("font-medium", CONTRACT_STATUS_CLASS[code])}>{CONTRACT_STATUS[code]}</Badge>;
}
export function ContactTypeBadgeCode({ code }: { code: ContactTypeCode }) {
  return <Badge variant="outline" className={cn("font-medium", CONTACT_TYPE_CLASS[code])}>{CONTACT_TYPE[code]}</Badge>;
}
