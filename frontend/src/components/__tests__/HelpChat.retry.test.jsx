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
  jsonResponse,
  isLocationRequest,
  locationResponse,
  provincesResponse,
} from "../../test/helpchatTestUtils";

describe("HelpChat retry queue semantics", () => {
  it("retries the failed request before continuing queued messages", async () => {
    const firstRequest = deferred();

    vi.spyOn(console, "error").mockImplementation(() => {});

    let iacallCount = 0;
    const inputs = [];

    globalThis.fetch = vi.fn((url, options = {}) => {
      if (String(url).includes("/provincias")) {
        return Promise.resolve(provincesResponse());
      }

      if (isLocationRequest(url)) {
        return Promise.resolve(locationResponse({ province: "Burgos" }));
      }

      iacallCount += 1;

      const body = JSON.parse(options.body);
      inputs.push(body.inputMessage);

      if (iacallCount === 1) {
        return firstRequest.promise;
      }

      return Promise.resolve(
        associationResponse({
          associationId: String(300 + iacallCount),
        }),
      );
    });

    render(<HelpChat />);

    await screen.findByRole("combobox", {
      name: /Provincia actual.*Burgos/i,
    });

    const input = screen.getByRole("textbox", { name: /Escribe qué necesitas/i });

    fireEvent.change(input, {
      target: {
        value: "Mensaje A",
      },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Enviar" }),
    );

    fireEvent.change(input, {
      target: {
        value: "Mensaje B",
      },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Enviar" }),
    );

    expect(iacallCount).toBe(1);

    firstRequest.resolve(
      jsonResponse(
        { error: "fallo controlado" },
        { ok: false, status: 500 },
      ),
    );

    const retry = await screen.findByRole("button", {
      name: "Reintentar",
    });

    expect(iacallCount).toBe(1);

    fireEvent.click(retry);

    await waitFor(() => {
      expect(iacallCount).toBe(3);
    });

    expect(inputs).toEqual([
      "Mensaje A",
      "Mensaje A",
      "Mensaje B",
    ]);
  });
});
