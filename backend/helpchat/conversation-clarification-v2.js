import {
  normalizeConversationContextV2,
} from "./conversation-context-v2.js";

import {
  getClarificationNodeV1,
} from "./clarification-graph-v1.js";

function canonicalContext(value) {
  return normalizeConversationContextV2(
    structuredClone(value),
  );
}

export function setPendingClarificationV2(
  value,
  {
    node,
    personId = null,
    mode = "choice",
    dimension = null,
  } = {},
) {
  const context =
    canonicalContext(value);

  if (
    !context ||
    typeof node !== "string" ||
    !getClarificationNodeV1(node)
  ) {
    return context;
  }

  const safePersonId =
    typeof personId === "string" &&
    context.people.some(
      (person) =>
        person.id === personId,
    )
      ? personId
      : null;

  context.pendingClarification = {
    node,
    personId:
      safePersonId,
    mode:
      mode === "free_text"
        ? "free_text"
        : "choice",
    ...(typeof dimension ===
      "string"
      ? {
          dimension,
        }
      : {}),
  };

  /*
   * El normalizador sigue siendo
   * autoridad sobre dimensiones válidas.
   */
  return canonicalContext(
    context,
  );
}

export function clearPendingClarificationV2(
  value,
) {
  const context =
    canonicalContext(value);

  if (!context) {
    return null;
  }

  context.pendingClarification =
    null;

  return context;
}
