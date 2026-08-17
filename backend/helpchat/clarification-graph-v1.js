const ACTION_TYPES = Object.freeze({
  RESOLVE_NEED: "resolve_need",
  GOTO: "goto",
  FREE_TEXT: "free_text",
});

const NODES = Object.freeze({
  need_type: {
    id: "need_type",
    question:
      "¿Sobre qué situación necesitas orientación principalmente?",
    choices: [
      {
        id: "employment",
        label: "Empleo",
        message:
          "Necesito orientación sobre empleo",
        action: {
          type: "resolve_need",
          resolvedNeeds: [
            {
              tag_id: 25,
              descripcion:
                "INSERCIÓN LABORAL",
            },
          ],
        },
      },
      {
        id: "health",
        label:
          "Salud o enfermedad",
        message:
          "Necesito orientación sobre salud o una enfermedad",
        action: {
          type: "goto",
          node:
            "health_detail",
        },
      },
      {
        id:
          "emotional_health",
        label:
          "Salud emocional",
        message:
          "Necesito orientación sobre salud emocional",
        action: {
          type: "goto",
          node:
            "mental_health_detail",
        },
      },
      {
        id: "addiction",
        label:
          "Alcohol u otras adicciones",
        message:
          "Necesito orientación sobre alcohol u otras adicciones",
        action: {
          type: "goto",
          node:
            "addiction_detail",
        },
      },
      {
        id: "other",
        label:
          "Otra situación",
        message:
          "Quiero contarte otra situación",
        action: {
          type:
            "free_text",
        },
      },
    ],
  },

  health_detail: {
    id: "health_detail",
    question:
      "¿Qué enfermedad, problema de salud o situación concreta estáis viviendo?",
    choices: [],
  },

  cancer_age: {
    id: "cancer_age",
    question:
      "¿Qué edad tiene la persona con cáncer?",
    choices: [],
  },

  mental_health_detail: {
    id:
      "mental_health_detail",
    question:
      "¿Qué es lo que más te preocupa: el ánimo o la ansiedad, el sueño, cambios de conducta, u otra situación?",
    choices: [
      {
        id:
          "mood_anxiety",
        label:
          "Ánimo o ansiedad",
        message:
          "Lo que más preocupa es el ánimo o la ansiedad",
        action: {
          type:
            "resolve_need",
          resolvedNeeds: [
            {
              tag_id: 31,
              descripcion:
                "SALUD MENTAL",
            },
          ],
        },
      },
      {
        id: "sleep",
        label: "Sueño",
        message:
          "Lo que más preocupa es el sueño",
        action: {
          type:
            "resolve_need",
          resolvedNeeds: [
            {
              tag_id: 31,
              descripcion:
                "SALUD MENTAL",
            },
          ],
        },
      },
      {
        id:
          "behavior_changes",
        label:
          "Cambios de conducta",
        message:
          "Lo que más preocupa son los cambios de conducta",
        action: {
          type: "goto",
          node:
            "mental_behavior_detail",
          resolvedNeeds: [
            {
              tag_id: 31,
              descripcion:
                "SALUD MENTAL",
            },
          ],
        },
      },
      {
        id:
          "mental_other",
        label:
          "Otra situación",
        message:
          "Quiero contarte otra situación relacionada con la salud emocional",
        action: {
          type:
            "free_text",
        },
      },
    ],
  },

  mental_behavior_detail: {
    id:
      "mental_behavior_detail",
    question:
      "¿Qué cambios de conducta has notado y desde cuándo están ocurriendo?",
    choices: [],
  },

  addiction_detail: {
    id: "addiction_detail",
    question:
      "¿El problema está relacionado con alcohol, con otra sustancia o con otra conducta?",
    choices: [
      {
        id: "alcohol",
        label: "Alcohol",
        message:
          "El problema está relacionado con alcohol",
        action: {
          type:
            ACTION_TYPES.RESOLVE_NEED,
          resolvedNeeds: [
            {
              tag_id: 2,
              descripcion:
                "ALCOHOLISMO",
            },
          ],
        },
      },
      {
        id: "other_substance",
        label: "Otra sustancia",
        message:
          "El problema está relacionado con otra sustancia",
        action: {
          type:
            ACTION_TYPES.GOTO,
          node:
            "addiction_substance_detail",
        },
      },
      {
        id: "other_behavior",
        label: "Otra conducta",
        message:
          "El problema está relacionado con otra conducta",
        action: {
          type:
            ACTION_TYPES.GOTO,
          node:
            "addiction_behavior_detail",
        },
      },
    ],
  },


  addiction_substance_detail: {
    id:
      "addiction_substance_detail",
    question:
      "¿Con qué sustancia está relacionado y qué está ocurriendo?",
    choices: [],
  },

  addiction_behavior_detail: {
    id:
      "addiction_behavior_detail",
    question:
      "¿Con qué conducta está relacionado y qué está ocurriendo?",
    choices: [],
  },

  free_text: {
    id: "free_text",
    question:
      "Cuéntame con tus propias palabras qué está pasando.",
    choices: [],
  },
});

function clone(value) {
  return structuredClone(value);
}

export function getClarificationNodeV1(
  nodeId,
) {
  if (
    typeof nodeId !== "string"
  ) {
    return null;
  }

  const node =
    NODES[nodeId] || null;

  return node
    ? clone(node)
    : null;
}

export function resolveClarificationChoiceV1({
  nodeId,
  choiceId,
} = {}) {
  const node =
    getClarificationNodeV1(
      nodeId,
    );

  if (!node) {
    return {
      status:
        "unknown_node",
      node: null,
      choice: null,
      action: null,
    };
  }

  const choice =
    node.choices.find(
      (candidate) =>
        candidate.id ===
        choiceId,
    ) || null;

  if (!choice) {
    return {
      status:
        "unknown_choice",
      node,
      choice: null,
      action: null,
    };
  }

  return {
    status: "resolved",
    node,
    choice,
    action:
      clone(
        choice.action,
      ),
  };
}

export function buildClarificationQuickRepliesV1(
  nodeId,
) {
  const node =
    getClarificationNodeV1(
      nodeId,
    );

  if (!node) {
    return [];
  }

  return node.choices.map(
    (choice) => ({
      id:
        choice.id,
      label:
        choice.label,
      message:
        choice.message,
      controlledReply: {
        type:
          "clarification_choice",
        node:
          node.id,
        choice:
          choice.id,
      },
    }),
  );
}

export function listClarificationNodesV1() {
  return Object.keys(NODES);
}

export const CLARIFICATION_ACTION_TYPES_V1 =
  ACTION_TYPES;
