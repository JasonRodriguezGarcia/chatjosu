const ASSISTIVE_FUNCTIONS_V1 = new Set([
  "INFORMACION",
  "ORIENTACION",
  "ASESORAMIENTO",
  "ASESORAMIENTO_JURIDICO",
  "APOYO_PSICOLOGICO",
  "APOYO_SOCIAL",
  "ACOMPANAMIENTO",
  "ACOGIDA",
  "ALOJAMIENTO",
  "ALIMENTACION",
  "AYUDA_ECONOMICA",
  "NECESIDADES_BASICAS",
  "REHABILITACION",
  "TERAPIA",
  "ATENCION_SANITARIA",
  "ATENCION_DOMICILIARIA",
  "RESPIRO_FAMILIAR",
  "FORMACION",
  "EMPLEO_INSERCION",
  "MEDIACION",
  "OCIO_INCLUSIVO",
  "TRANSPORTE",
  "DEFENSA_DERECHOS",
]);

const PROTECTIVE_HINTS_V1 = new Set([
  "health_or_condition_resource",
  "social_support_resource",
  "family_support",
  "widowhood_support",
  "accident_support",
]);

function uniqueStrings(values) {
  return [
    ...new Set(
      (values ?? [])
        .map(value =>
          String(value ?? "").trim()
        )
        .filter(Boolean)
    ),
  ];
}

export function buildAssociationUtilityGateV1({
  relevanceDecision = null,
  needKeys = [],
  functionKeys = [],
  hints = [],
} = {}) {
  const needs =
    uniqueStrings(
      needKeys
    );

  const functions =
    uniqueStrings(
      functionKeys
    );

  const normalizedHints =
    uniqueStrings(
      hints
    );

  const assistiveFunctions =
    functions.filter(
      key =>
        ASSISTIVE_FUNCTIONS_V1.has(
          key
        )
    );

  const protectiveHints =
    normalizedHints.filter(
      key =>
        PROTECTIVE_HINTS_V1.has(
          key
        )
    );

  if (
    relevanceDecision !== "drop"
  ) {
    return {
      format_version: 1,
      decision: "keep",
      protected: false,
      reasons: [
        "relevance_not_drop",
      ],
      evidence: {
        needs,
        assistive_functions:
          assistiveFunctions,
        protective_hints:
          protectiveHints,
      },
    };
  }

  const reasons = [];

  if (needs.length > 0) {
    reasons.push(
      "need"
    );
  }

  if (
    assistiveFunctions.length > 0
  ) {
    reasons.push(
      "assistive_function"
    );
  }

  if (
    protectiveHints.length > 0
  ) {
    reasons.push(
      "protective_hint"
    );
  }

  return {
    format_version: 1,

    decision:
      reasons.length > 0
        ? "keep"
        : "drop",

    protected:
      reasons.length > 0,

    reasons,

    evidence: {
      needs,
      assistive_functions:
        assistiveFunctions,
      protective_hints:
        protectiveHints,
    },
  };
}
