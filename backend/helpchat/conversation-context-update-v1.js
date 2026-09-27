import {
  normalizeConversationContextV1,
} from "./conversation-context-v1.js";

import {
  enrichConversationContextV1,
} from "./conversation-context-enricher-v1.js";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-ES")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTag(value) {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("es-ES");
}

function isContextUpdateLanguage(
  inputMessage
) {
  const text =
    normalizeText(
      inputMessage
    );

  return (
    /^(?:ella|el)\s+(?:vive|reside|esta|se encuentra)\b/
      .test(text) ||
    /^(?:vive|reside|esta|se encuentra)\s+en\b/
      .test(text) ||
    /^(?:perdon|corrijo|correccion|en realidad)\b/
      .test(text) ||
    /\bno es mi .{1,30}\bes mi\b/
      .test(text)
  );
}

export function updateConversationContextV1({
  conversationContext,
  inputMessage,
  selectedProvince,
  provinceMatcher,
} = {}) {
  const previousContext =
    normalizeConversationContextV1(
      conversationContext
    );

  const context =
    enrichConversationContextV1({
      conversationContext:
        previousContext,
      inputMessage,
      selectedProvince,
      provinceMatcher,
    });

  const relationshipChanged =
    context.subject.relationship !==
    previousContext.subject.relationship;

  const territoryChanged =
    context.territory.province !==
      previousContext.territory.province ||
    context.territory.municipality !==
      previousContext.territory.municipality;

  const hasPreviousNeed =
    previousContext.activeNeeds.length >
      0;

  const contextOnlyCandidate =
    hasPreviousNeed &&
    (
      relationshipChanged ||
      territoryChanged
    ) &&
    isContextUpdateLanguage(
      inputMessage
    );

  return {
    context,
    previousContext,

    changes: {
      relationshipChanged,
      territoryChanged,
    },

    contextOnlyCandidate,
  };
}

export function resolveSingleActiveOperationalTag({
  conversationContext,
  tags,
} = {}) {
  const context =
    normalizeConversationContextV1(
      conversationContext
    );

  const tagList =
    Array.isArray(tags)
      ? tags
      : [];

  const byName =
    new Map(
      tagList.map(
        (tag) => [
          normalizeTag(
            tag?.descripcion
          ),
          tag,
        ]
      )
    );

  const matches =
    context.activeNeeds
      .map(
        (need) =>
          byName.get(
            normalizeTag(
              need
            )
          )
      )
      .filter(Boolean);

  const unique =
    [
      ...new Map(
        matches.map(
          (tag) => [
            tag.tag_id,
            tag,
          ]
        )
      ).values(),
    ];

  return unique.length === 1
    ? unique[0]
    : null;
}

export function persistResolvedActiveNeed({
  conversationContext,
  tag,
} = {}) {
  const context =
    normalizeConversationContextV1(
      conversationContext
    );

  const description =
    typeof tag?.descripcion ===
      "string"
      ? tag.descripcion.trim()
      : "";

  if (!description) {
    return context;
  }

  const normalized =
    normalizeTag(
      description
    );

  const withoutDuplicate =
    context.activeNeeds.filter(
      (need) =>
        normalizeTag(
          need
        ) !== normalized
    );

  context.activeNeeds = [
    ...withoutDuplicate,
    description,
  ].slice(-6);

  return context;
}

export function preferContextResolution({
  understanding,
  contextUpdate,
  activeTag,
} = {}) {
  if (
    !contextUpdate
      ?.contextOnlyCandidate ||
    !activeTag
  ) {
    return understanding;
  }

  /*
   * Una nueva necesidad explícita
   * detectada por anchor gana a la
   * corrección contextual.
   */
  if (
    understanding?.status ===
      "resolved" &&
    understanding?.provider ===
      "anchor"
  ) {
    return understanding;
  }

  return {
    status: "resolved",
    tag: activeTag,
    context:
      contextUpdate.context,
    needsClarification: false,
    clarificationQuestion: null,
    provider: "context",
    model: "context-update-v1",
    durationMs: 0,
    diagnostics: null,
  };
}

export function persistResolvedActiveNeeds({
  conversationContext,
  tags = [],
}) {
  let next =
    conversationContext;

  for (
    const tag
    of tags
  ) {
    next =
      persistResolvedActiveNeed({
        conversationContext:
          next,
        tag,
      });
  }

  return next;
}
