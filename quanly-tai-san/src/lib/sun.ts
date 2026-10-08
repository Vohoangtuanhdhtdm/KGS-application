/**
 * Vị trí mặt trời và nắng chiếu vào mặt tiền — trả lời "nhà hướng Tây có bị nắng hắt không?"
 * bằng con số thay vì lời đồn.
 *
 * Công thức thiên văn rút gọn theo SunCalc (V. Agafonkin, dựa trên công thức của Astronomy
 * Answers): sai số cỡ vài phần mười độ — thừa đủ cho chuyện nắng vào nhà, và không cần thêm
 * một thư viện. Mọi giờ trên giao diện là giờ Việt Nam (UTC+7, không có giờ mùa hè), bất kể
 * máy người xem đặt múi giờ nào.
 */

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2_440_588;
const J2000 = 2_451_545;
const OBLIQUITY = RAD * 23.4397;
/** Giờ Việt Nam lệch UTC 7 tiếng, cả năm như nhau. */
const VN_OFFSET_MIN = 7 * 60;

export interface SunPosition {
  /** Phương vị, độ, tính từ hướng Bắc theo chiều kim đồng hồ (90 = Đông, 270 = Tây). */
  azimuth: number;
  /** Độ cao so với đường chân trời, độ. Âm = mặt trời đã lặn. */
  altitude: number;
}

export function sunPosition(date: Date, lat: number, lng: number): SunPosition {
  const d = date.valueOf() / DAY_MS - 0.5 + J1970 - J2000;
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI; // kinh độ hoàng đạo
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L));
  const H = RAD * (280.16 + 360.9856235 * d) + RAD * lng - ra; // góc giờ
  const phi = RAD * lat;
  // SunCalc tính phương vị từ hướng Nam, dương về phía Tây — cộng 180° để về chuẩn la bàn.
  const azSouth = Math.atan2(
    Math.sin(H),
    Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi),
  );
  const alt = Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H),
  );
  return { azimuth: (azSouth / RAD + 180 + 360) % 360, altitude: alt / RAD };
}

/** Một thời điểm theo giờ Việt Nam: ngày của `day` (theo lịch VN) + `minutes` phút từ 0 giờ. */
export function vnTime(day: Date, minutes: number): Date {
  const vn = new Date(day.valueOf() + VN_OFFSET_MIN * 60_000);
  return new Date(
    Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) +
      (minutes - VN_OFFSET_MIN) * 60_000,
  );
}

