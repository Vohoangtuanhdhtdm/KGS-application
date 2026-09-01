import { createContext, useContext, useState, type ReactNode } from "react";
import {
  seedAssets, seedUnits, seedContracts, seedContacts, seedCashflow,
  seedReminders, seedDocuments, seedMedia, seedEquipment, seedMaintenance, seedSaleListings,
} from "./mock-data";
import type {
  Asset, AssetUnit, LeaseContract, ContactParty, CashFlowEntry, Reminder,
  AssetDocument, AssetMedia, Equipment, MaintenanceRecord, SaleListing,
} from "./types";

interface Store {
  assets: Asset[];
  units: AssetUnit[];
  contracts: LeaseContract[];
  contacts: ContactParty[];
  cashflow: CashFlowEntry[];
  reminders: Reminder[];
  documents: AssetDocument[];
  media: AssetMedia[];
  equipment: Equipment[];
  maintenance: MaintenanceRecord[];
  saleListings: SaleListing[];

  addAsset: (a: Asset) => void;
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;

  addContract: (c: LeaseContract, autoReminders?: boolean) => void;
  updateContract: (id: string, patch: Partial<LeaseContract>) => void;
  renewContract: (oldId: string, newContract: LeaseContract) => void;
  terminateContract: (id: string, terminationDate: string, reason: string) => void;

  addContact: (c: ContactParty) => void;
  updateContact: (id: string, patch: Partial<ContactParty>) => void;
  deleteContact: (id: string) => void;

  addCashflow: (e: CashFlowEntry) => void;
  deleteCashflow: (id: string) => void;

  addReminder: (r: Reminder) => void;
  updateReminder: (id: string, patch: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;

  addMaintenance: (m: MaintenanceRecord) => void;
  addEquipment: (e: Equipment) => void;
  addDocument: (d: AssetDocument) => void;
}

const StoreCtx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>(seedAssets);
  const [units, setUnits] = useState<AssetUnit[]>(seedUnits);
  const [contracts, setContracts] = useState<LeaseContract[]>(seedContracts);
  const [contacts, setContacts] = useState<ContactParty[]>(seedContacts);
  const [cashflow, setCashflow] = useState<CashFlowEntry[]>(seedCashflow);
  const [reminders, setReminders] = useState<Reminder[]>(seedReminders);
  const [documents, setDocuments] = useState<AssetDocument[]>(seedDocuments);
  const [media] = useState<AssetMedia[]>(seedMedia);
  const [equipment, setEquipment] = useState<Equipment[]>(seedEquipment);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>(seedMaintenance);
  const [saleListings, setSaleListings] = useState<SaleListing[]>(seedSaleListings);

  const value: Store = {
    assets, units, contracts, contacts, cashflow, reminders,
    documents, media, equipment, maintenance, saleListings,

    addAsset: (a) => setAssets((prev) => [a, ...prev]),
    updateAsset: (id, patch) => setAssets((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a)),
    deleteAsset: (id) => setAssets((prev) => prev.filter((a) => a.id !== id)),

    addContract: (c, autoReminders = true) => {
      setContracts((prev) => [c, ...prev]);
      // Auto-update asset status
      setAssets((prev) => prev.map((a) => {
        if (a.id !== c.assetId) return a;
        if (c.direction === "Cho thuê" && !c.unitId) return { ...a, status: "Đang cho thuê" };
        return a;
      }));
      // Auto-update unit status
      if (c.unitId && c.direction === "Cho thuê") {
        setUnits((prev) => prev.map((u) => u.id === c.unitId ? { ...u, status: "Đang cho thuê" } : u));
      }
      if (autoReminders) {
        const rentTitle = c.direction === "Cho thuê"
          ? `Thu tiền thuê HĐ ${c.code}`
          : `Đóng tiền thuê HĐ ${c.code}`;
        const nextDue = new Date(c.startDate);
        nextDue.setDate(c.paymentDueDay);
        if (nextDue < new Date()) nextDue.setMonth(nextDue.getMonth() + 1);
        setReminders((prev) => [
          {
            id: `r-${c.id}-rent`, title: rentTitle,
            type: c.direction === "Cho thuê" ? "Thu tiền thuê" : "Đóng tiền thuê",
            assetId: c.assetId, contractId: c.id,
            dueDate: nextDue.toISOString(),
            cycle: c.paymentCycle === "Hàng tháng" ? "Tháng" : c.paymentCycle,
            daysBefore: 3, enabled: true,
          },
          {
            id: `r-${c.id}-end`, title: `Hợp đồng ${c.code} sắp hết hạn`,
            type: "Hết hạn hợp đồng", assetId: c.assetId, contractId: c.id,
            dueDate: c.endDate, cycle: "Không lặp", daysBefore: 30, enabled: true,
          },
          ...prev,
        ]);
      }
    },
    updateContract: (id, patch) => setContracts((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c)),
    renewContract: (oldId, nc) => {
      setContracts((prev) => [nc, ...prev.map((c) => c.id === oldId ? { ...c, status: "Đã gia hạn" as const } : c)]);
    },
    terminateContract: (id, terminationDate, reason) => {
      setContracts((prev) => prev.map((c) => c.id === id ? { ...c, status: "Đã chấm dứt" as const, endDate: terminationDate, notes: `[Chấm dứt] ${reason}${c.notes ? " — " + c.notes : ""}` } : c));
    },

    addContact: (c) => setContacts((prev) => [c, ...prev]),
    updateContact: (id, patch) => setContacts((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c)),
    deleteContact: (id) => setContacts((prev) => prev.filter((c) => c.id !== id)),

    addCashflow: (e) => setCashflow((prev) => [e, ...prev]),
    deleteCashflow: (id) => setCashflow((prev) => prev.filter((e) => e.id !== id)),

    addReminder: (r) => setReminders((prev) => [r, ...prev]),
    updateReminder: (id, patch) => setReminders((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r)),
    deleteReminder: (id) => setReminders((prev) => prev.filter((r) => r.id !== id)),

    addMaintenance: (m) => {
      setMaintenance((prev) => [m, ...prev]);
      if (m.cost > 0) {
        setCashflow((prev) => [{
          id: `cf-${m.id}`, assetId: m.assetId, direction: "Chi",
          category: "Chi phí sửa chữa", amount: m.cost, occurredAt: m.startDate,
          description: `Sửa chữa: ${m.title}`, linkedMaintenanceId: m.id,
        }, ...prev]);
      }
    },
    addEquipment: (e) => setEquipment((prev) => [e, ...prev]),
    addDocument: (d) => setDocuments((prev) => [d, ...prev]),
  };
  void setUnits; void setSaleListings;
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreCtx);
  if (!s) throw new Error("useStore phải dùng trong <StoreProvider>");
  return s;
}
