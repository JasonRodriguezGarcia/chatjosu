import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HelpChat from "../HelpChat";
import {
  deferred,
  isLocationRequest,
  jsonResponse,
  locationResponse,
  provincesResponse,
} from "../../test/helpchatTestUtils";

describe("HelpChat silent IP location", () => {
  it("uses a detected valid province as the initial selection", async () => {
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes("/provincias")) {
        return Promise.resolve(provincesResponse());
      }

      if (isLocationRequest(url)) {
        return Promise.resolve(
          locationResponse({ province: "Gipuzkoa" }),
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HelpChat />);

    expect(
      await screen.findByRole("combobox", {
        name: /Provincia actual.*Gipuzkoa/i,
      }),
    ).toBeInTheDocument();
  });

  it("keeps the fallback when silent location is unavailable", async () => {
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes("/provincias")) {
        return Promise.resolve(provincesResponse());
      }

      if (isLocationRequest(url)) {
        return Promise.resolve(
          jsonResponse({
            country: null,
            province: null,
            municipality: null,
            source: "unavailable",
            confidence: "none",
          }),
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HelpChat />);

    expect(
      await screen.findByRole("combobox", {
        name: /Provincia actual.*Burgos/i,
      }),
    ).toBeInTheDocument();
  });


  it("keeps the normal fallback when location detection fails", async () => {
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes("/provincias")) {
        return Promise.resolve(provincesResponse());
      }

      if (isLocationRequest(url)) {
        return Promise.resolve(
          jsonResponse({}, { ok: false, status: 503 }),
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HelpChat />);

    expect(
      await screen.findByRole("combobox", {
        name: /Provincia actual.*Burgos/i,
      }),
    ).toBeInTheDocument();
  });

  it("never overwrites a manual province with a late detection", async () => {
    const pendingLocation = deferred();

    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes("/provincias")) {
        return Promise.resolve(provincesResponse());
      }

      if (isLocationRequest(url)) {
        return pendingLocation.promise;
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HelpChat />);

    const select = await screen.findByRole("combobox", {
      name: /Provincia actual.*Burgos/i,
    });

    fireEvent.mouseDown(select);

    fireEvent.click(
      await screen.findByRole("option", { name: "Gipuzkoa" }),
    );

    expect(
      screen.getByRole("combobox", {
        name: /Provincia actual.*Gipuzkoa/i,
      }),
    ).toBeInTheDocument();

    pendingLocation.resolve(
      locationResponse({ province: "Burgos" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", {
          name: /Provincia actual.*Gipuzkoa/i,
        }),
      ).toBeInTheDocument();
    });
  });
});
