import type {
  Asset, AssetUnit, LeaseContract, ContactParty, CashFlowEntry,
  Reminder, AssetDocument, AssetMedia, Equipment, MaintenanceRecord, SaleListing,
} from "./types";

const today = new Date();
const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString();
const inDays = (days: number) => {
  const d = new Date(today); d.setDate(d.getDate() + days); return d.toISOString();
};

export const seedAssets: Asset[] = [
  {
    id: "a1", name: "Nhà phố Quận 7", type: "Nhà mặt phố", ownershipType: "Sở hữu",
    status: "Đang cho thuê", city: "TP. Hồ Chí Minh", district: "Quận 7", ward: "Phường Tân Phong",
    addressDetail: "123 Nguyễn Thị Thập", lat: 10.7297, lng: 106.7215,
    area: 120, currentValue: 12500000000, acquisitionDate: iso(2019, 5, 12),
    thumbnail: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800",
    floors: 3, bedrooms: 4,
  },
  {
    id: "a2", name: "Căn hộ Landmark 81", type: "Căn hộ", ownershipType: "Sở hữu",
    status: "Đang sử dụng", city: "TP. Hồ Chí Minh", district: "Quận Bình Thạnh", ward: "Phường 22",
    addressDetail: "720A Điện Biên Phủ, Tháp T3, tầng 55", lat: 10.7947, lng: 106.7218,
    area: 92, currentValue: 8900000000, acquisitionDate: iso(2021, 3, 20),
    thumbnail: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
    bedrooms: 2,
  },
  {
    id: "a3", name: "Chung cư mini Cầu Giấy", type: "Nhà riêng", ownershipType: "Đi thuê",
    status: "Đang cho thuê", city: "Hà Nội", district: "Quận Cầu Giấy", ward: "Phường Dịch Vọng",
    addressDetail: "45/12 Trần Thái Tông", lat: 21.0313, lng: 105.7834,
    area: 180, currentValue: 0, acquisitionDate: iso(2023, 8, 1),
    thumbnail: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800",
    floors: 5, hasUnits: true,
  },
  {
    id: "a4", name: "Đất nền Long An", type: "Đất", ownershipType: "Sở hữu",
    status: "Đang rao bán", city: "Long An", district: "Huyện Đức Hoà", ward: "Xã Hựu Thạnh",
    addressDetail: "Lô A12, KDC Hựu Thạnh", lat: 10.8500, lng: 106.4167,
    area: 250, currentValue: 2800000000, acquisitionDate: iso(2020, 11, 5),
    thumbnail: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800",
  },
  {
    id: "a5", name: "Biệt thự Thảo Điền", type: "Biệt thự", ownershipType: "Sở hữu",
    status: "Trống", city: "TP. Hồ Chí Minh", district: "TP. Thủ Đức", ward: "Phường Thảo Điền",
    addressDetail: "18 Đường số 10", lat: 10.8058, lng: 106.7368,
    area: 320, currentValue: 32000000000, acquisitionDate: iso(2018, 2, 14),
    thumbnail: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",
    floors: 2, bedrooms: 5,
  },
  {
    id: "a6", name: "Văn phòng Nguyễn Trãi", type: "Văn phòng", ownershipType: "Đi thuê",
    status: "Đang cho thuê", city: "TP. Hồ Chí Minh", district: "Quận 1", ward: "Phường Bến Thành",
    addressDetail: "Tầng 8, 234 Nguyễn Trãi", lat: 10.7669, lng: 106.6822,
    area: 200, currentValue: 0, acquisitionDate: iso(2024, 1, 10),
    thumbnail: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
    hasUnits: true,
  },
  {
    id: "a7", name: "Nhà phố Đà Nẵng", type: "Nhà riêng", ownershipType: "Sở hữu",
    status: "Đang sử dụng", city: "Đà Nẵng", district: "Quận Hải Châu", ward: "Phường Thạch Thang",
    addressDetail: "56 Bạch Đằng", lat: 16.0754, lng: 108.2229,
    area: 95, currentValue: 5200000000, acquisitionDate: iso(2017, 6, 30),
    thumbnail: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
    floors: 2, bedrooms: 3,
  },
];

export const seedUnits: AssetUnit[] = [
  { id: "u1", assetId: "a3", name: "Phòng 101", floor: 1, area: 25, status: "Đang cho thuê" },
  { id: "u2", assetId: "a3", name: "Phòng 102", floor: 1, area: 25, status: "Trống" },
  { id: "u3", assetId: "a3", name: "Phòng 201", floor: 2, area: 28, status: "Đang cho thuê" },
  { id: "u4", assetId: "a3", name: "Phòng 202", floor: 2, area: 28, status: "Đang sửa chữa" },
  { id: "u5", assetId: "a3", name: "Phòng 301", floor: 3, area: 30, status: "Đang cho thuê" },
  { id: "u6", assetId: "a6", name: "Khu A", floor: 8, area: 100, status: "Đang cho thuê" },
  { id: "u7", assetId: "a6", name: "Khu B", floor: 8, area: 100, status: "Trống" },
];

