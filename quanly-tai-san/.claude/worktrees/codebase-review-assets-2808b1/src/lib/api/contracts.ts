import { api, toQuery } from "./http";
import type { PagedResult } from "./assets";
import type {
  ContractDirectionCode,
  ContractStatusCode,
  PaymentCycleCode,
  TaxResponsibilityCode,
} from "@/constants/enums";

export interface LeaseContractDto {
  id: string;
  assetId: string;
  assetName: string;
  assetUnitId: string | null;
  assetUnitName: string | null;
  direction: ContractDirectionCode;
  status: ContractStatusCode;
  counterpartyId: string;
  counterpartyName: string;
  counterpartyPhone: string | null;
  startDate: string;
  endDate: string;
  rentAmount: number;
  paymentCycle: PaymentCycleCode;
  paymentDueDay: number;
  depositAmount: number | null;
  nextRentIncreaseDate: string | null;
  taxResponsibility: TaxResponsibilityCode;
  parentContractId: string | null;
  notes: string | null;
}

export interface CreateContractInput {
  assetId: string;
  assetUnitId: string | null;
  direction: ContractDirectionCode;
  counterpartyId: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  paymentCycle: PaymentCycleCode;
  paymentDueDay: number;
  depositAmount?: number | null;
  nextRentIncreaseDate?: string | null;
  taxResponsibility: TaxResponsibilityCode;
  notes?: string | null;
  activateImmediately: boolean;
}

export interface RenewContractInput {
  newStartDate: string;
  newEndDate: string;
  newRentAmount: number;
  nextRentIncreaseDate?: string | null;
  notes?: string | null;
}

export interface TerminateContractInput {
  terminatedAt: string;
  reason: string;
}

export interface ContractFilters {
  assetId?: string;
  assetUnitId?: string;
  direction?: ContractDirectionCode | "";
  status?: ContractStatusCode | "";
  page?: number;
  pageSize?: number;
}

export interface ExpiringContract {
  id: string;
  assetId: string;
  assetName: string;
  assetUnitName: string | null;
  direction: ContractDirectionCode;
  counterpartyName: string;
  endDate: string;
  daysLeft: number;
}

export const contractsApi = {
  list: (f: ContractFilters = {}) =>
    api<PagedResult<LeaseContractDto>>(
      `/contracts${toQuery({ ...f, page: f.page ?? 1, pageSize: f.pageSize ?? 20 })}`,
    ),
  detail: (id: string) => api<LeaseContractDto>(`/contracts/${id}`),
  create: (body: CreateContractInput) =>
    api<LeaseContractDto>("/contracts", { method: "POST", body }),
  renew: (id: string, body: RenewContractInput) =>
    api<LeaseContractDto>(`/contracts/${id}/renew`, { method: "POST", body }),
  terminate: (id: string, body: TerminateContractInput) =>
    api<LeaseContractDto>(`/contracts/${id}/terminate`, { method: "POST", body }),
  expiring: (days = 30) =>
    api<ExpiringContract[]>(`/contracts/expiring${toQuery({ days })}`),
};

export function toIsoUtc(dateStr: string): string {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
}