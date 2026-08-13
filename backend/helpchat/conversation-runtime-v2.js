import {
  prepareConversationMemoryV2,
  persistPreparedResolvedNeedsV2,
  buildLegacyConversationContextV1,
} from "./conversation-memory-v2.js";

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
