import { describe, expect, it, vi } from "vitest";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
} from "./speechRecognition";

class FakeRecognition {
  constructor() {
    FakeRecognition.instance = this;
    this.lang = null;
    this.interimResults = false;
    this.continuous = true;
    this.start = vi.fn();
    this.stop = vi.fn();
    this.abort = vi.fn();
  }
}

const supportedTarget = () => ({
  SpeechRecognition: FakeRecognition,
});

describe("speechRecognition", () => {
  it("detects unsupported browsers", () => {
    expect(isSpeechRecognitionSupported({})).toBe(false);
    expect(createSpeechRecognition({ target: {} })).toBeNull();
  });

  it("detects standard SpeechRecognition support", () => {
    expect(isSpeechRecognitionSupported(supportedTarget())).toBe(true);
  });

  it("detects webkit SpeechRecognition support", () => {
    expect(
      isSpeechRecognitionSupported({
        webkitSpeechRecognition: FakeRecognition,
      }),
    ).toBe(true);
  });

  it("configures Spanish recognition with interim results", () => {
    createSpeechRecognition({ target: supportedTarget() });

    const instance = FakeRecognition.instance;

    expect(instance.lang).toBe("es-ES");
    expect(instance.interimResults).toBe(true);
    expect(instance.continuous).toBe(false);
  });

  it("separates interim and final transcripts", () => {
    const onResult = vi.fn();

    createSpeechRecognition({
      target: supportedTarget(),
      onResult,
    });

    FakeRecognition.instance.onresult({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: "Necesito " }], { isFinal: false }),
        Object.assign([{ transcript: "ayuda" }], { isFinal: true }),
      ],
    });

    expect(onResult).toHaveBeenCalledWith({
      interimTranscript: "Necesito",
      finalTranscript: "ayuda",
    });
  });

  it("forwards recognition errors", () => {
    const onError = vi.fn();

    createSpeechRecognition({
      target: supportedTarget(),
      onError,
    });

    FakeRecognition.instance.onerror({ error: "not-allowed" });

    expect(onError).toHaveBeenCalledWith("not-allowed");
  });

  it("exposes start stop and abort controls", () => {
    const adapter = createSpeechRecognition({
      target: supportedTarget(),
    });

    adapter.start();
    adapter.stop();
    adapter.abort();

    expect(FakeRecognition.instance.start).toHaveBeenCalledTimes(1);
    expect(FakeRecognition.instance.stop).toHaveBeenCalledTimes(1);
    expect(FakeRecognition.instance.abort).toHaveBeenCalledTimes(1);
  });
});
