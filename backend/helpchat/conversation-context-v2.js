import {
  createEmptyConversationContextV1,
  normalizeConversationContextV1,
} from "./conversation-context-v1.js";

const MAX_PEOPLE = 12;
const MAX_ITEMS = 12;
const MAX_ITEM_LENGTH = 180;
const MAX_RESOURCES = 20;
const MAX_PERSON_ID = 64;

function cleanString(
  value,
  maxLength = MAX_ITEM_LENGTH,
) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(0, maxLength);
}

function cleanStringArray(
  value,
  {
    maxItems = MAX_ITEMS,
    maxLength = MAX_ITEM_LENGTH,
  } = {},
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const output = [];

  for (const item of value) {
    const cleaned = cleanString(
      item,
      maxLength,
    );

    if (!cleaned) {
      continue;
    }

    const key =
      cleaned.toLocaleLowerCase("es-ES");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(cleaned);

    if (output.length >= maxItems) {
      break;
    }
  }

  return output;
}

function cleanPersonId(value) {
  const cleaned = cleanString(
    value,
    MAX_PERSON_ID,
  );

  if (
    !cleaned ||
    !/^[A-Za-z0-9_-]+$/.test(cleaned)
  ) {
    return null;
  }

  return cleaned;
}

function emptySelf() {
  return {
    id: "self",
    relationship: "self",
    needs: [],
    facts: [],
    constraints: [],
  };
}

function normalizePerson(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const id = cleanPersonId(value.id);

  if (!id) {
    return null;
  }

  const relationship =
    id === "self"
      ? "self"
      : cleanString(
          value.relationship,
          80,
        );

  /*
   * Solo el ID reservado "self" puede
   * representar a la persona usuaria.
   */
  if (
    id !== "self" &&
    relationship
      ?.toLocaleLowerCase("es-ES") ===
      "self"
  ) {
    return null;
  }

  return {
    id,
    relationship,
    needs: cleanStringArray(
      value.needs,
    ),
    facts: cleanStringArray(
      value.facts,
    ),
    constraints: cleanStringArray(
      value.constraints,
    ),
  };
}

export function createEmptyConversationContextV2() {
  return {
    version: 2,
    people: [
      emptySelf(),
    ],
    currentFocus: null,
    currentGoal: null,
    territory: {
      province: null,
      municipality: null,
    },
    resourcesShown: [],
  };
}

export function normalizeConversationContextV2(
  value,
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.version !== 2
  ) {
    return null;
  }

  const people = [];
  const seenIds = new Set();

  for (
    const rawPerson of
    Array.isArray(value.people)
      ? value.people
      : []
  ) {
    const person =
      normalizePerson(rawPerson);

    if (
      !person ||
      seenIds.has(person.id)
    ) {
      continue;
    }

    seenIds.add(person.id);
    people.push(person);

    if (
      people.length >= MAX_PEOPLE
    ) {
      break;
    }
  }

  if (!seenIds.has("self")) {
    people.unshift(
      emptySelf(),
    );
    seenIds.add("self");
  }

  /*
   * Asegura que self sea único y
   * aparezca siempre primero.
   */
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
    cleanPersonId(
      value.currentFocus,
    );

  const currentFocus =
    requestedFocus &&
    seenIds.has(requestedFocus)
      ? requestedFocus
      : null;

  return {
    version: 2,
    people,
    currentFocus,
    currentGoal: cleanString(
      value.currentGoal,
    ),
    territory: {
      province: cleanString(
        value.territory?.province,
        80,
      ),
      municipality: cleanString(
        value.territory?.municipality,
        120,
      ),
    },
    resourcesShown:
      cleanStringArray(
        value.resourcesShown,
        {
          maxItems: MAX_RESOURCES,
          maxLength: 80,
        },
      ),
  };
}

export function migrateConversationContextV1ToV2(
  value,
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.version !== 1
  ) {
    return null;
  }

  const legacy =
    normalizeConversationContextV1(
      value,
    );

  const relationship =
    legacy.subject.relationship;

  const hasSubjectState =
    legacy.activeNeeds.length > 0 ||
    legacy.facts.length > 0 ||
    legacy.constraints.length > 0;

  const targetId =
    relationship
      ? "person_1"
      : "self";

  const target = {
    id: targetId,
    relationship:
      relationship || "self",
    needs: legacy.activeNeeds,
    facts: legacy.facts,
    constraints:
      legacy.constraints,
  };

  const people =
    targetId === "self"
      ? [target]
      : [
          emptySelf(),
          target,
        ];

  return normalizeConversationContextV2({
    version: 2,
    people,
    currentFocus:
      relationship ||
      hasSubjectState
        ? targetId
        : null,
    currentGoal:
      legacy.currentGoal,
    territory:
      legacy.territory,
    resourcesShown:
      legacy.resourcesShown,
  });
}

export function projectConversationContextV2ToV1(
  value,
) {
  const context =
    normalizeConversationContextV2(
      value,
    );

  if (!context) {
    return createEmptyConversationContextV1();
  }

  const focus =
    context.currentFocus
      ? context.people.find(
          (person) =>
            person.id ===
            context.currentFocus,
        )
      : null;

  return normalizeConversationContextV1({
    version: 1,
    subject: {
      relationship:
        focus &&
        focus.id !== "self"
          ? focus.relationship
          : null,
    },
    activeNeeds:
      focus?.needs || [],
    currentGoal:
      context.currentGoal,
    facts:
      focus?.facts || [],
    constraints:
      focus?.constraints || [],
    territory:
      context.territory,
    resourcesShown:
      context.resourcesShown,
  });
}
