import { api, toQuery } from "./http";
import type { ContactTypeCode } from "@/constants/enums";
import type { PagedResult } from "./assets";

export interface ContactParty {
  id: string;
  type: ContactTypeCode;
  fullName: string;
  phone: string | null;
  email: string | null;
  idNumber: string | null;
  notes: string | null;
}

export interface ContactInput {
  type: ContactTypeCode;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  idNumber?: string | null;
  notes?: string | null;
}

export interface ContactFilters {
  type?: ContactTypeCode | "";
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export const contactsApi = {
  list: (f: ContactFilters = {}) =>
    api<PagedResult<ContactParty>>(`/contacts${toQuery({ ...f, page: f.page ?? 1, pageSize: f.pageSize ?? 50 })}`),
  create: (body: ContactInput) => api<ContactParty>("/contacts", { method: "POST", body }),
  update: (id: string, body: ContactInput) =>
    api<ContactParty>(`/contacts/${id}`, { method: "PUT", body }),
  remove: (id: string) => api<void>(`/contacts/${id}`, { method: "DELETE" }),
};
