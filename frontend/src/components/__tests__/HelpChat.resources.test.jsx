import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HelpChat from "../HelpChat";
import {
  associationResponse,
  isLocationRequest,
  jsonResponse,
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

  it("does not ask the user to explain again after a recognized need has no resources", async () => {
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes("/provincias")) {
        return Promise.resolve(
          jsonResponse([
            { label: "A Coruña" },
            { label: "Burgos" },
          ]),
        );
      }

      if (isLocationRequest(url)) {
        return Promise.resolve(
          locationResponse({ province: "A Coruña" }),
        );
      }

      return Promise.resolve(
        jsonResponse({
          status: "resolved",
          needsClarification: false,
          clarificationQuestion: null,
          message:
            "He identificado tu consulta como ALCOHOLISMO, pero no he encontrado asociaciones.",
          tag: "ALCOHOLISMO",
          requestedProvince: "A Coruña",
          resolvedProvince: "A Coruña",
          effectiveProvince: "A Coruña",
          fallbackUsed: false,
          fallbackType: null,
          localCount: 0,
          neighborCount: 0,
          nationalCount: 0,
          durationMs: 120,
          associations: [],
        }),
      );
    });

    render(<HelpChat />);

    await screen.findByRole("combobox", {
      name: /Provincia actual.*A Coruña/i,
    });

    const input = screen.getByRole("textbox", {
      name: /Escribe qué necesitas/i,
    });

    fireEvent.change(input, {
      target: {
        value:
          "no sé qué hacer con mi vida he perdido el trabajo. tengo problemas de alcohol y no puedo dormir por las noches",
      },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Enviar" }),
    );

    expect(
      await screen.findByText(
        /He entendido que buscas orientación relacionada con ALCOHOLISMO/i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByText(
        /contando un poco más sobre el tipo de ayuda que necesitas/i,
      ),
    ).not.toBeInTheDocument();
  });
});
