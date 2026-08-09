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

const INSUFFICIENT_PATTERNS = [
  /^necesito ayuda$/,
  /^necesito ayuda para (?:mi|un|una) \w+$/,
  /^busco ayuda$/,
  /^busco orientacion$/,
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
