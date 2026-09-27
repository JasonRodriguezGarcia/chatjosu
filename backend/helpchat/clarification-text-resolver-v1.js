import {
  getClarificationNodeV1,
} from "./clarification-graph-v1.js";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9ñ]+/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

const CHOICE_PATTERNS =
  Object.freeze({
    need_type: {
      employment: [
        /\bempleo\b/,
        /\btrabajo\b/,
        /\blaboral\b/,
      ],

      health: [
        /\bsalud fisica\b/,
        /\benfermedad\b/,
        /\bmedic[oa]\b/,
      ],

      emotional_health: [
        /\bsalud emocional\b/,
        /\bsalud mental\b/,
        /\bemocional\b/,
        /\bansiedad\b/,
        /\bdepresion\b/,
      ],

      addiction: [
        /\balcohol\b/,
        /\badiccion/,
        /\bdrogas?\b/,
        /\bsustancias?\b/,
      ],
    },

    addiction_detail: {
      alcohol: [
        /\balcohol\b/,
        /\bbebida\b/,
      ],
      other_substance: [
        /\botra sustancia\b/,
        /\bsustancia\b/,
        /\bdroga[s]?\b/,
      ],
      other_behavior: [
        /\botra conducta\b/,
        /\bconducta\b/,
        /\bcomportamiento\b/,
      ],
    },

    mental_health_detail: {
      mood_anxiety: [
        /\bansiedad\b/,
        /\bansioso\b/,
        /\bansiosa\b/,
        /\banimo\b/,
        /\bdepresion\b/,
        /\bdeprimid[oa]\b/,
        /\btriste\b/,
      ],

      sleep: [
        /\bsueno\b/,
        /\bdormir\b/,
        /\bduerme\b/,
        /\binsomnio\b/,
      ],

      behavior_changes: [
        /\bcambio[s]? de conducta\b/,
        /\bcambio[s]? de comportamiento\b/,
        /\bconducta\b/,
        /\bcomportamiento\b/,
      ],
    },
  });

export function resolveClarificationTextV1({
  nodeId,
  inputMessage,
} = {}) {
  const node =
    getClarificationNodeV1(
      nodeId,
    );

  if (
    !node ||
    !Array.isArray(node.choices) ||
    node.choices.length === 0
  ) {
    return {
      status: "unresolved",
      nodeId:
        node?.id || null,
      choiceId: null,
      matches: [],
    };
  }

  const normalized =
    normalizeText(
      inputMessage,
    );

  if (!normalized) {
    return {
      status: "unresolved",
      nodeId: node.id,
      choiceId: null,
      matches: [],
    };
  }

  const patterns =
    CHOICE_PATTERNS[
      node.id
    ] || {};

  const matches =
    node.choices
      .filter((choice) => {
        const choicePatterns =
          patterns[
            choice.id
          ] || [];

        return choicePatterns.some(
          (pattern) =>
            pattern.test(
              normalized,
            ),
        );
      })
      .map(
        (choice) =>
          choice.id,
      );

  if (matches.length !== 1) {
    return {
      status:
        matches.length > 1
          ? "ambiguous"
          : "unresolved",
      nodeId: node.id,
      choiceId: null,
      matches,
    };
  }

  return {
    status: "resolved",
    nodeId: node.id,
    choiceId:
      matches[0],
    matches,
  };
}
