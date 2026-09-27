import { describe, expect, it } from "vitest";
import {
  findDetectedProvince,
  normalizeDetectedLocation,
  normalizeProvinceOption,
} from "./location";

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
      provinceKey: null,
      province: "A Coruña",
      municipality: "Ferrol",
      source: "ip",
      confidence: "coarse",
    });
  });

  it("preserves a canonical province key", () => {
    expect(
      normalizeDetectedLocation({
        country: "ES",
        provinceKey: " A CORUNA ",
        province: "A Coruña",
      }),
    ).toEqual({
      country: "ES",
      provinceKey: "A CORUNA",
      province: "A Coruña",
      municipality: null,
      source: "ip",
      confidence: "coarse",
    });
  });

  it("accepts a location identified only by province key", () => {
    expect(
      normalizeDetectedLocation({
        provinceKey: "VIZCAYA",
      }),
    ).toEqual({
      country: null,
      provinceKey: "VIZCAYA",
      province: null,
      municipality: null,
      source: "ip",
      confidence: "coarse",
    });
  });

  it("rejects an unavailable silent location response", () => {
    expect(
      normalizeDetectedLocation({
        province: null,
        source: "unavailable",
        confidence: "none",
      }),
    ).toBeNull();
  });

  it("rejects locations without a usable province identity", () => {
    expect(normalizeDetectedLocation(null)).toBeNull();
    expect(normalizeDetectedLocation({})).toBeNull();
    expect(
      normalizeDetectedLocation({
        province: "   ",
        provinceKey: "   ",
      }),
    ).toBeNull();
  });
});

describe("normalizeProvinceOption", () => {
  it("keeps legacy label-only province options compatible", () => {
    expect(
      normalizeProvinceOption({
        label: "Burgos",
      }),
    ).toEqual({
      label: "Burgos",
      provinceKey: null,
    });
  });

  it("preserves provinceKey on the future contract", () => {
    expect(
      normalizeProvinceOption({
        provinceKey: "A CORUNA",
        label: "A Coruña",
      }),
    ).toEqual({
      provinceKey: "A CORUNA",
      label: "A Coruña",
    });
  });
});

describe("findDetectedProvince", () => {
  const provinces = [
    {
      provinceKey: "A CORUNA",
      label: "A Coruña",
    },
    {
      provinceKey: "VIZCAYA",
      label: "Bizkaia",
    },
  ];

  it("matches by canonical province key before display label", () => {
    expect(
      findDetectedProvince(provinces, {
        provinceKey: "VIZCAYA",
        province: "Vizcaya",
      }),
    ).toEqual({
      provinceKey: "VIZCAYA",
      label: "Bizkaia",
    });
  });

  it("falls back to the display label for the legacy contract", () => {
    expect(
      findDetectedProvince(
        [{ label: "Gipuzkoa" }],
        { province: "Gipuzkoa" },
      ),
    ).toEqual({
      label: "Gipuzkoa",
    });
  });

  it("does not guess aliases in the frontend", () => {
    expect(
      findDetectedProvince(provinces, {
        province: "Vizcaya",
      }),
    ).toBeNull();
  });
});
