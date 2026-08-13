const MAX_QUESTION_LENGTH = 220;

const QUESTIONS = {
  need_type: {
    question:
      "¿Sobre qué situación necesitas orientación principalmente?",

    quickReplies: [
      {
        id: "housing",
        label: "Vivienda",
        message:
          "Necesito orientación sobre vivienda",
      },
      {
        id: "employment",
        label: "Empleo",
        message:
          "Necesito orientación sobre empleo",
      },
      {
        id: "health",
        label: "Salud",
        message:
          "Necesito orientación relacionada con la salud",
      },
      {
        id: "care",
        label: "Cuidados",
        message:
          "Necesito orientación sobre cuidados o dependencia",
      },
      {
        id: "other",
        label: "Otra situación",
        message:
          "Quiero contarte otra situación",
      },
    ],
  },

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
    MAX_QUESTION_LENGTH
  );
}

export function buildClarification({
  missingDimension = "need_type",
  suggestedQuestion = null,
} = {}) {
  const policy =
    QUESTIONS[missingDimension] ||
    QUESTIONS.need_type;

  /*
   * Por ahora priorizamos la redacción canónica.
   * Más adelante una sugerencia de LLM podrá
   * aceptarse tras validación.
   */
  const question =
    cleanQuestion(policy.question);

  const quickReplies =
    Array.isArray(
      policy.quickReplies
    )
      ? policy.quickReplies.map(
          (reply) => ({
            id:
              reply.id,
            label:
              reply.label,
            message:
              reply.message,
          })
        )
      : [];

  return {
    needsClarification: true,
    clarificationQuestion: question,
    missingDimension:
      QUESTIONS[missingDimension]
        ? missingDimension
        : "need_type",
    quickReplies,
  };
}

export function validateClarificationQuestion(
  value
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
    (question.match(/\?/g) || []).length;

  if (questionMarks > 1) {
    return {
      valid: false,
      reason: "multiple_questions",
    };
  }

  return {
    valid: true,
    question,
  };
}

export const CLARIFICATION_DIMENSIONS =
  Object.freeze(
    Object.keys(QUESTIONS)
  );
