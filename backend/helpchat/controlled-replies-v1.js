const CONTROLLED_REPLIES = Object.freeze({
  employment: {
    type: "resolved_need",
    resolvedNeeds: [
      {
        tag_id: 25,
        descripcion: "INSERCIÓN LABORAL",
        source: "controlled_reply",
      },
    ],
  },

  health: {
    type: "clarification",
    missingDimension: "health_detail",
  },

  emotional_health: {
    type: "clarification",
    missingDimension: "mental_health_detail",
  },

  addiction: {
    type: "clarification",
    missingDimension: "addiction_detail",
  },

  other: {
    type: "free_text",
  },
});

function cleanValue(value) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

export function resolveControlledReplyV1(
  value,
) {
  const key = cleanValue(value);

  if (!key) {
    return null;
  }

  const entry =
    CONTROLLED_REPLIES[key];

  if (!entry) {
    return null;
  }

  return structuredClone(entry);
}

export function isControlledReplyV1(
  value,
) {
  return Boolean(
    resolveControlledReplyV1(value),
  );
}

export const CONTROLLED_REPLY_VALUES_V1 =
  Object.freeze(
    Object.keys(CONTROLLED_REPLIES),
  );
