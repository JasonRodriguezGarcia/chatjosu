import { describe, expect, it } from "vitest";
import { buildAssociationMapUrl } from "./mapLocation";

describe("buildAssociationMapUrl", () => {
  it("prefers exact coordinates when both are available", () => {
    const url = buildAssociationMapUrl({
      latitude: 42.6865,
      longitude: -2.947,
      address: "Dirección que no debe usarse",
    });

    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=42.6865%2C-2.947",
    );
  });

  it("falls back to textual territorial information", () => {
    const url = buildAssociationMapUrl({
      address: "C/ Condes de Montarco, 2",
      municipality: "Miranda de Ebro",
      province: "Burgos",
    });

    expect(url).toContain("google.com/maps/search");
    expect(decodeURIComponent(url)).toContain(
      "C/ Condes de Montarco, 2, Miranda de Ebro, Burgos",
    );
  });

  it("preserves useful Spanish location names", () => {
    const url = buildAssociationMapUrl({
      municipality: "A Coruña",
      province: "A Coruña",
    });

    expect(decodeURIComponent(url)).toContain(
      "A Coruña, A Coruña",
    );
  });

  it("returns null when no location is available", () => {
    expect(
      buildAssociationMapUrl({ name: "Recurso remoto" }),
    ).toBeNull();
  });
});
