import { api } from "./http";
import type { ListingTypeCode, PaymentCycleCode } from "@/constants/enums";
import type { SavedSearchCriteria } from "./savedSearches";

/**
 * Ghép đôi hai chiều: chủ tin thấy nhu cầu ẩn danh khớp tin của mình và mời xem nhà;
 * người tìm nhận lời (thành yêu cầu xem nhà bình thường) hoặc từ chối.
 */

/** 1 = đang chờ · 2 = đã nhận lời · 3 = đã từ chối. Hết hạn là cờ riêng (`expired`). */
export type InvitationStatusCode = 1 | 2 | 3;

export interface ListingDemandCount {
  listingId: string;
  count: number;
}

export interface AnonymousDemand {
  demandId: string;
  alias: string;
  /** Tiêu chí của người tìm — đã bỏ toạ độ điểm ghim. */
  criteria: SavedSearchCriteria;
  /** Cận trên dải khoảng cách (1000/2000/5000/10000 m) từ điểm người tìm ghim tới tin này.
   *  Cố tình thô để chủ tin không đo tam giác ra được vị trí người tìm. */
  centerDistanceMeters: number | null;
  note: string | null;
  activeSince: string;
  invitationStatus: InvitationStatusCode | null;
  invitedAt: string | null;
  invitationExpired: boolean;
}

export interface SeekerInvitation {
  id: string;
  listingId: string;
  listingSlug: string;
  listingTitle: string;
  thumbnailUrl: string | null;
  price: number;
  type: ListingTypeCode;
  rentPaymentCycle: PaymentCycleCode | null;
  city: string;
  district: string;
  ownerName: string;
  message: string | null;
  demandName: string | null;
  status: InvitationStatusCode;
  expired: boolean;
  createdAt: string;
  respondedAt: string | null;
}

export const matchmakingApi = {
  demandCounts: () => api<ListingDemandCount[]>("/matchmaking/my-listings/demand-counts"),

  demands: (listingId: string) =>
    api<AnonymousDemand[]>(`/matchmaking/listings/${listingId}/demands`),

  invite: (listingId: string, demandId: string, message: string | null) =>
    api<AnonymousDemand>(`/matchmaking/listings/${listingId}/invitations`, {
      method: "POST",
      body: { demandId, message },
    }),

  myInvitations: () => api<SeekerInvitation[]>("/matchmaking/invitations"),

  respond: (
    id: string,
    accept: boolean,
    message: string | null = null,
    preferredViewingAt: string | null = null,
  ) =>
    api<SeekerInvitation>(`/matchmaking/invitations/${id}/respond`, {
      method: "POST",
      body: { accept, message, preferredViewingAt },
    }),
};
