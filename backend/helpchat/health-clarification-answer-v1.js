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

const NOT_CONFIRMED_PATTERNS = [
  /\bobservando (?:estos |los )?sintomas\b/,
  /\bde momento (?:estamos )?observando\b/,
  /\btodavia no (?:hay|tenemos) diagnostico\b/,
  /\bno (?:le|nos|me) han diagnosticado nada\b/,
  /\bno hay diagnostico\b/,
];

export function interpretHealthClarificationAnswerV1({
  dimension,
  inputMessage,
} = {}) {
  if (
    dimension !==
      "diagnosis_status"
  ) {
    return {
      status:
        "unresolved",
      dimension:
        dimension || null,
      value: null,
    };
  }

  const text =
    normalizeText(
      inputMessage,
    );

  const notConfirmed =
    NOT_CONFIRMED_PATTERNS.some(
      (pattern) =>
        pattern.test(text),
    );

  if (notConfirmed) {
    return {
      status:
        "resolved",
      dimension:
        "diagnosis_status",
      value:
        "not_confirmed",
    };
  }

  return {
    status:
      "unresolved",
    dimension:
      "diagnosis_status",
    value: null,
  };
}
