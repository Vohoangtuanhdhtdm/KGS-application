import { api } from "./http";

export interface DailyViewPoint {
  /** "yyyy-MM-dd" — backend trả DateOnly. */
  date: string;
  views: number;
}

export interface ListingPerformanceRow {
  listingId: string;
  title: string;
  slug: string | null;
  views30Days: number;
  savedCount: number;
  inquiryCount: number;
  completenessPercent: number;
}

export interface OwnerAnalyticsSummaryDto {
  totalListings: number;
  approvedListings: number;
  totalViews30Days: number;
  totalInquiries: number;
  totalSaved: number;
  dailyViews: DailyViewPoint[];
  listings: ListingPerformanceRow[];
}

export interface ListingAnalyticsDto {
  listingId: string;
  title: string;
  slug: string | null;

  totalViews: number;
  views7Days: number;
  views30Days: number;
  dailyViews: DailyViewPoint[];

  savedCount: number;
  inquiryCount: number;
  inquiryRatePercent: number;

  /** null khi khu vực chưa đủ tin để so sánh có nghĩa. */
  areaMedianPrice: number | null;
  areaListingCount: number;
  /** Dương = đắt hơn mặt bằng khu vực. */
  priceDiffPercent: number | null;

  completenessPercent: number;
  imageCount: number;
  suggestions: string[];
}

export const analyticsApi = {
  summary: () => api<OwnerAnalyticsSummaryDto>("/listing-analytics/summary"),
  forListing: (listingId: string) =>
    api<ListingAnalyticsDto>(`/listing-analytics/${listingId}`),
};
