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
  deferred,
  isLocationRequest,
  locationResponse,
  provincesResponse,
} from "../../test/helpchatTestUtils";

const responseWithContext = async (context) => {
  const base = await associationResponse().json();

  return {
    ...associationResponse(),
    json: async () => ({
      ...base,
      context,
    }),
  };
};

describe("HelpChat conversational context chain", () => {
  it("propagates the latest completed context through A, B and C", async () => {
    const firstRequest = deferred();
    const secondRequest = deferred();

    const requestBodies = [];
    let iacallCount = 0;

    globalThis.fetch = vi.fn((url, options = {}) => {
      if (String(url).includes("/provincias")) {
        return Promise.resolve(provincesResponse());
      }

      if (isLocationRequest(url)) {
        return Promise.resolve(locationResponse({ province: "Burgos" }));
      }

      iacallCount += 1;
      requestBodies.push(JSON.parse(options.body));

      if (iacallCount === 1) {
        return firstRequest.promise;
      }

      if (iacallCount === 2) {
        return secondRequest.promise;
      }

      return responseWithContext(
        conversationContextV1({
          relationship: "madre",
          activeNeeds: ["alzheimer", "soledad"],
          facts: ["vive sola"],
          province: "Burgos",
        }),
      );
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
      target: { value: "Mi madre tiene Alzheimer" },
    });
    fireEvent.click(send);

    fireEvent.change(input, {
      target: { value: "Además vive sola" },
    });
    fireEvent.click(send);

    fireEvent.change(input, {
      target: { value: "Ella vive en Burgos" },
    });
    fireEvent.click(send);

    expect(iacallCount).toBe(1);
    expect(requestBodies[0].conversationContext).toBeNull();

    firstRequest.resolve(
      await responseWithContext(
        conversationContextV1({
          relationship: "madre",
          activeNeeds: ["alzheimer"],
          province: "Burgos",
        }),
      ),
    );

    await waitFor(() => {
      expect(iacallCount).toBe(2);
    });

    expect(requestBodies[1].conversationContext).toEqual(
      conversationContextV1({
        relationship: "madre",
        activeNeeds: ["alzheimer"],
        province: "Burgos",
      }),
    );

    secondRequest.resolve(
      await responseWithContext(
        conversationContextV1({
          relationship: "madre",
          activeNeeds: ["alzheimer", "soledad"],
          facts: ["vive sola"],
          province: "Burgos",
        }),
      ),
    );

    await waitFor(() => {
      expect(iacallCount).toBe(3);
    });

    expect(requestBodies[2]).toMatchObject({
      inputMessage: "Ella vive en Burgos",
      conversationContext: conversationContextV1({
        relationship: "madre",
        activeNeeds: ["alzheimer", "soledad"],
        facts: ["vive sola"],
        province: "Burgos",
      }),
    });
  });
});