export const seedContacts: ContactParty[] = [
  { id: "c1", type: "Người thuê", name: "Nguyễn Văn An", phone: "0912345678", email: "an.nv@example.com" },
  { id: "c2", type: "Người thuê", name: "Trần Thị Bình", phone: "0987654321" },
  { id: "c3", type: "Người thuê", name: "Lê Minh Cường", phone: "0909111222" },
  { id: "c4", type: "Người thuê", name: "Phạm Thu Hà", phone: "0938222333" },
  { id: "c5", type: "Người thuê", name: "Công ty TNHH Tech Việt", phone: "02838222111", email: "hr@techviet.vn" },
  { id: "c6", type: "Chủ nhà", name: "Bà Lê Thị Hoa", phone: "0913444555", notes: "Chủ nhà chung cư mini Cầu Giấy" },
  { id: "c7", type: "Chủ nhà", name: "Ông Trần Văn Đức", phone: "0918777666", notes: "Chủ tòa nhà văn phòng Nguyễn Trãi" },
  { id: "c8", type: "Môi giới", name: "Anh Hùng - BĐS Phát Đạt", phone: "0977123456" },
  { id: "c9", type: "Môi giới", name: "Chị Mai - Nhà Đất 24h", phone: "0966987654" },
  { id: "c10", type: "Nhà thầu", name: "Xưởng mộc Thành Công", phone: "0933555666" },
  { id: "c11", type: "Nhà thầu", name: "Điện nước Anh Tuấn", phone: "0944888999" },
];

export const seedContracts: LeaseContract[] = [
  {
    id: "k1", code: "HD-2024-001", assetId: "a1", direction: "Cho thuê",
    counterpartyId: "c5", startDate: iso(2024, 3, 1), endDate: iso(2026, 3, 1),
    rentAmount: 45000000, paymentCycle: "Hàng tháng", paymentDueDay: 5,
    depositAmount: 90000000, taxResponsibility: "Người thuê", status: "Đang hiệu lực",
  },
  {
    id: "k2", code: "HD-2024-002", assetId: "a3", unitId: "u1", direction: "Cho thuê",
    counterpartyId: "c1", startDate: iso(2024, 6, 1), endDate: inDays(20),
    rentAmount: 5500000, paymentCycle: "Hàng tháng", paymentDueDay: 3,
    depositAmount: 11000000, taxResponsibility: "Chủ nhà", status: "Đang hiệu lực",
  },
  {
    id: "k3", code: "HD-2024-003", assetId: "a3", unitId: "u3", direction: "Cho thuê",
    counterpartyId: "c2", startDate: iso(2024, 9, 1), endDate: iso(2025, 9, 1),
    rentAmount: 6000000, paymentCycle: "Hàng tháng", paymentDueDay: 3,
    depositAmount: 12000000, taxResponsibility: "Chủ nhà", status: "Đang hiệu lực",
  },
  {
    id: "k4", code: "HD-2024-004", assetId: "a3", unitId: "u5", direction: "Cho thuê",
    counterpartyId: "c3", startDate: iso(2025, 1, 15), endDate: iso(2026, 1, 15),
    rentAmount: 6500000, paymentCycle: "Hàng tháng", paymentDueDay: 15,
    depositAmount: 13000000, taxResponsibility: "Chủ nhà", status: "Đang hiệu lực",
  },
  {
    id: "k5", code: "HD-2023-010", assetId: "a3", direction: "Đi thuê",
    counterpartyId: "c6", startDate: iso(2023, 8, 1), endDate: iso(2026, 8, 1),
    rentAmount: 25000000, paymentCycle: "Quý", paymentDueDay: 1,
    depositAmount: 50000000, taxResponsibility: "Chủ nhà", status: "Đang hiệu lực",
    notes: "Được phép cho thuê lại theo phòng",
  },
  {
    id: "k6", code: "HD-2024-005", assetId: "a6", unitId: "u6", direction: "Cho thuê",
    counterpartyId: "c5", startDate: iso(2024, 5, 1), endDate: inDays(45),
    rentAmount: 22000000, paymentCycle: "Hàng tháng", paymentDueDay: 5,
    depositAmount: 44000000, taxResponsibility: "Người thuê", status: "Đang hiệu lực",
  },
  {
    id: "k7", code: "HD-2024-006", assetId: "a6", direction: "Đi thuê",
    counterpartyId: "c7", startDate: iso(2024, 1, 10), endDate: iso(2027, 1, 10),
    rentAmount: 35000000, paymentCycle: "Quý", paymentDueDay: 10,
    depositAmount: 105000000, taxResponsibility: "Chủ nhà", status: "Đang hiệu lực",
  },
  {
    id: "k8", code: "HD-2022-001", assetId: "a1", direction: "Cho thuê",
    counterpartyId: "c4", startDate: iso(2022, 3, 1), endDate: iso(2024, 3, 1),
    rentAmount: 40000000, paymentCycle: "Hàng tháng", paymentDueDay: 5,
    depositAmount: 80000000, taxResponsibility: "Người thuê", status: "Đã gia hạn",
  },
];

