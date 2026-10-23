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
  /** 1 = khớp hoàn toàn · 2 = gần khớp theo giá (tin vượt ngân sách không quá 10%). */
  matchKind: 1 | 2;
  overBudgetPercent: number | null;
  occupants: number | null;
  availableBy: string | null;
  petsAllowed: boolean | null;
  /** Ưu đãi đã kèm lời mời (nếu đã mời). */
  offerPrice: number | null;
  offerNote: string | null;
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
  /** Giá cho riêng người này — `price` ở trên là giá niêm yết. */
  offerPrice: number | null;
  offerNote: string | null;
}

/** Khoá truy vấn lời mời của người tìm — dùng chung cho danh sách và huy hiệu trên menu. */
export const INVITATIONS_KEY = ["my-invitations"];

/** Lời mời còn chờ người tìm trả lời (chưa hết hạn). */
export const pendingInvitations = (list: SeekerInvitation[] | undefined) =>
  (list ?? []).filter((i) => i.status === 1 && !i.expired).length;

export const matchmakingApi = {
  demandCounts: () => api<ListingDemandCount[]>("/matchmaking/my-listings/demand-counts"),

  demands: (listingId: string) =>
    api<AnonymousDemand[]>(`/matchmaking/listings/${listingId}/demands`),

  invite: (
    listingId: string,
    demandId: string,
    message: string | null,
    offerPrice: number | null = null,
    offerNote: string | null = null,
  ) =>
    api<AnonymousDemand>(`/matchmaking/listings/${listingId}/invitations`, {
      method: "POST",
      body: { demandId, message, offerPrice, offerNote },
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
