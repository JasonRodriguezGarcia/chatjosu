const MAX_ITEMS = 12;
const MAX_ITEM_LENGTH = 180;
const MAX_RESOURCES = 20;

function cleanString(value, maxLength = MAX_ITEM_LENGTH) {
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
  } = {}
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const output = [];

  for (const item of value) {
    const cleaned = cleanString(
      item,
      maxLength
    );

    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLocaleLowerCase(
      "es-ES"
    );

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

export function createEmptyConversationContextV1() {
  return {
    version: 1,
    subject: {
      relationship: null,
    },
    activeNeeds: [],
    currentGoal: null,
    facts: [],
    constraints: [],
    territory: {
      province: null,
      municipality: null,
    },
    resourcesShown: [],
  };
}

export function normalizeConversationContextV1(
  value
) {
  const empty =
    createEmptyConversationContextV1();

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return empty;
  }

  return {
    version: 1,

    subject: {
      relationship: cleanString(
        value.subject?.relationship
      ),
    },

    activeNeeds: cleanStringArray(
      value.activeNeeds
    ),

    currentGoal: cleanString(
      value.currentGoal
    ),

    facts: cleanStringArray(
      value.facts
    ),

    constraints: cleanStringArray(
      value.constraints
    ),

    territory: {
      province: cleanString(
        value.territory?.province,
        80
      ),

      municipality: cleanString(
        value.territory?.municipality,
        120
      ),
    },

    resourcesShown: cleanStringArray(
      value.resourcesShown,
      {
        maxItems: MAX_RESOURCES,
        maxLength: 80,
      }
    ),
  };
}

export function buildSemanticTurnInput({
  inputMessage,
  conversationContext,
}) {
  const context =
    normalizeConversationContextV1(
      conversationContext
    );

  const parts = [
    `Mensaje actual: ${String(
      inputMessage || ""
    ).trim()}`,
  ];

  if (context.activeNeeds.length > 0) {
    parts.push(
      `Necesidades activas previas: ${
        context.activeNeeds.join("; ")
      }`
    );
  }

  if (context.currentGoal) {
    parts.push(
      `Objetivo actual: ${
        context.currentGoal
      }`
    );
  }

  if (context.subject.relationship) {
    parts.push(
      `Persona relacionada: ${
        context.subject.relationship
      }`
    );
  }

  if (context.facts.length > 0) {
    parts.push(
      `Hechos relevantes: ${
        context.facts.join("; ")
      }`
    );
  }

  if (context.constraints.length > 0) {
    parts.push(
      `Restricciones relevantes: ${
        context.constraints.join("; ")
      }`
    );
  }

  return parts.join("\n");
}