// Cashflow: generate 12 months of history
export const seedCashflow: CashFlowEntry[] = (() => {
  const entries: CashFlowEntry[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 5);
    entries.push({
      id: `cf-r1-${i}`, assetId: "a1", direction: "Thu", category: "Tiền thuê thu vào",
      amount: 45000000, occurredAt: d.toISOString(),
      description: "Thu tiền thuê Nhà phố Quận 7",
    });
    entries.push({
      id: `cf-r3a-${i}`, assetId: "a3", direction: "Thu", category: "Tiền thuê thu vào",
      amount: 5500000, occurredAt: new Date(d.getFullYear(), d.getMonth(), 3).toISOString(),
      description: "Thu tiền phòng 101",
    });
    entries.push({
      id: `cf-r3b-${i}`, assetId: "a3", direction: "Thu", category: "Tiền thuê thu vào",
      amount: 6000000, occurredAt: new Date(d.getFullYear(), d.getMonth(), 3).toISOString(),
      description: "Thu tiền phòng 201",
    });
    if (i % 3 === 0) {
      entries.push({
        id: `cf-p3-${i}`, assetId: "a3", direction: "Chi", category: "Tiền thuê trả chủ nhà",
        amount: 75000000, occurredAt: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
        description: "Trả tiền thuê nhà cho bà Hoa (quý)",
      });
    }
  }
  entries.push({
    id: "cf-m1", assetId: "a1", direction: "Chi", category: "Chi phí sửa chữa",
    amount: 8500000, occurredAt: iso(today.getFullYear(), Math.max(1, today.getMonth()), 15),
    description: "Sơn lại mặt tiền", linkedMaintenanceId: "m1",
  });
  entries.push({
    id: "cf-t1", assetId: "a1", direction: "Chi", category: "Thuế TNCN",
    amount: 27000000, occurredAt: iso(today.getFullYear(), 3, 30),
    description: "Thuế TNCN từ cho thuê nhà 2024",
  });
  entries.push({
    id: "cf-t2", assetId: "a2", direction: "Chi", category: "Thuế phi nông nghiệp",
    amount: 850000, occurredAt: iso(today.getFullYear(), 5, 10),
    description: "Thuế đất phi nông nghiệp",
  });
  entries.push({
    id: "cf-e1", assetId: "a3", direction: "Chi", category: "Hoá đơn điện",
    amount: 3200000, occurredAt: iso(today.getFullYear(), today.getMonth() + 1, 10),
    description: "Điện tháng chung",
  });
  return entries;
})();

export const seedReminders: Reminder[] = [
  { id: "r1", title: "Thu tiền thuê Nhà phố Quận 7", type: "Thu tiền thuê",
    assetId: "a1", contractId: "k1", dueDate: inDays(3), cycle: "Tháng", daysBefore: 3, enabled: true },
  { id: "r2", title: "Trả tiền thuê nhà cho bà Hoa (quý)", type: "Đóng tiền thuê",
    assetId: "a3", contractId: "k5", dueDate: inDays(7), cycle: "Quý", daysBefore: 5, enabled: true },
  { id: "r3", title: "Hợp đồng HD-2024-002 sắp hết hạn", type: "Hết hạn hợp đồng",
    assetId: "a3", contractId: "k2", dueDate: inDays(20), cycle: "Không lặp", daysBefore: 30, enabled: true },
  { id: "r4", title: "Bảo dưỡng điều hoà biệt thự Thảo Điền", type: "Bảo dưỡng",
    assetId: "a5", dueDate: inDays(14), cycle: "Nửa năm", daysBefore: 7, enabled: true },
  { id: "r5", title: "Đóng thuế môn bài", type: "Đóng thuế",
    dueDate: inDays(45), cycle: "Năm", daysBefore: 15, enabled: true },
  { id: "r6", title: "Thanh toán hoá đơn điện chung cư mini", type: "Thanh toán hoá đơn",
    assetId: "a3", dueDate: inDays(5), cycle: "Tháng", daysBefore: 3, enabled: true },
  { id: "r7", title: "Hợp đồng HD-2024-005 sắp hết hạn", type: "Hết hạn hợp đồng",
    assetId: "a6", contractId: "k6", dueDate: inDays(45), cycle: "Không lặp", daysBefore: 30, enabled: false },
];

