import { api, apiForm, toQuery } from "./http";
import type { AssetMediaFile } from "./assets";
import type { CashFlowCategoryCode, CashFlowDirectionCode } from "@/constants/enums";

export interface CashFlowDto {
  id: string;
  assetId: string;
  assetName: string;
  assetUnitId: string | null;
  leaseContractId: string | null;
  direction: CashFlowDirectionCode;
  category: CashFlowCategoryCode;
  amount: number;
  occurredAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  description: string | null;
  receipt: AssetMediaFile | null;
}

// Keyset pagination — không có totalCount/totalPages, chỉ có con trỏ trang kế
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CashFlowFilters {
  assetId?: string;
  direction?: CashFlowDirectionCode | "";
  category?: CashFlowCategoryCode | "";
  from?: string;
  to?: string;
  pageSize?: number;
}

export interface CreateCashFlowInput {
  assetId: string;
  assetUnitId?: string | null;
  leaseContractId?: string | null;
  direction: CashFlowDirectionCode;
  category: CashFlowCategoryCode;
  amount: number;
  occurredAt: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  description?: string | null;
  receipt?: File | null;
}

export const cashflowsApi = {
  list: (f: CashFlowFilters = {}, cursor?: string) =>
    api<CursorPage<CashFlowDto>>(
      `/cashflows${toQuery({ ...f, cursor, pageSize: f.pageSize ?? 30 })}`,
    ),
  create: (input: CreateCashFlowInput) => {
    const fd = new FormData();
    fd.append("AssetId", input.assetId);
    if (input.assetUnitId) fd.append("AssetUnitId", input.assetUnitId);
    if (input.leaseContractId) fd.append("LeaseContractId", input.leaseContractId);
    fd.append("Direction", String(input.direction));
    fd.append("Category", String(input.category));
    fd.append("Amount", String(input.amount));
    fd.append("OccurredAt", input.occurredAt);
    if (input.periodStart) fd.append("PeriodStart", input.periodStart);
    if (input.periodEnd) fd.append("PeriodEnd", input.periodEnd);
    if (input.description) fd.append("Description", input.description);
    if (input.receipt) fd.append("Receipt", input.receipt);
    return apiForm<CashFlowDto>("/cashflows", fd, "POST");
  },
  remove: (id: string) => api<void>(`/cashflows/${id}`, { method: "DELETE" }),
};
