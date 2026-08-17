function cleanString(
  value,
  maxLength = 220,
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const cleaned =
    value
      .replace(/\s+/g, " ")
      .trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(
    0,
    maxLength,
  );
}

function findTargetPerson({
  relationalContext,
  personId,
} = {}) {
  if (
    !personId ||
    !Array.isArray(
      relationalContext?.people
    )
  ) {
    return null;
  }

  return (
    relationalContext.people.find(
      (person) =>
        person?.id === personId
    ) || null
  );
}

export function buildClarificationQuestionIntentV1({
  understanding,
  relationalContext,
} = {}) {
  const canonicalQuestion =
    cleanString(
      understanding
        ?.clarificationQuestion,
    );

  if (
    !canonicalQuestion ||
    understanding
      ?.needsClarification !==
        true
  ) {
    return null;
  }

  const pending =
    relationalContext
      ?.pendingClarification &&
    typeof relationalContext
      .pendingClarification ===
      "object"
      ? relationalContext
          .pendingClarification
      : null;

  const targetPersonId =
    cleanString(
      pending?.personId,
      64,
    );

  const person =
    findTargetPerson({
      relationalContext,
      personId:
        targetPersonId,
    });

  const askFor =
    cleanString(
      pending?.dimension ||
      understanding
        ?.missingDimension ||
      pending?.node,
      80,
    );

  if (!askFor) {
    return null;
  }

  return {
    version: 1,
    action:
      "paraphrase_clarification",
    language:
      "es",
    askFor,
    node:
      cleanString(
        pending?.node,
        80,
      ),
    targetPersonId,
    relationship:
      cleanString(
        person?.relationship,
        80,
      ),
    canonicalQuestion,
  };
}
