import {
  prepareConversationMemoryV2,
  persistPreparedResolvedNeedsV2,
  buildLegacyConversationContextV1,
} from "./conversation-memory-v2.js";

import {
  clearPendingClarificationV2,
  setPendingClarificationV2,
} from "./conversation-clarification-v2.js";

export function prepareHelpchatRuntimeContextV2({
  conversationContext,
  inputMessage,
} = {}) {
  const memory =
    prepareConversationMemoryV2({
      conversationContext,
      inputMessage,
    });

  return {
    status: memory.status,
    relationalContext:
      memory.context,
    legacyContext:
      buildLegacyConversationContextV1(
        memory.context,
      ),
    person:
      memory.person,
    personId:
      memory.person?.id ||
      null,
    relationship:
      memory.relationship,
    source:
      memory.source,
    relationships:
      memory.relationships || [],
  };
}

export function finalizeHelpchatRuntimeContextV2({
  relationalContext,
  personId,
  subjectStatus = "resolved",
  resolvedNeeds,
} = {}) {
  return persistPreparedResolvedNeedsV2({
    conversationContext:
      relationalContext,
    personId,
    subjectStatus,
    resolvedNeeds,
  });
}


export function applyClarificationTransitionV2({
  relationalContext,
  personId = null,
  sourceNode = null,
  action = null,
} = {}) {
  if (
    !action ||
    typeof action !== "object"
  ) {
    return relationalContext;
  }

  if (
    action.type === "goto" &&
    typeof action.node === "string"
  ) {
    return setPendingClarificationV2(
      relationalContext,
      {
        node: action.node,
        personId,
        mode: "choice",
      },
    );
  }

  if (
    action.type === "free_text" &&
    typeof sourceNode === "string"
  ) {
    return setPendingClarificationV2(
      relationalContext,
      {
        node: sourceNode,
        personId,
        mode: "free_text",
      },
    );
  }

  if (
    action.type === "resolve_need"
  ) {
    return clearPendingClarificationV2(
      relationalContext,
    );
  }

  return relationalContext;
}
