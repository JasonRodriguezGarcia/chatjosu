import {
  createEmptyConversationContextV2,
  migrateConversationContextV1ToV2,
  normalizeConversationContextV2,
  projectConversationContextV2ToV1,
} from "./conversation-context-v2.js";

import {
  addPersonNeed,
} from "./conversation-context-people-v2.js";

import {
  resolveConversationSubjectV2,
} from "./conversation-relations-v2.js";

function normalizeNeed(value) {
  if (
    value &&
    typeof value === "object" &&
    typeof value.descripcion === "string"
  ) {
    return value.descripcion.trim();
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
}

function canonicalContext(value) {
  const v2 =
    normalizeConversationContextV2(
      value,
    );

  if (v2) {
    return v2;
  }

  const migrated =
    migrateConversationContextV1ToV2(
      value,
    );

  if (migrated) {
    return migrated;
  }

  return createEmptyConversationContextV2();
}

export function prepareConversationMemoryV2({
  conversationContext,
  inputMessage,
} = {}) {
  const context =
    canonicalContext(
      conversationContext,
    );

  const subject =
    resolveConversationSubjectV2({
      conversationContext:
        context,
      inputMessage,
    });

  return {
    status:
      subject.status,
    context:
      subject.context,
    person:
      subject.person,
    relationship:
      subject.relationship ||
      null,
    source:
      subject.source ||
      null,
    relationships:
      subject.relationships ||
      [],
  };
}

export function persistPreparedResolvedNeedsV2({
  conversationContext,
  personId,
  resolvedNeeds = [],
  subjectStatus = "resolved",
} = {}) {
  const context =
    canonicalContext(
      conversationContext,
    );

  if (
    subjectStatus !== "resolved" ||
    typeof personId !== "string" ||
    !personId.trim()
  ) {
    return {
      status:
        subjectStatus ||
        "unresolved",
      context,
      person: null,
      needsPersisted: false,
    };
  }

  const existingPerson =
    context.people.find(
      (person) =>
        person.id === personId,
    ) || null;

  if (!existingPerson) {
    return {
      status: "unresolved",
      context,
      person: null,
      needsPersisted: false,
    };
  }

  let nextContext =
    context;

  let persistedCount = 0;

  for (
    const rawNeed of
    Array.isArray(resolvedNeeds)
      ? resolvedNeeds
      : []
  ) {
    const need =
      normalizeNeed(rawNeed);

    if (!need) {
      continue;
    }

    nextContext =
      addPersonNeed(
        nextContext,
        personId,
        need,
      );

    persistedCount += 1;
  }

  return {
    status: "resolved",
    context:
      nextContext,
    person:
      nextContext.people.find(
        (person) =>
          person.id === personId,
      ) || existingPerson,
    needsPersisted:
      persistedCount > 0,
  };
}

export function persistResolvedNeedsV2({
  conversationContext,
  inputMessage,
  resolvedNeeds = [],
} = {}) {
  const prepared =
    prepareConversationMemoryV2({
      conversationContext,
      inputMessage,
    });

  if (
    prepared.status !==
      "resolved" ||
    !prepared.person
  ) {
    return {
      ...prepared,
      needsPersisted: false,
    };
  }

  let context =
    prepared.context;

  for (
    const rawNeed of
    Array.isArray(resolvedNeeds)
      ? resolvedNeeds
      : []
  ) {
    const need =
      normalizeNeed(rawNeed);

    if (!need) {
      continue;
    }

    context =
      addPersonNeed(
        context,
        prepared.person.id,
        need,
      );
  }

  return {
    ...prepared,
    context,
    person:
      context.people.find(
        (person) =>
          person.id ===
          prepared.person.id,
      ) || prepared.person,
    needsPersisted: true,
  };
}

export function buildLegacyConversationContextV1(
  conversationContext,
) {
  return projectConversationContextV2ToV1(
    canonicalContext(
      conversationContext,
    ),
  );
}
