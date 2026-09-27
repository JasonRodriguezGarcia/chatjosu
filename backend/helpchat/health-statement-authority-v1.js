function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const UNCERTAINTY_PATTERNS = [
  /\bpuede ser\b/,
  /\bpodria ser\b/,
  /\bquiza\b/,
  /\bquizas\b/,
  /\btal vez\b/,
  /\bcreo que (?:es|sea)\b/,
  /\bno se si\b/,
  /\bsospech/,
  /\bparece que\b/,
  /\bme preocupa que sea\b/,
];

const EXPLICIT_AUTHORITY_PATTERNS = [
  /\bdiagnosticad[oa]\b/,
  /\bdiagnosticaron\b/,
  /\ble diagnosticaron\b/,
  /\ble han diagnosticado\b/,
  /\bme han diagnosticado\b/,
  /\btiene diagnostico de\b/,
  /\bdiagnostico de\b/,
  /\bpadece\b/,
];

const KNOWN_CONDITION_TERMS = [
  /\bdiabetes\b/,
  /\balzheimer\b/,
  /\bdemencia\b/,
  /\bautismo\b/,
  /\btea\b/,
  /\bcancer\b/,
  /\bparkinson\b/,
  /\bcrohn\b/,
  /\bcolitis ulcerosa\b/,
  /\bfibromialgia\b/,
  /\blupus\b/,
  /\bparalisis cerebral\b/,
  /\bespina bifida\b/,
  /\bhidrocefalia\b/,
  /\btrastorno bipolar\b/,
  /\bbipolaridad\b/,
  /\banorexia\b/,
  /\bbulimia\b/,
  /\btca\b/,
  /\bsordera\b/,
];

export function assessHealthStatementAuthorityV1(
  inputMessage,
) {
  const text =
    normalizeText(inputMessage);

  if (!text) {
    return {
      status:
        "symptom_description",
      explicitCondition:
        false,
    };
  }

  if (
    UNCERTAINTY_PATTERNS.some(
      (pattern) =>
        pattern.test(text),
    )
  ) {
    return {
      status:
        "uncertain_condition",
      explicitCondition:
        false,
    };
  }

  const hasKnownCondition =
    KNOWN_CONDITION_TERMS.some(
      (pattern) =>
        pattern.test(text),
    );

  const hasAuthorityCue =
    EXPLICIT_AUTHORITY_PATTERNS.some(
      (pattern) =>
        pattern.test(text),
    );

  if (
    hasKnownCondition ||
    hasAuthorityCue
  ) {
    return {
      status:
        "explicit_condition",
      explicitCondition:
        true,
    };
  }

  return {
    status:
      "symptom_description",
    explicitCondition:
      false,
  };
}
