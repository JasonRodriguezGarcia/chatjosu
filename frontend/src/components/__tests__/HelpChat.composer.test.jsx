import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HelpChat from "../HelpChat";
import {
  associationResponse,
  isLocationRequest,
  locationResponse,
  provincesResponse,
} from "../../test/helpchatTestUtils";

describe("HelpChat composer", () => {
  it("sends with Enter and keeps Shift+Enter as a newline", async () => {
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

    render(<HelpChat />);

    await screen.findByRole("combobox", {
      name: /Provincia actual.*Burgos/i,
    });

    const input = screen.getByRole("textbox", {
      name: /Escribe qué necesitas/i,
    });

    fireEvent.change(input, {
      target: { value: "Primera línea" },
    });

    fireEvent.keyDown(input, {
      key: "Enter",
      shiftKey: true,
    });

    expect(iacallCount).toBe(0);

    fireEvent.change(input, {
      target: { value: "Mensaje completo" },
    });

    fireEvent.keyDown(input, {
      key: "Enter",
      shiftKey: false,
    });

    expect(iacallCount).toBe(1);

    expect(
      screen.getByText("Mensaje completo"),
    ).toBeInTheDocument();

    expect(input).toHaveValue("");

    expect(
      await screen.findByText(
        "He encontrado un recurso en Burgos que podría orientarte.",
      ),
    ).toBeInTheDocument();
  });
});
