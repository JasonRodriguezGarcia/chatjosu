import { describe, expect, it } from "vitest";
import { normalizeConversationContext } from "./conversationContext";

describe("normalizeConversationContext", () => {
  it("rejects malformed or unsupported contexts", () => {
    expect(normalizeConversationContext(null)).toBeNull();
    expect(normalizeConversationContext([])).toBeNull();
    expect(normalizeConversationContext({ version: 2 })).toBeNull();
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
