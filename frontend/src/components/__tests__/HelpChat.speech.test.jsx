import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HelpChat from "../HelpChat";
import {
  associationResponse,
  isLocationRequest,
  locationResponse,
  provincesResponse,
} from "../../test/helpchatTestUtils";

class FakeRecognition {
  constructor() {
    FakeRecognition.instance = this;
    this.start = vi.fn();
    this.stop = vi.fn();
    this.abort = vi.fn();
  }
}

const installSpeechRecognition = () => {
  globalThis.SpeechRecognition = FakeRecognition;
};

const installFetch = () => {
  let iacallCount = 0;

  globalThis.fetch = vi.fn((url) => {
    if (String(url).includes("/provincias")) {
      return Promise.resolve(provincesResponse());
    }

    if (isLocationRequest(url)) {
      return Promise.resolve(locationResponse({ province: "Burgos" }));
    }

    iacallCount += 1;
    return Promise.resolve(associationResponse());
  });

  return () => iacallCount;
};

afterEach(() => {
  delete globalThis.SpeechRecognition;
  delete globalThis.webkitSpeechRecognition;
});

describe("HelpChat speech input", () => {
  it("does not show a microphone without browser support", async () => {
    installFetch();
    render(<HelpChat />);

    await screen.findByRole("combobox", {
      name: /Provincia actual.*Burgos/i,
    });

    expect(
      screen.queryByRole("button", { name: "Dictar mensaje" }),
    ).not.toBeInTheDocument();
  });

  it("starts and stops dictation without sending", async () => {
    installSpeechRecognition();
    const getIacallCount = installFetch();
    render(<HelpChat />);

    const mic = await screen.findByRole("button", {
      name: "Dictar mensaje",
    });

    fireEvent.click(mic);
    expect(FakeRecognition.instance.start).toHaveBeenCalledTimes(1);

    act(() => {
      FakeRecognition.instance.onstart();
    });

    expect(screen.getByText("Escuchando…")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Detener dictado" }),
    );

    expect(FakeRecognition.instance.stop).toHaveBeenCalledTimes(1);
    expect(getIacallCount()).toBe(0);
  });

  it("puts transcription in the composer without auto-send", async () => {
    installSpeechRecognition();
    const getIacallCount = installFetch();
    render(<HelpChat />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Dictar mensaje" }),
    );

    act(() => {
      FakeRecognition.instance.onstart();
      FakeRecognition.instance.onresult({
        resultIndex: 0,
        results: [
          Object.assign([{ transcript: "Necesito ayuda para mi madre" }], {
            isFinal: true,
          }),
        ],
      });
    });

    expect(
      screen.getByRole("textbox", { name: /Escribe qué necesitas/i }),
    ).toHaveValue("Necesito ayuda para mi madre");
    expect(getIacallCount()).toBe(0);
  });

  it("preserves existing text and appends dictated text", async () => {
    installSpeechRecognition();
    installFetch();
    render(<HelpChat />);

    await screen.findByRole("combobox", {
      name: /Provincia actual.*Burgos/i,
    });

    const input = screen.getByRole("textbox", {
      name: /Escribe qué necesitas/i,
    });

    fireEvent.change(input, {
      target: { value: "Necesito orientación" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Dictar mensaje" }),
    );

    act(() => {
      FakeRecognition.instance.onstart();
      FakeRecognition.instance.onresult({
        resultIndex: 0,
        results: [
          Object.assign([{ transcript: "para mi madre" }], {
            isFinal: true,
          }),
        ],
      });
    });

    expect(input).toHaveValue("Necesito orientación para mi madre");
  });

  it("keeps existing text when microphone permission is denied", async () => {
    installSpeechRecognition();
    installFetch();
    render(<HelpChat />);

    await screen.findByRole("combobox", {
      name: /Provincia actual.*Burgos/i,
    });

    const input = screen.getByRole("textbox", {
      name: /Escribe qué necesitas/i,
    });

    fireEvent.change(input, {
      target: { value: "Texto que no debe perderse" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Dictar mensaje" }),
    );

    act(() => {
      FakeRecognition.instance.onstart();
      FakeRecognition.instance.onerror({ error: "not-allowed" });
    });

    expect(input).toHaveValue("Texto que no debe perderse");
    expect(
      screen.getByText(/No he podido acceder al micrófono/i),
    ).toBeInTheDocument();
  });

  it("aborts active recognition when HelpChat unmounts", async () => {
    installSpeechRecognition();
    installFetch();

    const view = render(<HelpChat />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Dictar mensaje" }),
    );

    view.unmount();

    expect(FakeRecognition.instance.abort).toHaveBeenCalledTimes(1);
  });

  it("sends the manually edited transcription", async () => {
    installSpeechRecognition();

    let sentPayload = null;

    globalThis.fetch = vi.fn((url, options) => {
      if (String(url).includes("/provincias")) {
        return Promise.resolve(provincesResponse());
      }

      if (isLocationRequest(url)) {
        return Promise.resolve(
          locationResponse({ province: "Burgos" }),
        );
      }

      sentPayload = JSON.parse(options.body);
      return Promise.resolve(associationResponse());
    });

    render(<HelpChat />);

    const mic = await screen.findByRole("button", {
      name: "Dictar mensaje",
    });

    fireEvent.click(mic);

    act(() => {
      FakeRecognition.instance.onstart();
      FakeRecognition.instance.onresult({
        resultIndex: 0,
        results: [
          Object.assign(
            [{ transcript: "Necesito ayuda para mi madre" }],
            { isFinal: true },
          ),
        ],
      });
    });

    const input = screen.getByRole("textbox", {
      name: /Escribe qué necesitas/i,
    });

    expect(input).toHaveValue(
      "Necesito ayuda para mi madre",
    );

    fireEvent.change(input, {
      target: {
        value: "Necesito ayuda para mi tía",
      },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Enviar" }),
    );

    expect(sentPayload?.inputMessage).toBe(
      "Necesito ayuda para mi tía",
    );

    expect(
      await screen.findByText(
        "He encontrado un recurso en Burgos que podría orientarte.",
      ),
    ).toBeInTheDocument();
  });


});
