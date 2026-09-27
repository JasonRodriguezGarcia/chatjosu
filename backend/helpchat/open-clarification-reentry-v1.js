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

const REENTRY_RULES =
  Object.freeze({
    addiction_behavior_detail: [
      {
        targetNode:
          "mental_health_detail",
        patterns: [
          /\bcambios? bruscos? de humor\b/,
          /\bcambios? de humor\b/,
          /\btemperamento\b/,
          /\birritab/,
          /\bansiedad\b/,
          /\bdepresion\b/,
          /\bdeprimid[oa]\b/,
          /\bestado de animo\b/,
          /\baltibajos? emocionales?\b/,
        ],
      },
    ],
  });

export function resolveOpenClarificationReentryV1({
  nodeId,
  inputMessage,
} = {}) {
  const text =
    normalizeText(inputMessage);

  if (!text) {
    return {
      status:
        "unresolved",
      sourceNode:
        nodeId || null,
      targetNode:
        null,
    };
  }

  const rules =
    REENTRY_RULES[nodeId] || [];

  const matches =
    rules.filter(
      (rule) =>
        rule.patterns.some(
          (pattern) =>
            pattern.test(text),
        ),
    );

  if (matches.length !== 1) {
    return {
      status:
        matches.length > 1
          ? "ambiguous"
          : "unresolved",
      sourceNode:
        nodeId || null,
      targetNode:
        null,
    };
  }

  return {
    status:
      "resolved",
    sourceNode:
      nodeId,
    targetNode:
      matches[0].targetNode,
  };
}
