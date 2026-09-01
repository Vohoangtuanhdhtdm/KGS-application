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

export const reportsApi = {
  income: (p: { from?: string; to?: string; assetId?: string }) =>
    api<IncomeReport>(`/reports/income${toQuery(p)}`),
  profit: (p: { assetId: string; from?: string; to?: string }) =>
    api<ProfitReport>(`/reports/profit${toQuery(p)}`),
  tax: (year: number) => api<TaxReport>(`/reports/tax${toQuery({ year })}`),
};
