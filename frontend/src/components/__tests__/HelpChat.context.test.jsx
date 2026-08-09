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
  deferred,
  provincesResponse,
} from "../../test/helpchatTestUtils";

describe("HelpChat conversational context", () => {
  it("uses context returned by the previous completed turn", async () => {
    const firstRequest = deferred();
    const requestBodies = [];

    let iacallCount = 0;

    globalThis.fetch = vi.fn((url, options = {}) => {
      if (String(url).includes("/provincias")) {
        return Promise.resolve(provincesResponse());
      }

      iacallCount += 1;

      const body = JSON.parse(options.body);
      requestBodies.push(body);

      if (iacallCount === 1) {
        return firstRequest.promise;
      }

      return Promise.resolve({
        ...associationResponse(),
        json: async () => ({
          ...(await associationResponse().json()),
          context: {
            activeNeeds: ["ALZHEIMER", "AISLAMIENTO"],
            relationship: "madre",
            facts: ["vive sola"],
          },
        }),
      });
    });

    render(<HelpChat />);

    await screen.findByRole("button", {
      name: /Cambiar provincia.*Burgos/i,
    });

    const input = screen.getByRole("textbox", {
      name: /Escribe qué necesitas/i,
    });

    const send = screen.getByRole("button", {
      name: "Enviar",
    });

    fireEvent.change(input, {
      target: { value: "Mi madre tiene Alzheimer" },
    });
    fireEvent.click(send);

    fireEvent.change(input, {
      target: { value: "Además vive sola" },
    });
    fireEvent.click(send);

    expect(iacallCount).toBe(1);

    expect(requestBodies[0].conversationContext).toBeNull();

    const firstData = await associationResponse().json();

    firstRequest.resolve({
      ...associationResponse(),
      json: async () => ({
        ...firstData,
        context: {
          activeNeeds: ["ALZHEIMER"],
          relationship: "madre",
          facts: [],
        },
      }),
    });

    await waitFor(() => {
      expect(iacallCount).toBe(2);
    });

    expect(requestBodies[1]).toMatchObject({
      inputMessage: "Además vive sola",
      selectedProvincia: "Burgos",
      conversationContext: {
        activeNeeds: ["ALZHEIMER"],
        relationship: "madre",
        facts: [],
      },
    });
  });
});
