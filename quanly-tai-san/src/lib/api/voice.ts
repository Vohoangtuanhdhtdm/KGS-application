import { api } from "./http";

export interface VoiceSession {
  /** Token tạm "auth_tokens/…" — dùng một lần, khoá cứng mô hình và lời dặn của KiGi. */
  token: string;
  model: string;
  expiresAt: string;
}

export const voiceApi = {
  /** Có hiện nút micro không — không tốn hạn mức. */
  status: () => api<{ enabled: boolean }>("/voice/status", { skipAuth: true }),
  /** 503 khi chưa cấu hình / Gemini lỗi; 429 khi tạo quá nhiều phiên. */
  session: () => api<VoiceSession>("/voice/session", { method: "POST", skipAuth: true }),
};
