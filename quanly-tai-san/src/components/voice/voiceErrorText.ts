import type { VoiceError } from "@/lib/voice/useGeminiLive";

/** Câu KiGi nói khi phiên giọng nói hỏng — mỗi nguyên nhân một câu, để người dùng biết nên chờ,
 * kiểm tra mạng hay chuyển sang gõ. "quota" gồm cả giới hạn 5 phiên/10 phút của KGS lẫn hạn
 * mức Gemini. */
export function voiceErrorText(e: Exclude<VoiceError, "mic-denied">): string {
  switch (e) {
    case "quota":
      return "Bạn đã hết lượt nói với KiGi lúc này — thử lại sau vài phút, hoặc gõ vào ô phía trên nhé.";
    case "network":
      return "Mất kết nối với KiGi — kiểm tra mạng rồi bấm Nói lại nhé.";
    case "unavailable":
      return "Trợ lý giọng nói đang tạm nghỉ — bạn gõ vào ô phía trên nhé.";
  }
}
