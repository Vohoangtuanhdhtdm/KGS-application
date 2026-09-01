export type AssetType = "Nhà riêng" | "Căn hộ" | "Đất" | "Biệt thự" | "Nhà mặt phố" | "Văn phòng" | "Khác";
export type OwnershipType = "Sở hữu" | "Đi thuê";
export type AssetStatus = "Đang sử dụng" | "Đang cho thuê" | "Đang rao bán" | "Trống" | "Đã bán" | "Hết hợp đồng thuê";

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  ownershipType: OwnershipType;
  status: AssetStatus;
  city: string;
  district: string;
  ward: string;
  addressDetail: string;
  lat: number;
  lng: number;
  area: number;
  currentValue: number;
  acquisitionDate: string;
  thumbnail: string;
  floors?: number;
  bedrooms?: number;
  hasUnits?: boolean;
}

export type UnitStatus = "Trống" | "Đang cho thuê" | "Đang sửa chữa";
export interface AssetUnit {
  id: string;
  assetId: string;
  name: string;
  floor: number;
  area: number;
  status: UnitStatus;
}

export type ContractDirection = "Cho thuê" | "Đi thuê";
export type PaymentCycle = "Hàng tháng" | "Quý" | "Nửa năm" | "Năm";
export type ContractStatus = "Nháp" | "Đang hiệu lực" | "Hết hạn" | "Đã chấm dứt" | "Đã gia hạn";
export type TaxResponsibility = "Chủ nhà" | "Người thuê";

export interface LeaseContract {
  id: string;
  code: string;
  assetId: string;
  unitId?: string;
  direction: ContractDirection;
  counterpartyId: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  paymentCycle: PaymentCycle;
  paymentDueDay: number;
  depositAmount: number;
  nextRentIncreaseDate?: string;
  taxResponsibility: TaxResponsibility;
  status: ContractStatus;
  parentContractId?: string;
  notes?: string;
}

export type ContactType = "Người thuê" | "Chủ nhà" | "Môi giới" | "Nhà thầu";
export interface ContactParty {
  id: string;
  type: ContactType;
  name: string;
  phone: string;
  email?: string;
  idNumber?: string;
  notes?: string;
}

export type CashflowDirection = "Thu" | "Chi";
export type CashflowCategory =
  | "Tiền thuê thu vào" | "Tiền cọc nhận" | "Tiền bán"
  | "Tiền thuê trả chủ nhà" | "Tiền cọc trả"
  | "Chi phí sửa chữa" | "Hoá đơn điện" | "Hoá đơn nước" | "Hoá đơn internet"
  | "Phí quản lý" | "Thuế trước bạ" | "Thuế phi nông nghiệp"
  | "Thuế môn bài" | "Thuế TNCN" | "Thuế GTGT" | "Thuế khác";

export interface CashFlowEntry {
  id: string;
  assetId: string;
  direction: CashflowDirection;
  category: CashflowCategory;
  amount: number;
  occurredAt: string;
  periodFrom?: string;
  periodTo?: string;
  description?: string;
  linkedMaintenanceId?: string;
}

export type ReminderType = "Thu tiền thuê" | "Đóng tiền thuê" | "Bảo dưỡng" | "Hết hạn hợp đồng" | "Đóng thuế" | "Thanh toán hoá đơn";
export type ReminderCycle = "Không lặp" | "Tháng" | "Quý" | "Nửa năm" | "Năm";
export interface Reminder {
  id: string;
  title: string;
  type: ReminderType;
  assetId?: string;
  contractId?: string;
  dueDate: string;
  cycle: ReminderCycle;
  daysBefore: number;
  enabled: boolean;
}

export type DocumentType = "Sổ đỏ/sổ hồng" | "HĐ mua bán" | "HĐ thuê" | "Phụ lục HĐ" | "HĐ uỷ quyền" | "HĐ điện" | "HĐ nước" | "Hồ sơ thuế" | "Hoá đơn" | "Khác";
export interface AssetDocument {
  id: string;
  assetId: string;
  type: DocumentType;
  name: string;
  issuedDate?: string;
  expiryDate?: string;
  fileName?: string;
}

export interface AssetMedia {
  id: string;
  assetId: string;
  url: string;
  caption?: string;
  takenAt: string;
}

export type EquipmentCondition = "Mới" | "Tốt" | "Khá" | "Cần sửa" | "Hỏng";
export type EquipmentSource = "Của chủ nhà cung cấp" | "Nhận từ chủ nhà" | "Tự trang bị";
export interface Equipment {
  id: string;
  assetId: string;
  name: string;
  quantity: number;
  condition: EquipmentCondition;
  source: EquipmentSource;
}

export interface MaintenanceRecord {
  id: string;
  assetId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  cost: number;
  contractorId?: string;
}

export interface SaleListing {
  id: string;
  assetId: string;
  price: number;
  status: "Đang rao" | "Tạm dừng" | "Đã bán" | "Đã huỷ";
  listedDate: string;
  sentToBrokers: { brokerId: string; sentAt: string }[];
}
