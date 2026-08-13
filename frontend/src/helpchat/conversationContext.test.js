import { describe, expect, it } from "vitest";
import { normalizeConversationContext } from "./conversationContext";

describe("normalizeConversationContext", () => {
  it("rejects malformed contexts", () => {
    expect(normalizeConversationContext(null)).toBeNull();
    expect(normalizeConversationContext([])).toBeNull();
  });

  it("returns bounded provider-agnostic V1 state", () => {
    const result = normalizeConversationContext({
      version: 1,
      subject: { relationship: " madre " },
      activeNeeds: ["alzheimer", "alzheimer", "soledad"],
      currentGoal: " encontrar apoyo cercano ",
      facts: ["vive sola", "vive sola"],
      constraints: ["movilidad reducida"],
      territory: {
        province: " Burgos ",
        municipality: " Miranda de Ebro ",
      },
      resourcesShown: ["213", "213", "481"],
      provider: "must disappear",
      prompt: "must disappear",
    });

    expect(result).toEqual({
      version: 1,
      subject: { relationship: "madre" },
      activeNeeds: ["alzheimer", "soledad"],
      currentGoal: "encontrar apoyo cercano",
      facts: ["vive sola"],
      constraints: ["movilidad reducida"],
      territory: {
        province: "Burgos",
        municipality: "Miranda de Ebro",
      },
      resourcesShown: ["213", "481"],
    });

    expect(result.provider).toBeUndefined();
    expect(result.prompt).toBeUndefined();
  });
});

describe("normalizeConversationContext V2", () => {
  it("keeps bounded relational context without provider metadata", () => {
    const result = normalizeConversationContext({
      version: 2,
      people: [
        {
          id: "person_1",
          relationship: " hermano ",
          needs: ["ALCOHOLISMO", "ALCOHOLISMO", "EMPLEO"],
          facts: ["vive solo", "vive solo"],
          constraints: [],
        },
        {
          id: "person_2",
          relationship: " cuñado ",
          needs: ["VIVIENDA"],
        },
      ],
      currentFocus: "person_2",
      currentGoal: " encontrar apoyo ",
      territory: {
        province: " Burgos ",
        municipality: null,
      },
      resourcesShown: ["213", "213"],
      provider: "must disappear",
      prompt: "must disappear",
    });

    expect(result).toEqual({
      version: 2,
      people: [
        {
          id: "self",
          relationship: "self",
          needs: [],
          facts: [],
          constraints: [],
        },
        {
          id: "person_1",
          relationship: "hermano",
          needs: ["ALCOHOLISMO", "EMPLEO"],
          facts: ["vive solo"],
          constraints: [],
        },
        {
          id: "person_2",
          relationship: "cuñado",
          needs: ["VIVIENDA"],
          facts: [],
          constraints: [],
        },
      ],
      currentFocus: "person_2",
      currentGoal: "encontrar apoyo",
      territory: {
        province: "Burgos",
        municipality: null,
      },
      resourcesShown: ["213"],
    });

    expect(result.provider).toBeUndefined();
    expect(result.prompt).toBeUndefined();
  });

  it("keeps one self and rejects an invalid focus", () => {
    const result = normalizeConversationContext({
      version: 2,
      people: [
        {
          id: "self",
          relationship: "anything",
          facts: ["está cansada"],
        },
        {
          id: "person_1",
          relationship: "self",
          needs: ["SHOULD_DISAPPEAR"],
        },
      ],
      currentFocus: "person_404",
    });

    expect(result.people).toEqual([
      {
        id: "self",
        relationship: "self",
        needs: [],
        facts: ["está cansada"],
        constraints: [],
      },
    ]);

    expect(result.currentFocus).toBeNull();
  });

  it("rejects unsupported context versions", () => {
    expect(
      normalizeConversationContext({
        version: 3,
      }),
    ).toBeNull();
  });
});
