import {
  buildClarificationQuickRepliesV1,
  getClarificationNodeV1,
  listClarificationNodesV1,
} from "./clarification-graph-v1.js";

const MAX_QUESTION_LENGTH = 220;

const LEGACY_QUESTIONS = {
  symptom_domain: {
    question:
      "¿Te refieres sobre todo a problemas de memoria o desorientación, a cambios emocionales o de conducta, o a otra situación?",
  },

  territory: {
    question:
      "¿En qué provincia necesita la ayuda la persona?",
  },

  goal: {
    question:
      "¿Qué tipo de orientación o recurso estás buscando?",
  },

  subject: {
    question:
      "¿Para quién estás buscando la ayuda?",

    quickReplies: [
      {
        id: "self",
        label: "Para mí",
        message:
          "Busco ayuda para mí",
      },
      {
        id: "other_person",
        label: "Para otra persona",
        message:
          "Busco ayuda para otra persona",
      },
    ],
  },

  multiple_needs: {
    question:
      "¿Cuál de estas necesidades quieres que atendamos primero?",
  },
};

function cleanQuestion(value) {
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
    MAX_QUESTION_LENGTH,
  );
}

function cloneQuickReplies(
  value,
) {
  return Array.isArray(value)
    ? value.map(
        (reply) => ({
          id:
            reply.id,
          label:
            reply.label,
          message:
            reply.message,
          ...(reply.controlledReply
            ? {
                controlledReply:
                  structuredClone(
                    reply.controlledReply,
                  ),
              }
            : {}),
        }),
      )
    : [];
}

export function buildClarification({
  missingDimension = "need_type",
  suggestedQuestion = null,
} = {}) {
  const graphNode =
    getClarificationNodeV1(
      missingDimension,
    );

  if (graphNode) {
    return {
      needsClarification: true,
      clarificationQuestion:
        cleanQuestion(
          graphNode.question,
        ),
      missingDimension:
        graphNode.id,
      quickReplies:
        buildClarificationQuickRepliesV1(
          graphNode.id,
        ),
    };
  }

  const legacy =
    LEGACY_QUESTIONS[
      missingDimension
    ];

  if (legacy) {
    return {
      needsClarification: true,
      clarificationQuestion:
        cleanQuestion(
          legacy.question,
        ),
      missingDimension,
      quickReplies:
        cloneQuickReplies(
          legacy.quickReplies,
        ),
    };
  }

  const fallback =
    getClarificationNodeV1(
      "need_type",
    );

  return {
    needsClarification: true,
    clarificationQuestion:
      cleanQuestion(
        fallback.question,
      ),
    missingDimension:
      "need_type",
    quickReplies:
      buildClarificationQuickRepliesV1(
        "need_type",
      ),
  };
}

export function validateClarificationQuestion(
  value,
) {
  const question =
    cleanQuestion(value);

  if (!question) {
    return {
      valid: false,
      reason: "empty",
    };
  }

  if (
    question.length >
    MAX_QUESTION_LENGTH
  ) {
    return {
      valid: false,
      reason: "too_long",
    };
  }

  const questionMarks =
    (
      question.match(
        /\?/g,
      ) || []
    ).length;

  if (questionMarks > 1) {
    return {
      valid: false,
      reason:
        "multiple_questions",
    };
  }

  return {
    valid: true,
    question,
  };
}

export const CLARIFICATION_DIMENSIONS =
  Object.freeze([
    ...listClarificationNodesV1(),
    ...Object.keys(
      LEGACY_QUESTIONS,
    ),
  ]);
