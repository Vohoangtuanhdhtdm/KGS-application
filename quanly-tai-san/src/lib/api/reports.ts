import { api, toQuery } from "./http";
import type { CashFlowCategoryCode } from "@/constants/enums";

export interface IncomeByMonth {
  year: number;
  month: number;
  amount: number;
}

export interface IncomeReport {
  from: string;
  to: string;
  totalIncome: number;
  byMonth: IncomeByMonth[];
}

export interface CategoryAmount {
  category: CashFlowCategoryCode;
  amount: number;
}

export interface ProfitReport {
  assetId: string;
  assetName: string;
  from: string;
  to: string;
  totalIncome: number;
  totalExpense: number;
  profit: number;
  incomeBreakdown: CategoryAmount[];
  expenseBreakdown: CategoryAmount[];
}

export interface TaxReport {
  year: number;
  totalTax: number;
  byTaxType: CategoryAmount[];
}

export interface VacantUnitDto {
  assetId: string;
  assetName: string;
  unitId: string | null;
  unitName: string;
  area: number | null;
  /** Trống từ khi nào — hết hợp đồng cho thuê gần nhất. null = chưa từng cho thuê. */
  vacantSince: string | null;
  hasLiveListing: boolean;
}

export interface OperationsDashboard {
  periodFrom: string;
  periodTo: string;
  rentIncome: number;
  /** Tiền thuê đã trả chủ nhà — khoản mà Excel không tự trừ. */
  rentExpense: number;
  otherExpense: number;
  profit: number;
  /** Cọc đang giữ, phải trả lại — KHÔNG nằm trong profit. */
  depositHeld: number;
  unitsTotal: number;
  unitsOccupied: number;
  unitsVacant: number;
  unitsMaintenance: number;
  vacantUnits: VacantUnitDto[];
}

export const reportsApi = {
  dashboard: (p: { year?: number; month?: number } = {}) =>
    api<OperationsDashboard>(`/reports/dashboard${toQuery(p)}`),
  income: (p: { from?: string; to?: string; assetId?: string }) =>
    api<IncomeReport>(`/reports/income${toQuery(p)}`),
  profit: (p: { assetId: string; from?: string; to?: string }) =>
    api<ProfitReport>(`/reports/profit${toQuery(p)}`),
  tax: (year: number) => api<TaxReport>(`/reports/tax${toQuery({ year })}`),
};
