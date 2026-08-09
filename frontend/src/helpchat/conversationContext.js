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

export const normalizeConversationContext = (value) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.version !== 1
  ) {
    return null;
  }

  return {
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
  };
};
