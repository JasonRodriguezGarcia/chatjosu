import {
  createEmptyConversationContextV2,
  normalizeConversationContextV2,
} from "./conversation-context-v2.js";

import {
  createPerson,
  ensureSinglePersonByRelationship,
  findPeopleByRelationship,
  setCurrentFocus,
} from "./conversation-context-people-v2.js";

const RELATIONSHIPS = [
  ["madre", /\bmi madre\b/],
  ["padre", /\bmi padre\b/],
  ["hermana", /\bmi hermana\b/],
  ["hermano", /\bmi hermano\b/],
  ["hija", /\bmi hija\b/],
  ["hijo", /\bmi hijo\b/],
  ["abuela", /\bmi abuela\b/],
  ["abuelo", /\bmi abuelo\b/],
  ["tía", /\bmi tia\b/],
  ["tío", /\bmi tio\b/],
  ["pareja", /\bmi pareja\b/],
  ["mujer", /\bmi mujer\b/],
  ["marido", /\bmi marido\b/],
  ["cuñada", /\bmi cunada\b/],
  ["cuñado", /\bmi cunado\b/],
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-ES")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractExplicitRelationships(
  inputMessage,
) {
  const text =
    normalizeText(inputMessage);

  return RELATIONSHIPS
    .filter(([, pattern]) =>
      pattern.test(text),
    )
    .map(([relationship]) =>
      relationship,
    );
}

function extractOtherRelationship(
  inputMessage,
) {
  const text =
    normalizeText(inputMessage);

  const match = text.match(
    /\bmi otr[oa]\s+(madre|padre|hermana|hermano|hija|hijo|abuela|abuelo|tia|tio|pareja|mujer|marido|cunada|cunado)\b/,
  );

  if (!match?.[1]) {
    return null;
  }

  const aliases = {
    tia: "tía",
    tio: "tío",
    cunada: "cuñada",
    cunado: "cuñado",
  };

  return (
    aliases[match[1]] ||
    match[1]
  );
}

function extractFocusRelationship(
  inputMessage,
) {
  const text =
    normalizeText(inputMessage);

  const patterns = [
    /\bvolvamos?\s+a\s+(?:lo\s+de\s+)?mi\s+(madre|padre|hermana|hermano|hija|hijo|abuela|abuelo|tia|tio|pareja|mujer|marido|cunada|cunado)\b/,
    /\bquiero\s+(?:volver|seguir)\s+(?:con|hablando de)\s+mi\s+(madre|padre|hermana|hermano|hija|hijo|abuela|abuelo|tia|tio|pareja|mujer|marido|cunada|cunado)\b/,
    /\b(?:empecemos|sigamos)\s+(?:por|con)\s+mi\s+(madre|padre|hermana|hermano|hija|hijo|abuela|abuelo|tia|tio|pareja|mujer|marido|cunada|cunado)\b/,
  ];

  for (const pattern of patterns) {
    const match =
      text.match(pattern);

    if (!match?.[1]) {
      continue;
    }

    const aliases = {
      tia: "tía",
      tio: "tío",
      cunada: "cuñada",
      cunado: "cuñado",
    };

    return (
      aliases[match[1]] ||
      match[1]
    );
  }

  return null;
}

function usesContextualPronoun(
  inputMessage,
) {
  const text =
    normalizeText(inputMessage);

  return (
    /^(?:el|ella)\b/.test(text) ||
    /\b(?:sobre|para|con)\s+(?:el|ella)\b/
      .test(text)
  );
}

function safeContext(value) {
  return (
    normalizeConversationContextV2(
      value,
    ) ||
    createEmptyConversationContextV2()
  );
}

export function resolveConversationSubjectV2({
  conversationContext,
  inputMessage,
} = {}) {
  let context =
    safeContext(
      conversationContext,
    );

  const otherRelationship =
    extractOtherRelationship(
      inputMessage,
    );

  if (otherRelationship) {
    const created =
      createPerson(
        context,
        {
          relationship:
            otherRelationship,
        },
      );

    if (!created.person) {
      return {
        status:
          "unresolved",
        context,
        person: null,
        relationship:
          otherRelationship,
        source:
          "explicit_other",
      };
    }

    context =
      setCurrentFocus(
        created.context,
        created.person.id,
      );

    return {
      status: "resolved",
      context,
      person:
        created.person,
      relationship:
        otherRelationship,
      source:
        "explicit_other",
    };
  }

  const focusRelationship =
    extractFocusRelationship(
      inputMessage,
    );

  if (focusRelationship) {
    const matches =
      findPeopleByRelationship(
        context,
        focusRelationship,
      );

    if (matches.length > 1) {
      return {
        status:
          "ambiguous_subject",
        context,
        person: null,
        relationship:
          focusRelationship,
        source:
          "focus_relationship",
      };
    }

    const ensured =
      ensureSinglePersonByRelationship(
        context,
        focusRelationship,
      );

    if (!ensured.person) {
      return {
        status:
          ensured.status ===
          "ambiguous"
            ? "ambiguous_subject"
            : "unresolved",
        context:
          ensured.context ||
          context,
        person: null,
        relationship:
          focusRelationship,
        source:
          "focus_relationship",
      };
    }

    context =
      setCurrentFocus(
        ensured.context,
        ensured.person.id,
      );

    return {
      status: "resolved",
      context,
      person:
        ensured.person,
      relationship:
        focusRelationship,
      source:
        "focus_relationship",
    };
  }

  const explicit =
    extractExplicitRelationships(
      inputMessage,
    );

  if (explicit.length > 1) {
    return {
      status:
        "multiple_subjects",
      context,
      person: null,
      relationship: null,
      relationships:
        explicit,
      source:
        "explicit_multiple",
    };
  }

  if (explicit.length === 1) {
    const relationship =
      explicit[0];

    const matches =
      findPeopleByRelationship(
        context,
        relationship,
      );

    if (matches.length > 1) {
      return {
        status:
          "ambiguous_subject",
        context,
        person: null,
        relationship,
        source:
          "explicit_relationship",
      };
    }

    const ensured =
      ensureSinglePersonByRelationship(
        context,
        relationship,
      );

    if (!ensured.person) {
      return {
        status:
          ensured.status ===
          "ambiguous"
            ? "ambiguous_subject"
            : "unresolved",
        context:
          ensured.context ||
          context,
        person: null,
        relationship,
        source:
          "explicit_relationship",
      };
    }

    context =
      setCurrentFocus(
        ensured.context,
        ensured.person.id,
      );

    return {
      status: "resolved",
      context,
      person:
        ensured.person,
      relationship,
      source:
        "explicit_relationship",
    };
  }

  if (
    usesContextualPronoun(
      inputMessage,
    )
  ) {
    const focus =
      context.currentFocus
        ? context.people.find(
            (person) =>
              person.id ===
              context.currentFocus,
          )
        : null;

    if (!focus) {
      return {
        status:
          "ambiguous_subject",
        context,
        person: null,
        relationship: null,
        source:
          "pronoun",
      };
    }

    return {
      status: "resolved",
      context,
      person: focus,
      relationship:
        focus.relationship,
      source:
        "pronoun",
    };
  }

  const focus =
    context.currentFocus
      ? context.people.find(
          (person) =>
            person.id ===
            context.currentFocus,
        )
      : null;

  if (focus) {
    return {
      status:
        "resolved",
      context,
      person: focus,
      relationship:
        focus.relationship,
      source:
        "current_focus",
    };
  }

  return {
    status: "unresolved",
    context,
    person: null,
    relationship: null,
    source: null,
  };
}
