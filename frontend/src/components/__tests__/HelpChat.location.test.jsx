import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HelpChat from "../HelpChat";
import { provincesResponse } from "../../test/helpchatTestUtils";

describe("HelpChat location control", () => {
  it("changes province using the single-click location control", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(provincesResponse()),
    );

    render(<HelpChat />);

    const select = await screen.findByRole("combobox", {
      name: /Provincia actual.*Burgos/i,
    });

    expect(select).toBeInTheDocument();

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
