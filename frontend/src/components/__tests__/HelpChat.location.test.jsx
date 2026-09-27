import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HelpChat from "../HelpChat";
import {
  isLocationRequest,
  locationResponse,
  provincesResponse,
} from "../../test/helpchatTestUtils";

describe("HelpChat location control", () => {
  it("changes province using the single-click location control", async () => {
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes("/provincias")) {
        return Promise.resolve(provincesResponse());
      }

      if (isLocationRequest(url)) {
        return Promise.resolve(
          locationResponse({ province: "Burgos" }),
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HelpChat />);

    const select = await screen.findByRole("combobox", {
      name: /Provincia actual.*Burgos/i,
    });

    fireEvent.mouseDown(select);

    const gipuzkoa = await screen.findByRole("option", {
      name: "Gipuzkoa",
    });

    fireEvent.click(gipuzkoa);

    expect(
      screen.getByRole("combobox", {
        name: /Provincia actual.*Gipuzkoa/i,
      }),
    ).toBeInTheDocument();
  });

  it("resumes the original request after choosing a required province", async () => {
    const iacallBodies = [];

    globalThis.fetch = vi.fn(async (url, options = {}) => {
      const value = String(url);

      if (value.includes("/provincias")) {
        return provincesResponse();
      }

      if (isLocationRequest(url)) {
        return locationResponse({
          country: null,
          province: null,
          municipality: null,
        });
      }

      if (value.includes("/iacall")) {
        const body = JSON.parse(options.body);
        iacallBodies.push(body);

        if (iacallBodies.length === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              status: "needs_location",
              needsLocation: true,
              locationReason: "province_required",
              needsClarification: false,
              associations: [],
              context: null,
            }),
          };
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "ok",
            message: "He encontrado un recurso.",
            tag: "BIENESTAR SOCIAL",
            requestedProvince: "Gipuzkoa",
            resolvedProvince: "Gipuzkoa",
            fallbackUsed: false,
            fallbackType: null,
            localCount: 1,
            neighborCount: 0,
            nationalCount: 0,
            associations: [],
          }),
        };
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HelpChat />);

    const input = screen.getByRole("textbox", {
      name: /Escribe qué necesitas/i,
    });

    fireEvent.change(input, {
      target: {
        value: "Necesito ayuda para mi hermano",
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Enviar",
      }),
    );

    expect(
      await screen.findByText(
        /necesito saber tu provincia/i,
      ),
    ).toBeInTheDocument();

    const select = screen.getByRole("combobox", {
      name: /Provincia actual.*sin seleccionar/i,
    });

    fireEvent.mouseDown(select);

    fireEvent.click(
      await screen.findByRole("option", {
        name: "Gipuzkoa",
      }),
    );

    await waitFor(() => {
      expect(iacallBodies).toHaveLength(2);
    });

    expect(iacallBodies[0]).toMatchObject({
      inputMessage: "Necesito ayuda para mi hermano",
      selectedProvincia: "",
    });

    expect(iacallBodies[1]).toMatchObject({
      inputMessage: "Necesito ayuda para mi hermano",
      selectedProvincia: "Gipuzkoa",
    });
  });

});
