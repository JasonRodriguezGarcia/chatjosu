import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import HelpChat from "../HelpChat";
import {
  associationResponse,
  deferred,
  jsonResponse,
  provincesResponse,
} from "../../test/helpchatTestUtils";

describe("HelpChat retry queue semantics", () => {
  it("retries the failed request before continuing queued messages", async () => {
    const user = userEvent.setup();
    const firstRequest = deferred();

    vi.spyOn(console, "error").mockImplementation(() => {});

    let iacallCount = 0;
    const inputs = [];

    globalThis.fetch = vi.fn((url, options = {}) => {
      if (String(url).includes("/provincias")) {
        return Promise.resolve(provincesResponse());
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

    await user.type(input, "Mensaje A");
    await user.click(
      screen.getByRole("button", { name: "Enviar" }),
    );

    await user.type(input, "Mensaje B");
    await user.click(
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

    await user.click(retry);

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
