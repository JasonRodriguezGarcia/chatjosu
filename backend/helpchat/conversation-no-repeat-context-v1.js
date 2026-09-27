import {
  normalizeConversationContextV2,
} from "./conversation-context-v2.js";

import {
  getOpenClarificationPolicyV1,
} from "./open-clarification-policy-v1.js";

function canonicalContext(value) {
  return normalizeConversationContextV2(
    structuredClone(value),
  );
}

function pendingPerson(
  context,
  pending,
) {
  if (
    !context ||
    !pending ||
    typeof pending.personId !==
      "string"
  ) {
    return null;
  }

  return context.people.find(
    (person) =>
      person.id ===
      pending.personId,
  ) || null;
}

export function resolveNoRepeatContextV1({
  beforeContext,
  afterContext,
} = {}) {
  const before =
    canonicalContext(
      beforeContext,
    );

  const after =
    canonicalContext(
      afterContext,
    );

  const pending =
    before
      ?.pendingClarification ||
    null;

  if (!pending) {
    return {
      clarificationPurpose:
        null,
      dimensionResolved:
        false,
    };
  }

  const openPolicy =
    getOpenClarificationPolicyV1(
      pending.node,
    );

  const clarificationPurpose =
    typeof openPolicy?.purpose ===
      "string"
      ? openPolicy.purpose
      : null;

  const dimension =
    typeof pending.dimension ===
      "string"
      ? pending.dimension
      : null;

  const person =
    pendingPerson(
      after,
      pending,
    );

  const dimensionResolved =
    Boolean(
      dimension &&
      person
        ?.resolvedDimensions &&
      Object.prototype.hasOwnProperty.call(
        person.resolvedDimensions,
        dimension,
      )
    );

  return {
    clarificationPurpose,
    dimensionResolved,
  };
}