/** Phút trong ngày theo giờ Việt Nam của một thời điểm. */
export function vnMinutes(date: Date): number {
  const m = Math.floor((date.valueOf() + VN_OFFSET_MIN * 60_000) / 60_000);
  return ((m % 1440) + 1440) % 1440;
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Hướng nhà (hướng mặt tiền nhìn ra) → phương vị. Khớp HOUSE_DIRECTIONS. */
export const DIRECTION_AZIMUTH: Record<string, number> = {
  Bắc: 0,
  "Đông Bắc": 45,
  Đông: 90,
  "Đông Nam": 135,
  Nam: 180,
  "Tây Nam": 225,
  Tây: 270,
  "Tây Bắc": 315,
};

export function directionAzimuth(dir: string | null | undefined): number | null {
  return dir ? (DIRECTION_AZIMUTH[dir.trim()] ?? null) : null;
}

/** Tên hướng gần nhất của một phương vị, ví dụ 250° → "Tây Nam". */
export function azimuthName(az: number): string {
  const names = ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"];
  return names[Math.round((((az % 360) + 360) % 360) / 45) % 8];
}

/** Mặt trời thấp hơn mức này thì nắng xuyên qua quá nhiều lớp khí quyển và nhà cửa — bỏ qua. */
const MIN_ALTITUDE = 5;
/**
 * Góc tới tối đa trên mặt tường đứng (75°): nắng xiên hơn thế chỉ quét qua tường, không rọi vào
 * nhà. Tính theo góc tới thật — cos(góc tới) = cos(độ cao) × cos(lệch phương vị) — chứ không chỉ
 * lệch phương vị: buổi trưa mặt trời gần đỉnh đầu, đứng ngay "trước" mặt tiền mà nắng vẫn chỉ
 * rọi xuống mái hiên.
 */
const MIN_COS_INCIDENCE = Math.cos(75 * RAD);
const STEP_MIN = 5;

export interface FacadeSun {
  /** Các khoảng nắng rọi vào mặt tiền, phút trong ngày (giờ VN). */
  windows: [number, number][];
  totalMinutes: number;
  /** Số phút nắng rọi sau 12:00 — nắng chiều nóng hơn nắng sáng nhiều. */
  afternoonMinutes: number;
}

/**
 * Trong một ngày, những lúc nào nắng rọi thẳng vào mặt tiền: mặt trời đủ cao, nằm phía trước
 * mặt tiền và chiếu vào tường không quá xiên. Không tính nhà cao xung quanh che — đó là phần
 * bản đồ 3D cho người xem tự thấy.
 */
export function facadeSun(facadeAzimuth: number, day: Date, lat: number, lng: number): FacadeSun {
  const windows: [number, number][] = [];
  let total = 0;
  let afternoon = 0;
  let start: number | null = null;
  for (let m = 4 * 60; m <= 20 * 60; m += STEP_MIN) {
    const p = sunPosition(vnTime(day, m), lat, lng);
    const diff = (p.azimuth - facadeAzimuth) * RAD;
    const lit =
      p.altitude >= MIN_ALTITUDE &&
      Math.cos(p.altitude * RAD) * Math.cos(diff) >= MIN_COS_INCIDENCE;
    if (lit) {
      total += STEP_MIN;
      if (m >= 12 * 60) afternoon += STEP_MIN;
      if (start == null) start = m;
    } else if (start != null) {
      windows.push([start, m]);
      start = null;
    }
  }
  if (start != null) windows.push([start, 20 * 60]);
  return { windows, totalMinutes: total, afternoonMinutes: afternoon };
}

/** Ba ngày đại diện: hôm nay, giữa mùa nắng nóng (hạ chí) và giữa mùa ít nắng (đông chí). */
export function seasonDays(today = new Date()): { key: string; label: string; date: Date }[] {
  const y = new Date(today.valueOf() + VN_OFFSET_MIN * 60_000).getUTCFullYear();
  return [
    { key: "today", label: "Hôm nay", date: today },
    { key: "summer", label: "Hạ chí 21/6", date: new Date(Date.UTC(y, 5, 21, 5)) },
    { key: "winter", label: "Đông chí 22/12", date: new Date(Date.UTC(y, 11, 22, 5)) },
  ];
}

export function formatDurationMinutes(min: number): string {
  if (min <= 0) return "0 phút";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h} giờ ${m} phút` : `${h} giờ`) : `${m} phút`;
}

/** Một câu tóm tắt: "13:05–17:45 (4 giờ 40 phút), chủ yếu nắng chiều". */
export function describeFacadeSun(s: FacadeSun): string {
  if (s.totalMinutes === 0) return "Không có nắng rọi thẳng vào mặt tiền";
  const spans = s.windows.map(([a, b]) => `${formatClock(a)}–${formatClock(b)}`).join(", ");
  const share = s.afternoonMinutes / s.totalMinutes;
  const kind =
    share >= 0.7 ? "chủ yếu nắng chiều" : share <= 0.3 ? "chủ yếu nắng sáng" : "cả sáng lẫn chiều";
  return `${spans} (${formatDurationMinutes(s.totalMinutes)}), ${kind}`;
}

// ---------------- Trạng thái mô phỏng nắng của cảnh 3D ----------------

export const SUN_MIN = 5 * 60;
export const SUN_MAX = 19 * 60;

export interface SunState {
  on: boolean;
  dayKey: string;
  minutes: number;
  playing: boolean;
}

export const DEFAULT_SUN: SunState = {
  on: false,
  dayKey: "today",
  minutes: 15 * 60,
  playing: false,
};

/** Thời điểm đang mô phỏng, hoặc null khi tắt. */
export function sunTimeOf(s: SunState): Date | null {
  if (!s.on) return null;
  const day = seasonDays().find((d) => d.key === s.dayKey)?.date ?? new Date();
  return vnTime(day, s.minutes);
}
