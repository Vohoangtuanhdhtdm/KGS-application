import { describe, expect, it } from "vitest";
import { voiceErrorText } from "./voiceErrorText";

describe("voiceErrorText", () => {
  it("hết lượt nói thì bảo chờ vài phút, không nói 'đang bận'", () => {
    const t = voiceErrorText("quota");
    expect(t).toContain("hết lượt");
    expect(t).toContain("vài phút");
    expect(t).not.toContain("đang bận");
  });
  it("mất mạng thì bảo kiểm tra kết nối", () => {
    expect(voiceErrorText("network")).toContain("kết nối");
  });
  it("dịch vụ không sẵn sàng thì gợi ý gõ", () => {
    expect(voiceErrorText("unavailable")).toContain("gõ");
  });
});