export const seedDocuments: AssetDocument[] = [
  { id: "d1", assetId: "a1", type: "Sổ đỏ/sổ hồng", name: "GCN QSDĐ Nhà phố Q7.pdf",
    issuedDate: iso(2019, 5, 15), fileName: "so-hong-q7.pdf" },
  { id: "d2", assetId: "a1", type: "HĐ thuê", name: "HĐ thuê Tech Việt 2024.pdf",
    issuedDate: iso(2024, 3, 1), expiryDate: iso(2026, 3, 1) },
  { id: "d3", assetId: "a2", type: "Sổ đỏ/sổ hồng", name: "Sổ hồng Landmark 81.pdf",
    issuedDate: iso(2021, 4, 1) },
  { id: "d4", assetId: "a3", type: "HĐ thuê", name: "HĐ thuê lại từ bà Hoa.pdf",
    issuedDate: iso(2023, 8, 1), expiryDate: iso(2026, 8, 1) },
  { id: "d5", assetId: "a1", type: "HĐ điện", name: "HĐ điện EVN.pdf",
    issuedDate: iso(2019, 6, 1), expiryDate: inDays(25) },
  { id: "d6", assetId: "a5", type: "Sổ đỏ/sổ hồng", name: "Sổ đỏ Thảo Điền.pdf",
    issuedDate: iso(2018, 2, 20) },
  { id: "d7", assetId: "a4", type: "Sổ đỏ/sổ hồng", name: "Sổ đỏ đất Long An.pdf",
    issuedDate: iso(2020, 11, 10) },
];

export const seedMedia: AssetMedia[] = [
  { id: "im1", assetId: "a1", url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800", caption: "Mặt tiền", takenAt: iso(2024, 1, 15) },
  { id: "im2", assetId: "a1", url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800", caption: "Phòng khách", takenAt: iso(2024, 1, 15) },
  { id: "im3", assetId: "a1", url: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800", caption: "Sân thượng", takenAt: iso(2024, 3, 1) },
  { id: "im4", assetId: "a2", url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800", caption: "View sông", takenAt: iso(2023, 5, 10) },
  { id: "im5", assetId: "a5", url: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800", caption: "Ngoại thất", takenAt: iso(2024, 6, 20) },
];

export const seedEquipment: Equipment[] = [
  { id: "e1", assetId: "a1", name: "Máy lạnh 1.5HP", quantity: 4, condition: "Tốt", source: "Tự trang bị" },
  { id: "e2", assetId: "a1", name: "Máy nước nóng", quantity: 3, condition: "Tốt", source: "Tự trang bị" },
  { id: "e3", assetId: "a3", name: "Giường ngủ", quantity: 5, condition: "Khá", source: "Nhận từ chủ nhà" },
  { id: "e4", assetId: "a3", name: "Tủ quần áo", quantity: 5, condition: "Cần sửa", source: "Nhận từ chủ nhà" },
  { id: "e5", assetId: "a5", name: "Bếp từ", quantity: 1, condition: "Mới", source: "Tự trang bị" },
];

export const seedMaintenance: MaintenanceRecord[] = [
  { id: "m1", assetId: "a1", title: "Sơn lại mặt tiền", startDate: iso(today.getFullYear(), Math.max(1, today.getMonth()), 10),
    endDate: iso(today.getFullYear(), Math.max(1, today.getMonth()), 15), cost: 8500000, contractorId: "c11",
    description: "Sơn 2 lớp, chống thấm tường ngoài" },
  { id: "m2", assetId: "a3", title: "Sửa máy nước nóng phòng 202", startDate: inDays(-3),
    cost: 1200000, contractorId: "c11", description: "Thay bộ đun, đang chờ linh kiện" },
  { id: "m3", assetId: "a5", title: "Bảo dưỡng vườn + hồ bơi", startDate: iso(today.getFullYear(), Math.max(1, today.getMonth() - 1), 20),
    endDate: iso(today.getFullYear(), Math.max(1, today.getMonth() - 1), 22), cost: 4500000, contractorId: "c10" },
];

export const seedSaleListings: SaleListing[] = [
  { id: "s1", assetId: "a4", price: 3200000000, status: "Đang rao", listedDate: iso(today.getFullYear(), Math.max(1, today.getMonth() - 1), 5),
    sentToBrokers: [
      { brokerId: "c8", sentAt: iso(today.getFullYear(), Math.max(1, today.getMonth() - 1), 6) },
      { brokerId: "c9", sentAt: iso(today.getFullYear(), Math.max(1, today.getMonth() - 1), 8) },
    ]},
];
