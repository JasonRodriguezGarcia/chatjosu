import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HelpChat from "../HelpChat";
import { provincesResponse } from "../../test/helpchatTestUtils";

describe("HelpChat location control", () => {
  it("changes province using the compact location control", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(provincesResponse()),
    );

    render(<HelpChat />);

    const locationButton = await screen.findByRole("button", {
      name: /Cambiar provincia.*Burgos/i,
    });

    expect(locationButton).toBeInTheDocument();

    fireEvent.click(locationButton);

    const select = screen.getByRole("combobox", {
      name: /Provincia/i,
    });

    fireEvent.mouseDown(select);

    const gipuzkoa = await screen.findByRole("option", {
      name: "Gipuzkoa",
    });

    fireEvent.click(gipuzkoa);

    expect(
      screen.getByRole("button", {
        name: /Cambiar provincia.*Gipuzkoa/i,
      }),
    ).toBeInTheDocument();
  });
});
