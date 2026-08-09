import { describe, expect, it } from "vitest";
import { normalizeDetectedLocation } from "./location";

describe("normalizeDetectedLocation", () => {
  it("normalizes a coarse IP location", () => {
    expect(
      normalizeDetectedLocation({
        country: " ES ",
        province: " A Coruña ",
        municipality: " Ferrol ",
      }),
    ).toEqual({
      country: "ES",
      province: "A Coruña",
      municipality: "Ferrol",
      source: "ip",
      confidence: "coarse",
    });
  });

  it("rejects locations without a usable province", () => {
    expect(normalizeDetectedLocation(null)).toBeNull();
    expect(normalizeDetectedLocation({})).toBeNull();
    expect(
      normalizeDetectedLocation({ province: "   " }),
    ).toBeNull();
  });
});
