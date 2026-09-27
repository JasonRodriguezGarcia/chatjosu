const cleanString = (value, maxLength = 180) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
};

const cleanList = (value, limit) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((item) => cleanString(item))
    .filter(Boolean);

  return [...new Set(normalized)].slice(0, limit);
};

const normalizeConversationContextV1 = (value) => ({
  version: 1,
  subject: {
    relationship: cleanString(value.subject?.relationship),
  },
  activeNeeds: cleanList(value.activeNeeds, 8),
  currentGoal: cleanString(value.currentGoal),
  facts: cleanList(value.facts, 12),
  constraints: cleanList(value.constraints, 8),
  territory: {
    province: cleanString(value.territory?.province),
    municipality: cleanString(value.territory?.municipality),
  },
  resourcesShown: cleanList(value.resourcesShown, 12),
});

const normalizeConversationPersonV2 = (value) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const id = cleanString(value.id, 64);

  if (
    !id ||
    !/^[A-Za-z0-9_-]+$/.test(id)
  ) {
    return null;
  }

  const relationship =
    id === "self"
      ? "self"
      : cleanString(value.relationship, 80);

  if (
    id !== "self" &&
    relationship?.toLocaleLowerCase("es-ES") === "self"
  ) {
    return null;
  }

  return {
    id,
    relationship,
    needs: cleanList(value.needs, 12),
    facts: cleanList(value.facts, 12),
    constraints: cleanList(value.constraints, 12),
  };
};

const normalizePendingClarificationV2 = (
  value,
  validPersonIds,
) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const node =
    cleanString(value.node, 80);

  if (!node) {
    return null;
  }

  const requestedPersonId =
    cleanString(
      value.personId,
      64,
    );

  const personId =
    requestedPersonId &&
    validPersonIds.has(
      requestedPersonId,
    )
      ? requestedPersonId
      : null;

  return {
    node,
    personId,
    mode:
      value.mode === "free_text"
        ? "free_text"
        : "choice",
  };
};

const normalizeConversationContextV2 = (value) => {
  const people = [];
  const seenIds = new Set();

  for (
    const rawPerson of Array.isArray(value.people)
      ? value.people
      : []
  ) {
    const person =
      normalizeConversationPersonV2(rawPerson);

    if (
      !person ||
      seenIds.has(person.id)
    ) {
      continue;
    }

    seenIds.add(person.id);
    people.push(person);

    if (people.length >= 12) {
      break;
    }
  }

  if (!seenIds.has("self")) {
    people.unshift({
      id: "self",
      relationship: "self",
      needs: [],
      facts: [],
      constraints: [],
    });

    seenIds.add("self");
  }

  people.sort((left, right) => {
    if (left.id === "self") {
      return -1;
    }

    if (right.id === "self") {
      return 1;
    }

    return 0;
  });

  const requestedFocus =
    cleanString(value.currentFocus, 64);

  const currentFocus =
    requestedFocus &&
    seenIds.has(requestedFocus)
      ? requestedFocus
      : null;

  return {
    version: 2,
    people,
    currentFocus,
    currentGoal: cleanString(value.currentGoal),
    pendingClarification:
      normalizePendingClarificationV2(
        value.pendingClarification,
        seenIds,
      ),
    territory: {
      province: cleanString(value.territory?.province),
      municipality: cleanString(value.territory?.municipality),
    },
    resourcesShown: cleanList(value.resourcesShown, 12),
  };
};

export const normalizeConversationContext = (value) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  if (value.version === 1) {
    return normalizeConversationContextV1(value);
  }

  if (value.version === 2) {
    return normalizeConversationContextV2(value);
  }

  return null;
};
