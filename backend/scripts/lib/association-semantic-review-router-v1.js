const STRONG_SUPPORT_FUNCTIONS_V1 =
  new Set([
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
    "EMPLEO_INSERCION",
    "MEDIACION",
    "OCIO_INCLUSIVO",
    "TRANSPORTE",
  ]);

function unique(
  values
) {
  return [
    ...new Set(
      (values ?? [])
        .filter(Boolean)
    ),
  ];
}

function dimensionKeys(
  canonical,
  dimension
) {
  return unique(
    canonical
      ?.semantic
      ?.[dimension]
      ?.keys
  );
}

export function
buildAssociationSemanticReviewRouteV1({
  canonical,
  prioritySupportCategories = [],
} = {}) {
  if (
    !canonical ||
    typeof canonical !== "object"
  ) {
    throw new TypeError(
      "canonical association is required"
    );
  }

  const needs =
    dimensionKeys(
      canonical,
      "needs"
    );

  const functions =
    dimensionKeys(
      canonical,
      "functions"
    );

  const populations =
    dimensionKeys(
      canonical,
      "populations"
    );

  const activities =
    dimensionKeys(
      canonical,
      "activities"
    );

  const semanticZero =
    (
      needs.length +
      functions.length +
      populations.length +
      activities.length
    ) === 0;

  const categories =
    unique(
      canonical
        ?.source_facts
        ?.source_categories
    );

  const secondaryCategory =
    categories.length >= 2
      ? categories[1]
      : null;

  const prioritySupportCategorySet =
    new Set(
      unique(
        prioritySupportCategories
      )
    );

  const prioritySupportDomain =
    semanticZero &&
    prioritySupportCategorySet
      .has(
        secondaryCategory
      );

  const strongFunctions =
    functions.filter(
      value =>
        STRONG_SUPPORT_FUNCTIONS_V1
          .has(value)
    );

  const lanes =
    unique(
      canonical
        ?.publication
        ?.lanes
    );

  const alreadySupport =
    lanes.includes(
      "support_resource"
    );

  const supportReview =
    !alreadySupport &&
    strongFunctions.length > 0;

  let route;
  let priority;

  if (prioritySupportDomain) {
    route =
      "support_critical";

    priority = 10;
  } else if (supportReview) {
    route =
      "support_review";

    priority = 20;
  } else if (semanticZero) {
    route =
      "semantic_zero";

    priority = 30;
  } else {
    route =
      "no_action";

    priority = 100;
  }

  return {
    format_version: 1,

    route,
    priority,

    reasons: {
      semantic_zero:
        semanticZero,

      priority_support_domain:
        prioritySupportDomain,

      strong_support_functions:
        strongFunctions,

      already_support:
        alreadySupport,
    },
  };
}
