import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HelpChat from "../HelpChat";
import {
  associationResponse,
  deferred,
  isLocationRequest,
  locationResponse,
  provincesResponse,
} from "../../test/helpchatTestUtils";

describe("HelpChat request queue", () => {
  it("allows continued expression while processing requests in FIFO order", async () => {
    const firstRequest = deferred();

    let iacallCount = 0;
    const sentInputs = [];

    globalThis.fetch = vi.fn((url, options = {}) => {
      if (String(url).includes("/provincias")) {
        return Promise.resolve(provincesResponse());
      }

      if (isLocationRequest(url)) {
        return Promise.resolve(locationResponse({ province: "Burgos" }));
      }

      iacallCount += 1;

      const body = JSON.parse(options.body);
      sentInputs.push(body.inputMessage);

      if (iacallCount === 1) {
        return firstRequest.promise;
      }

      return Promise.resolve(
        associationResponse({
          associationId: String(213 + iacallCount),
        }),
      );
    });

    render(<HelpChat />);

    await screen.findByRole("combobox", {
      name: /Provincia actual.*Burgos/i,
    });

    const input = screen.getByRole("textbox", {
      name: /Escribe qué necesitas/i,
    });

    const send = screen.getByRole("button", {
      name: "Enviar",
    });

    fireEvent.change(input, {
      target: { value: "Necesito ayuda para mi madre" },
    });
    fireEvent.click(send);

    expect(
      screen.getByText("Necesito ayuda para mi madre"),
    ).toBeInTheDocument();

    fireEvent.change(input, {
      target: { value: "Tiene Alzheimer" },
    });

    expect(send).toBeEnabled();

    fireEvent.click(send);

    fireEvent.change(input, {
      target: { value: "Y vive sola" },
    });
    fireEvent.click(send);

    expect(
      screen.getByText("Tiene Alzheimer"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Y vive sola"),
    ).toBeInTheDocument();

    expect(iacallCount).toBe(1);
    expect(sentInputs).toEqual([
      "Necesito ayuda para mi madre",
    ]);

    firstRequest.resolve(associationResponse());

    await waitFor(() => {
      expect(iacallCount).toBe(3);
    });

    expect(sentInputs).toEqual([
      "Necesito ayuda para mi madre",
      "Tiene Alzheimer",
      "Y vive sola",
    ]);

    expect(iacallCount).toBe(3);
  });
});
