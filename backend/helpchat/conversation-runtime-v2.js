import {
  getClarificationNodeV1,
} from "./clarification-graph-v1.js";

import {
  prepareConversationMemoryV2,
  persistPreparedResolvedNeedsV2,
  buildLegacyConversationContextV1,
} from "./conversation-memory-v2.js";

import {
  clearPendingClarificationV2,
  setPendingClarificationV2,
} from "./conversation-clarification-v2.js";

import {
  setPersonResolvedDimension,
} from "./conversation-context-people-v2.js";

import {
  normalizeConversationContextV1,
} from "./conversation-context-v1.js";

import {
  normalizeConversationContextV2,
} from "./conversation-context-v2.js";

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
    const targetNode =
      getClarificationNodeV1(
        action.node,
      );

    const mode =
      Array.isArray(
        targetNode?.choices,
      ) &&
      targetNode.choices.length > 0
        ? "choice"
        : "free_text";

    return setPendingClarificationV2(
      relationalContext,
      {
        node: action.node,
        personId,
        mode,
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
    action.type ===
      "resolve_dimension" &&
    typeof action.dimension ===
      "string" &&
    typeof action.value ===
      "string" &&
    personId
  ) {
    const updated =
      setPersonResolvedDimension(
        relationalContext,
        personId,
        action.dimension,
        action.value,
      );

    return clearPendingClarificationV2(
      updated,
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

export function mergeLegacyGlobalsIntoRuntimeContextV2({
  relationalContext,
  legacyContext,
} = {}) {
  const relational =
    normalizeConversationContextV2(
      relationalContext,
    );

  if (!relational) {
    return relationalContext;
  }

  const legacy =
    normalizeConversationContextV1(
      legacyContext,
    );

  return normalizeConversationContextV2({
    ...relational,
    currentGoal:
      legacy.currentGoal,
    territory:
      legacy.territory,
    resourcesShown:
      legacy.resourcesShown,
  });
}

export function applyClarificationStateV2({
  relationalContext,
  personId = null,
  clarificationState = null,
} = {}) {
  if (
    !clarificationState ||
    typeof clarificationState !== "object" ||
    typeof clarificationState.node !== "string"
  ) {
    return relationalContext;
  }

  return setPendingClarificationV2(
    relationalContext,
    {
      node:
        clarificationState.node,
      personId,
      mode:
        clarificationState.mode === "free_text"
          ? "free_text"
          : "choice",
      dimension:
        typeof clarificationState
          .dimension === "string"
          ? clarificationState.dimension
          : null,
    },
  );
}
