import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import HelpChat from "../HelpChat";
import {
  associationResponse,
  provincesResponse,
} from "../../test/helpchatTestUtils";

describe("HelpChat structured resources", () => {
  it("renders a conversational reply and structured resources", async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes("/provincias")) {
        return Promise.resolve(provincesResponse());
      }

      return Promise.resolve(associationResponse());
    });

    render(<HelpChat />);

    await screen.findByRole("button", {
      name: /Cambiar provincia.*Burgos/i,
    });

    const input = screen.getByRole("textbox", { name: /Escribe qué necesitas/i });

    await user.type(input, "Necesito ayuda para un familiar");

    await user.click(
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
