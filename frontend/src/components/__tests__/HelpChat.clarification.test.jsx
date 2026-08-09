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
  conversationContextV1,
  provincesResponse,
} from "../../test/helpchatTestUtils";

describe("HelpChat clarification flow", () => {
  it(
    "renders clarification without provisional resources and carries context forward",
    { timeout: 10000 },
    async () => {
    const requestBodies = [];
    let callCount = 0;

    const safeContext = conversationContextV1({
      relationship: "madre",
      province: "Burgos",
    });

    globalThis.fetch = vi.fn(async (url, options = {}) => {
      if (String(url).includes("/provincias")) {
        return provincesResponse();
      }

      callCount += 1;
      requestBodies.push(JSON.parse(options.body));

      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            needsClarification: true,
            tag: null,
            clarificationQuestion:
              "¿Qué tipo de apoyo necesita tu madre?",
            context: safeContext,
            associations: [
              ...(await associationResponse().json()).associations,
            ],
            durationMs: 120,
          }),
        };
      }

      return associationResponse();
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
      await screen.findByText(
        "¿Qué tipo de apoyo necesita tu madre?",
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Recursos que pueden orientarte"),
    ).not.toBeInTheDocument();

    fireEvent.change(input, {
      target: { value: "Tiene Alzheimer y vive sola" },
    });
    fireEvent.click(send);

    await waitFor(() => {
      expect(callCount).toBe(2);
    });

    expect(requestBodies[1]).toMatchObject({
      inputMessage: "Tiene Alzheimer y vive sola",
      selectedProvincia: "Burgos",
      conversationContext: safeContext,
    });
    },
  );
});
