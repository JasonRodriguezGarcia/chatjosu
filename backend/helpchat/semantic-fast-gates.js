function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-ES")
    .replace(/\s+/g, " ")
    .trim();
}

const ANCHORS = [
  {
    tagId: 4,
    tag: "ALZHEIMER",
    patterns: [
      /\balzheimer\b/,
    ],
  },
  {
    tagId: 3,
    tag: "AUTISMO",
    patterns: [
      /\bautismo\b/,
      /\btea\b/,
    ],
  },
  {
    tagId: 2,
    tag: "ALCOHOLISMO",
    patterns: [
      /\balcoholismo\b/,
      /\balcoholic[oa]s?\b/,
      /\bproblema(?:s)? con (?:el )?alcohol\b/,
      /\bproblema(?:s)? de alcohol\b/,
      /\bdependencia (?:del|al) alcohol\b/,
      /\badiccion (?:al )?alcohol\b/,
    ],
  },
  {
    tagId: 31,
    tag: "SALUD MENTAL",
    patterns: [
      /\bdepresion\b/,
      /\bdepresiv[oa]s?\b/,
      /\btrastorno depresivo\b/,
      /\bno puedo dormir\b/,
      /\bno consigue dormir\b/,
      /\bno consigue conciliar el sueno\b/,
      /\binsomnio\b/,
      /\bproblema(?:s)? (?:para|de) dormir\b/,
    ],
  },
  {
    tagId: 25,
    tag: "INSERCIÓN LABORAL",
    patterns: [
      /\bhe perdido (?:el )?trabajo\b/,
      /\bhe perdido (?:mi )?empleo\b/,
      /\bme he quedado sin trabajo\b/,
      /\bme he quedado sin empleo\b/,
      /\bestoy sin trabajo\b/,
      /\bestoy desemplead[oa]\b/,
      /\bdesemplead[oa]\b/,
    ],
  },
  {
    tagId: 33,
    tag: "SALUD MENTAL BIPOLAR",
    patterns: [
      /\btrastorno bipolar\b/,
      /\bbipolaridad\b/,
    ],
  },
  {
    tagId: 32,
    tag:
      "SALUD MENTAL ANOREXIA BULIMIA NERVIOSA TRASTORNO ALIMENTARIO",
    patterns: [
      /\banorexia\b/,
      /\bbulimia\b/,
      /\btrastorno(?:s)? alimentario(?:s)?\b/,
      /\btrastorno(?:s)? de la conducta alimentaria\b/,
    ],
  },
  {
    tagId: 16,
    tag: "ENFERMEDAD NEUROLÓGICA PARCKINSON",
    patterns: [
      /\bparkinson\b/,
    ],
  },
  {
    tagId: 13,
    tag: "DIABETES",
    patterns: [
      /\bdiabetes\b/,
    ],
  },
  {
    tagId: 18,
    tag: "ENFERMEDAD RENAL",
    patterns: [
      /\bdialisis\b/,
      /\binsuficiencia renal\b/,
      /\benfermedad renal\b/,
    ],
  },
  {
    tagId: 28,
    tag: "LUPUS",
    patterns: [
      /\blupus\b/,
    ],
  },
  {
    tagId: 22,
    tag: "FIBROMIALGIA Y CANSANCIO CRÓNICO",
    patterns: [
      /\bfibromialgia\b/,
    ],
  },
];

const ALWAYS_INSUFFICIENT_PATTERNS = [
  /^no se$/,
  /^no lo se$/,
  /^ni idea$/,
  /^no tengo ni idea$/,
  /^no sabria decirte$/,
];

const INSUFFICIENT_PATTERNS = [
  /^necesito ayuda$/,
  /^necesito orientacion$/,
  /^necesito seguimiento$/,
  /^necesito apoyo$/,
  /^necesito asesoramiento$/,
  /^necesito ayuda para (?:mi|un|una) \w+$/,
  /^busco ayuda$/,
  /^busco orientacion$/,
  /^busco orientacion social$/,
  /^necesito apoyo relacionado con una enfermedad$/,
  /^no se que hacer$/,
  /^no sabemos que hacer(?: con .+)?$/,
  /^(?:mi|el|la) \w+ esta muy mal$/,
];

export function resolveSemanticAnchors(
  inputMessage
) {
  const text = normalizeText(
    inputMessage
  );

  if (!text) {
    return [];
  }

  return ANCHORS
    .filter(
      (entry) =>
        entry.patterns.some(
          (pattern) =>
            pattern.test(text)
        )
    )
    .map(
      (entry) => ({
        tag_id:
          entry.tagId,
        descripcion:
          entry.tag,
      })
    );
}

export function resolveSemanticAnchor(
  inputMessage
) {
  const matches =
    resolveSemanticAnchors(
      inputMessage
    );

  return matches.length === 1
    ? matches[0]
    : null;
}

export function isClearlyInsufficient(
  inputMessage,
  conversationContext
) {
  const text = normalizeText(
    inputMessage
  );

  if (
    ALWAYS_INSUFFICIENT_PATTERNS.some(
      (pattern) =>
        pattern.test(text)
    )
  ) {
    return true;
  }

  const activeNeeds =
    Array.isArray(
      conversationContext?.activeNeeds
    )
      ? conversationContext.activeNeeds
      : [];

  if (activeNeeds.length > 0) {
    return false;
  }

  return INSUFFICIENT_PATTERNS.some(
    (pattern) =>
      pattern.test(text)
  );
}
