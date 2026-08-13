import {
  normalizeConversationContextV2,
} from "./conversation-context-v2.js";

const MAX_MESSAGE_LENGTH = 1200;
const MAX_FACTS = 4;
const MAX_CONSTRAINTS = 4;
const MAX_NEEDS = 6;
const MAX_PEOPLE = 8;

function cleanString(
  value,
  maxLength = 180,
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

  return cleaned.slice(
    0,
    maxLength,
  );
}

function cleanList(
  value,
  maxItems,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) =>
      cleanString(item),
    )
    .filter(Boolean)
    .slice(0, maxItems);
}

function focusedPerson(context) {
  if (!context?.currentFocus) {
    return null;
  }

  return (
    context.people.find(
      (person) =>
        person.id ===
        context.currentFocus,
    ) || null
  );
}

function baseTaskContext({
  task,
  inputMessage,
}) {
  return {
    version: 1,
    task,
    message:
      cleanString(
        inputMessage,
        MAX_MESSAGE_LENGTH,
      ) || "",
  };
}

export function buildNeedClassificationTaskContext({
  inputMessage,
  relationalContext,
} = {}) {
  const context =
    normalizeConversationContextV2(
      relationalContext,
    );

  const base =
    baseTaskContext({
      task:
        "classify_need",
      inputMessage,
    });

  if (!context) {
    return {
      ...base,
      focus: null,
    };
  }

  const focus =
    focusedPerson(context);

  return {
    ...base,

    focus:
      focus
        ? {
            relationship:
              focus.relationship,
            needs:
              cleanList(
                focus.needs,
                MAX_NEEDS,
              ),
            facts:
              cleanList(
                focus.facts,
                MAX_FACTS,
              ),
            constraints:
              cleanList(
                focus.constraints,
                MAX_CONSTRAINTS,
              ),
          }
        : null,
  };
}

export function buildSubjectResolutionTaskContext({
  inputMessage,
  relationalContext,
} = {}) {
  const context =
    normalizeConversationContextV2(
      relationalContext,
    );

  const base =
    baseTaskContext({
      task:
        "resolve_subject",
      inputMessage,
    });

  if (!context) {
    return {
      ...base,
      currentFocus: null,
      people: [],
    };
  }

  return {
    ...base,

    currentFocus:
      context.currentFocus,

    people:
      context.people
        .slice(
          0,
          MAX_PEOPLE,
        )
        .map(
          (person) => ({
            id:
              person.id,
            relationship:
              person.relationship,
          }),
        ),
  };
}

export function buildClarificationTaskContext({
  inputMessage,
  relationalContext,
  candidates = [],
} = {}) {
  const classification =
    buildNeedClassificationTaskContext({
      inputMessage,
      relationalContext,
    });

  return {
    ...classification,
    task:
      "clarify_need",

    candidates:
      Array.isArray(candidates)
        ? candidates
            .slice(0, 4)
            .map(
              (candidate) => ({
                tag:
                  cleanString(
                    candidate?.tag,
                    120,
                  ),
                score:
                  Number.isFinite(
                    candidate?.score,
                  )
                    ? candidate.score
                    : null,
              }),
            )
            .filter(
              (candidate) =>
                candidate.tag,
            )
        : [],
  };
}
