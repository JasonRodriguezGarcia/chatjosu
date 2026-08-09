import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HelpChat from "../HelpChat";
import {
  associationResponse,
  isLocationRequest,
  locationResponse,
  provincesResponse,
} from "../../test/helpchatTestUtils";

describe("HelpChat structured resources", () => {
  it("renders a conversational reply and structured resources", async () => {
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes("/provincias")) {
        return Promise.resolve(provincesResponse());
      }

      if (isLocationRequest(url)) {
        return Promise.resolve(locationResponse({ province: "Burgos" }));
      }

      return Promise.resolve(associationResponse());
    });

    render(<HelpChat />);

    await screen.findByRole("combobox", {
      name: /Provincia actual.*Burgos/i,
    });

    const input = screen.getByRole("textbox", { name: /Escribe qué necesitas/i });

    fireEvent.change(input, {
      target: { value: "Necesito ayuda para un familiar" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Enviar" }),
    );

    expect(
      await screen.findByText(
        "He encontrado un recurso en Burgos que podría orientarte.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Recursos que pueden orientarte"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Servicios sociales y de dependencia"),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Respuesta backend heredada"),
    ).not.toBeInTheDocument();
  });
});
