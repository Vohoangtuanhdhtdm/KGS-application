import { api, toQuery } from "./http";
import type { ListingTypeCode, PaymentCycleCode } from "@/constants/enums";

// ---- Tin đã lưu ----

export interface SavedListingDto {
  listingId: string;
  slug: string;
  title: string;
  type: ListingTypeCode;
  price: number;
  rentPaymentCycle: PaymentCycleCode | null;
  city: string;
  district: string;
  bedrooms: number;
  area: number;
  thumbnailUrl: string | null;
  savedAt: string;
}

// ---- Yêu cầu xem nhà ----

export const INQUIRY_STATUS = {
  1: "Mới",
  2: "Đã liên hệ",
  3: "Đã xem nhà",
  4: "Đã thành khách thuê",
  5: "Đã đóng",
} as const;
export type InquiryStatusCode = keyof typeof INQUIRY_STATUS;

export const INQUIRY_STATUS_CLASS: Record<InquiryStatusCode, string> = {
  1: "bg-primary/10 text-primary border-primary/30",
  2: "bg-info/15 text-info border-info/30",
  3: "bg-warning/20 text-warning-foreground border-warning/40",
  4: "bg-success/15 text-success border-success/30",
  5: "bg-muted text-muted-foreground border-border",
};

export interface CreateInquiryInput {
  message?: string | null;
  preferredViewingAt?: string | null;
}

export interface SentInquiryDto {
  id: string;
  listingId: string;
  listingSlug: string;
  listingTitle: string;
  thumbnailUrl: string | null;
  message: string | null;
  preferredViewingAt: string | null;
  status: InquiryStatusCode;
  createdAt: string;
}

export interface ReceivedInquiryDto {
  id: string;
  listingId: string;
  listingSlug: string;
  listingTitle: string;
  fromUserName: string;
  fromUserPhone: string | null;
  fromUserEmail: string | null;
  message: string | null;
  preferredViewingAt: string | null;
  status: InquiryStatusCode;
  convertedContactPartyId: string | null;
  createdAt: string;
}

export interface ConvertInquiryResultDto {
  inquiryId: string;
  contactPartyId: string;
  contactFullName: string;
}

export const savedListingsApi = {
  list: () => api<SavedListingDto[]>("/saved-listings"),
  save: (listingId: string) => api<void>(`/saved-listings/${listingId}`, { method: "POST" }),
  unsave: (listingId: string) => api<void>(`/saved-listings/${listingId}`, { method: "DELETE" }),
};

export const inquiriesApi = {
  create: (slug: string, body: CreateInquiryInput) =>
    api<SentInquiryDto>(`/listings/${slug}/inquiries`, { method: "POST", body }),
  sent: () => api<SentInquiryDto[]>("/inquiries/sent"),
  received: (status?: InquiryStatusCode) =>
    api<ReceivedInquiryDto[]>(`/inquiries/received${toQuery({ status })}`),
  updateStatus: (id: string, status: InquiryStatusCode) =>
    api<ReceivedInquiryDto>(`/inquiries/${id}/status`, { method: "PUT", body: { status } }),
  convert: (id: string) =>
    api<ConvertInquiryResultDto>(`/inquiries/${id}/convert`, { method: "POST" }),
};
