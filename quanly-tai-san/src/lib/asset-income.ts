import { cashflowsApi, type CashFlowDto } from "@/lib/api/cashflows";

/** Số tháng của cửa sổ thống kê thu nhập (sparkline + trung bình tháng). */
export const INCOME_MONTHS = 6;
/** Có thu trong bao nhiêu ngày gần nhất thì coi là "còn hoạt động". */
const RECENT_INCOME_DAYS = 60;
/** Trần số trang cursor phải kéo, phòng danh mục có rất nhiều bản ghi. */
const MAX_PAGES = 10;

export interface AssetIncomeSummary {
  /** INCOME_MONTHS phần tử, cũ → mới. */
  monthly: number[];
  /** Trung bình tháng trong cửa sổ; null khi chưa có đồng thu nào. */
  averageMonthlyIncome: number | null;
  lastIncomeAt: string | null;
  /** Có thu nhập trong RECENT_INCOME_DAYS ngày gần nhất — điều kiện để marker "thở". */
  hasRecentIncome: boolean;
}

export type PortfolioIncome = Record<string, AssetIncomeSummary>;

/**
 * Thu nhập theo tháng của TỪNG tài sản trong danh mục.
 *
 * Cố tình gọi `/cashflows` (không kèm assetId) rồi gom theo assetId ở client, thay vì gọi
 * `/reports/income?assetId=` cho từng tài sản — cách sau sẽ thành N+1 chồng lên N+1 vốn đã
 * có ở `assetsApi.mapPins()`. Ở đây chỉ tốn 1–2 request cho cả danh mục.
 */
export async function fetchPortfolioIncome(): Promise<PortfolioIncome> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (INCOME_MONTHS - 1), 1);

  const rows: CashFlowDto[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await cashflowsApi.list(
      { from: from.toISOString(), to: now.toISOString(), direction: 1, pageSize: 100 },
      cursor,
    );
    rows.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }

  // Chỉ số cột cho từng tháng trong cửa sổ: 0 = tháng cũ nhất … n-1 = tháng hiện tại
  const bucketOf = (iso: string): number => {
    const d = new Date(iso);
    return (d.getFullYear() - from.getFullYear()) * 12 + (d.getMonth() - from.getMonth());
  };

  const recentCutoff = now.getTime() - RECENT_INCOME_DAYS * 864e5;
  const out: PortfolioIncome = {};

  for (const r of rows) {
    const idx = bucketOf(r.occurredAt);
    if (idx < 0 || idx >= INCOME_MONTHS) continue;

    const cur =
      out[r.assetId] ??
      (out[r.assetId] = {
        monthly: Array<number>(INCOME_MONTHS).fill(0),
        averageMonthlyIncome: null,
        lastIncomeAt: null,
        hasRecentIncome: false,
      });

    cur.monthly[idx] += r.amount;
    if (cur.lastIncomeAt == null || r.occurredAt > cur.lastIncomeAt)
      cur.lastIncomeAt = r.occurredAt;
  }

  for (const s of Object.values(out)) {
    const total = s.monthly.reduce((a, b) => a + b, 0);
    s.averageMonthlyIncome = total > 0 ? total / INCOME_MONTHS : null;
    s.hasRecentIncome =
      s.lastIncomeAt != null && new Date(s.lastIncomeAt).getTime() >= recentCutoff;
  }

  return out;
}
