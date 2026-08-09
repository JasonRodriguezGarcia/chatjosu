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

  it("accepts numeric coordinate strings", () => {
    const url = buildAssociationMapUrl({
      latitude: "43.2630",
      longitude: "-2.9350",
    });

    expect(decodeURIComponent(url)).toContain(
      "43.263,-2.935",
    );
  });

  it("falls back when only latitude is available", () => {
    const url = buildAssociationMapUrl({
      latitude: 43.263,
      municipality: "Bilbao",
      province: "Bizkaia",
    });

    expect(decodeURIComponent(url)).toContain(
      "Bilbao, Bizkaia",
    );
  });

  it("falls back when only longitude is available", () => {
    const url = buildAssociationMapUrl({
      longitude: -2.935,
      municipality: "Bilbao",
      province: "Bizkaia",
    });

    expect(decodeURIComponent(url)).toContain(
      "Bilbao, Bizkaia",
    );
  });

  it("rejects latitude outside geographic bounds", () => {
    const url = buildAssociationMapUrl({
      latitude: 91,
      longitude: -2.935,
      province: "Bizkaia",
    });

    expect(decodeURIComponent(url)).toContain(
      "Bizkaia",
    );
  });

  it("rejects longitude outside geographic bounds", () => {
    const url = buildAssociationMapUrl({
      latitude: 43.263,
      longitude: 181,
      province: "Bizkaia",
    });

    expect(decodeURIComponent(url)).toContain(
      "Bizkaia",
    );
  });

  it("rejects non numeric coordinates", () => {
    const url = buildAssociationMapUrl({
      latitude: "unknown",
      longitude: "unknown",
      municipality: "Burgos",
      province: "Burgos",
    });

    expect(decodeURIComponent(url)).toContain(
      "Burgos, Burgos",
    );
  });

  it("supports province-only fallback", () => {
    const url = buildAssociationMapUrl({
      province: "A Coruña",
    });

    expect(decodeURIComponent(url)).toContain(
      "A Coruña",
    );
  });


  it("ignores consult-in-web placeholders and uses territory", () => {
    const url = buildAssociationMapUrl({
      address: "Consultar en web/sede",
      municipality: "Villarrobledo",
      province: "Albacete",
    });

    const decoded = decodeURIComponent(url);

    expect(decoded).toContain("Villarrobledo, Albacete");
    expect(decoded).not.toContain("Consultar");
  });

  it("ignores consult-sede placeholders and uses province", () => {
    const url = buildAssociationMapUrl({
      address: "(Consultar sede provincial)",
      province: "Almería",
    });

    const decoded = decodeURIComponent(url);

    expect(decoded).toContain("Almería");
    expect(decoded).not.toContain("Consultar");
  });

  it("keeps a real named venue address", () => {
    const url = buildAssociationMapUrl({
      address: "Casa de Asociaciones Itziar, C/ Zalburu",
      municipality: "Vitoria-Gasteiz",
      province: "Araba/Álava",
    });

    expect(decodeURIComponent(url)).toContain(
      "Casa de Asociaciones Itziar, C/ Zalburu",
    );
  });


  it("returns null when no location is available", () => {
    expect(
      buildAssociationMapUrl({ name: "Recurso remoto" }),
    ).toBeNull();
  });
});
