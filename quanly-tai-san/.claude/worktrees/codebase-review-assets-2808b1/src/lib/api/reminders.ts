import { api, toQuery } from "./http";
import type { PagedResult } from "./assets";
import type { RecurrenceCycleCode, ReminderTypeCode } from "@/constants/enums";

export interface ReminderDto {
  id: string;
  assetId: string | null;
  assetName: string | null;
  leaseContractId: string | null;
  type: ReminderTypeCode;
  title: string;
  dueDate: string;
  cycle: RecurrenceCycleCode;
  notifyDaysBefore: number;
  isActive: boolean;
  lastNotifiedAt: string | null;
}

export interface ReminderCreateInput {
  assetId?: string | null;
  leaseContractId?: string | null;
  type: ReminderTypeCode;
  title: string;
  dueDate: string;
  cycle: RecurrenceCycleCode;
  notifyDaysBefore: number;
}

export interface ReminderUpdateInput {
  title: string;
  dueDate: string;
  cycle: RecurrenceCycleCode;
  notifyDaysBefore: number;
  isActive: boolean;
}

export interface ReminderFilters {
  isActive?: boolean | "";
  page?: number;
  pageSize?: number;
}

export const remindersApi = {
  list: (f: ReminderFilters = {}) =>
    api<PagedResult<ReminderDto>>(
      `/reminders${toQuery({ ...f, page: f.page ?? 1, pageSize: f.pageSize ?? 20 })}`,
    ),
  upcoming: (days = 7) => api<ReminderDto[]>(`/reminders/upcoming${toQuery({ days })}`),
  create: (body: ReminderCreateInput) => api<ReminderDto>("/reminders", { method: "POST", body }),
  update: (id: string, body: ReminderUpdateInput) =>
    api<ReminderDto>(`/reminders/${id}`, { method: "PUT", body }),
  remove: (id: string) => api<void>(`/reminders/${id}`, { method: "DELETE" }),
};
