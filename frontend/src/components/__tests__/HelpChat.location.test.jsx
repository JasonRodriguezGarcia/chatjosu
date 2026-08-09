import { fireEvent, render, screen } from "@testing-library/react";
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
});
