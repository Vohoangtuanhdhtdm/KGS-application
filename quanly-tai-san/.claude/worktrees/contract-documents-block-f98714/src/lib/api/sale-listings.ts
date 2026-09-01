import { api } from "./http";
import type { SaleListingBroker } from "./assets";
import type { SaleListingStatusCode } from "@/constants/enums";

// Trang tổng hợp /rao-ban — endpoint top-level, KHÁC route nested /assets/{id}/sale-listing
export interface MySaleListingDto {
  id: string;
  assetId: string;
  assetName: string;
  assetCity: string;
  assetDistrict: string;
  assetThumbnailUrl: string | null;
  askingPrice: number;
  status: SaleListingStatusCode;
  listedAt: string;
  agreementNotes: string | null;
  brokers: SaleListingBroker[];
}

export const saleListingsApi = {
  mine: () => api<MySaleListingDto[]>("/sale-listings"),
};
