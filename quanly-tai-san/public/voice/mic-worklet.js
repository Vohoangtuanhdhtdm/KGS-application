// Thu micro cho KiGi: gom các khung 128 mẫu thành khối ~100 ms rồi gửi về luồng chính.
// AudioContext chạy ở 16 kHz nên khối 1600 mẫu = 100 ms, đúng nhịp Gemini Live khuyến nghị.
class MicWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(1600);
    this.n = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) {
          this.port.postMessage(this.buf.slice(0));
          this.n = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("kgs-mic", MicWorklet);
