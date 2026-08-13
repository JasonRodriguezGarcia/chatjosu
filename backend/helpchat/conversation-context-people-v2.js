import {
  normalizeConversationContextV2,
} from "./conversation-context-v2.js";

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function comparisonKey(value) {
  return normalizeText(value)
    .toLocaleLowerCase("es-ES");
}

function cloneContext(value) {
  return normalizeConversationContextV2(
    structuredClone(value),
  );
}

function getPerson(
  context,
  personId,
) {
  return context.people.find(
    (person) =>
      person.id === personId,
  ) || null;
}

function nextPersonId(context) {
  const used = new Set(
    context.people.map(
      (person) => person.id,
    ),
  );

  let index = 1;

  while (
    used.has(`person_${index}`)
  ) {
    index += 1;
  }

  return `person_${index}`;
}

function addUniqueValue(
  values,
  value,
) {
  const cleaned =
    normalizeText(value);

  if (!cleaned) {
    return values;
  }

  const key =
    comparisonKey(cleaned);

  if (
    values.some(
      (item) =>
        comparisonKey(item) === key,
    )
  ) {
    return values;
  }

  return [
    ...values,
    cleaned,
  ];
}

function removeValue(
  values,
  value,
) {
  const key =
    comparisonKey(value);

  if (!key) {
    return values;
  }

  return values.filter(
    (item) =>
      comparisonKey(item) !== key,
  );
}

export function findPeopleByRelationship(
  value,
  relationship,
) {
  const context =
    normalizeConversationContextV2(
      value,
    );

  const key =
    comparisonKey(
      relationship,
    );

  if (!context || !key) {
    return [];
  }

  return context.people.filter(
    (person) =>
      person.id !== "self" &&
      comparisonKey(
        person.relationship,
      ) === key,
  );
}

export function createPerson(
  value,
  {
    relationship,
    preferredId = null,
  } = {},
) {
  const context =
    cloneContext(value);

  const cleanedRelationship =
    normalizeText(
      relationship,
    );

  if (
    !context ||
    !cleanedRelationship ||
    comparisonKey(
      cleanedRelationship,
    ) === "self"
  ) {
    return {
      context,
      person: null,
      created: false,
    };
  }

  const requestedId =
    normalizeText(
      preferredId,
    );

  const id =
    requestedId &&
    /^[A-Za-z0-9_-]+$/.test(
      requestedId,
    ) &&
    requestedId !== "self" &&
    !getPerson(
      context,
      requestedId,
    )
      ? requestedId
      : nextPersonId(
          context,
        );

  const person = {
    id,
    relationship:
      cleanedRelationship,
    needs: [],
    facts: [],
    constraints: [],
  };

  context.people.push(person);

  return {
    context,
    person,
    created: true,
  };
}

export function ensureSinglePersonByRelationship(
  value,
  relationship,
) {
  const context =
    cloneContext(value);

  if (!context) {
    return {
      context: null,
      person: null,
      status: "invalid_context",
    };
  }

  const matches =
    findPeopleByRelationship(
      context,
      relationship,
    );

  if (matches.length === 1) {
    return {
      context,
      person:
        matches[0],
      status: "existing",
    };
  }

  if (matches.length > 1) {
    return {
      context,
      person: null,
      status: "ambiguous",
    };
  }

  const created =
    createPerson(
      context,
      {
        relationship,
      },
    );

  return {
    context:
      created.context,
    person:
      created.person,
    status:
      created.created
        ? "created"
        : "invalid_relationship",
  };
}

export function setCurrentFocus(
  value,
  personId,
) {
  const context =
    cloneContext(value);

  if (!context) {
    return null;
  }

  if (
    personId === null
  ) {
    context.currentFocus =
      null;
    return context;
  }

  if (
    getPerson(
      context,
      personId,
    )
  ) {
    context.currentFocus =
      personId;
  }

  return context;
}

export function addPersonNeed(
  value,
  personId,
  need,
) {
  const context =
    cloneContext(value);

  const person =
    context &&
    getPerson(
      context,
      personId,
    );

  if (!person) {
    return context;
  }

  person.needs =
    addUniqueValue(
      person.needs,
      need,
    );

  return context;
}

export function removePersonNeed(
  value,
  personId,
  need,
) {
  const context =
    cloneContext(value);

  const person =
    context &&
    getPerson(
      context,
      personId,
    );

  if (!person) {
    return context;
  }

  person.needs =
    removeValue(
      person.needs,
      need,
    );

  return context;
}

export function addPersonFact(
  value,
  personId,
  fact,
) {
  const context =
    cloneContext(value);

  const person =
    context &&
    getPerson(
      context,
      personId,
    );

  if (!person) {
    return context;
  }

  person.facts =
    addUniqueValue(
      person.facts,
      fact,
    );

  return context;
}

export function replacePersonFact(
  value,
  personId,
  {
    previous,
    next,
  } = {},
) {
  const context =
    cloneContext(value);

  const person =
    context &&
    getPerson(
      context,
      personId,
    );

  if (!person) {
    return context;
  }

  person.facts =
    removeValue(
      person.facts,
      previous,
    );

  person.facts =
    addUniqueValue(
      person.facts,
      next,
    );

  return context;
}

export function addPersonConstraint(
  value,
  personId,
  constraint,
) {
  const context =
    cloneContext(value);

  const person =
    context &&
    getPerson(
      context,
      personId,
    );

  if (!person) {
    return context;
  }

  person.constraints =
    addUniqueValue(
      person.constraints,
      constraint,
    );

  return context;
}
