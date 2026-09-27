import {
  normalizeConversationContextV1,
} from "./conversation-context-v1.js";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-ES")
    .replace(/[^\p{L}\p{N}/, ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

const RELATIONSHIPS = [
  ["madre", /\bmi madre\b/],
  ["padre", /\bmi padre\b/],
  ["hermana", /\bmi hermana\b/],
  ["hermano", /\bmi hermano\b/],
  ["hija", /\bmi hija\b/],
  ["hijo", /\bmi hijo\b/],
  ["abuela", /\bmi abuela\b/],
  ["abuelo", /\bmi abuelo\b/],
  ["tía", /\bmi tia\b/],
  ["tío", /\bmi tio\b/],
  ["pareja", /\bmi pareja\b/],
  ["mujer", /\bmi mujer\b/],
  ["marido", /\bmi marido\b/],
];

export function extractRelationship(
  inputMessage
) {
  const text =
    normalizeText(inputMessage);

  const correction =
    text.match(
      /\bno es mi (?:madre|padre|hermana|hermano|hija|hijo|abuela|abuelo|tia|tio|pareja|mujer|marido)\b.{0,50}\bes mi (madre|padre|hermana|hermano|hija|hijo|abuela|abuelo|tia|tio|pareja|mujer|marido)\b/
    );

  if (correction?.[1]) {
    const corrected = {
      tia: "tía",
      tio: "tío",
    };

    return (
      corrected[correction[1]] ||
      correction[1]
    );
  }

  const matches =
    RELATIONSHIPS.filter(
      ([, pattern]) =>
        pattern.test(text)
    );

  if (matches.length !== 1) {
    return null;
  }

  return matches[0][0];
}

function provinceAliases(province) {
  const aliases = new Set();

  const add = (value) => {
    const normalized =
      normalizeText(value);

    if (!normalized) {
      return;
    }

    aliases.add(normalized);

    for (
      const part of normalized.split("/")
    ) {
      if (part.trim()) {
        aliases.add(
          part.trim()
        );
      }
    }

    if (
      normalized.includes(",")
    ) {
      const parts =
        normalized
          .split(",")
          .map(
            (part) =>
              part.trim()
          )
          .filter(Boolean);

      if (
        parts.length === 2
      ) {
        aliases.add(
          `${parts[1]} ${parts[0]}`
        );
      }

      for (
        const part of parts
      ) {
        /*
         * Evita convertir partículas
         * administrativas como "A" en
         * aliases territoriales globales.
         *
         * "Coruña, A" puede aportar
         * "Coruña", pero nunca "A".
         */
        if (
          part.length >= 3
        ) {
          aliases.add(part);
        }
      }
    }
  };

  add(
    province?.province_key
  );

  add(
    province?.name
  );

  return [
    ...aliases,
  ];
}

export function createProvinceMatcher(
  provinces = []
) {
  const entries = [];

  for (const province of provinces) {
    if (
      !province ||
      typeof province.name !== "string"
    ) {
      continue;
    }

    for (
      const alias of provinceAliases(
        province
      )
    ) {
      entries.push({
        alias,
        province:
          province.name.trim(),
      });
    }
  }

  entries.sort(
    (left, right) =>
      right.alias.length -
      left.alias.length
  );

  return function matchProvince(
    value
  ) {
    const text =
      normalizeText(value);

    const matches = [];

    for (const entry of entries) {
      const pattern =
        new RegExp(
          `(?:^|\\s)${escapeRegExp(
            entry.alias
          )}(?:$|\\s)`
        );

      if (pattern.test(text)) {
        matches.push(entry.province);
      }
    }

    const unique =
      [...new Set(matches)];

    if (unique.length !== 1) {
      return null;
    }

    return unique[0];
  };
}

function relationshipAliases(
  relationship
) {
  const aliases = {
    madre: ["mi madre"],
    padre: ["mi padre"],
    hermana: ["mi hermana"],
    hermano: ["mi hermano"],
    hija: ["mi hija"],
    hijo: ["mi hijo"],
    abuela: ["mi abuela"],
    abuelo: ["mi abuelo"],
    tía: ["mi tia"],
    tío: ["mi tio"],
    pareja: ["mi pareja"],
    mujer: ["mi mujer"],
    marido: ["mi marido"],
  };

  return aliases[
    relationship
  ] || [];
}

export function extractTargetProvince({
  inputMessage,
  relationship,
  provinceMatcher,
} = {}) {
  if (
    typeof provinceMatcher !==
      "function" ||
    !relationship
  ) {
    return null;
  }

  const text =
    normalizeText(inputMessage);

  const aliases =
    relationshipAliases(
      relationship
    );

  for (const alias of aliases) {
    const subject =
      escapeRegExp(
        normalizeText(alias)
      );

    const patterns = [
      new RegExp(
        `\\b${subject}\\b.{0,80}\\b` +
        `(?:vive|reside|esta|se encuentra)` +
        `\\s+en\\s+(.+)$`
      ),

      new RegExp(
        `\\b(?:ayuda|apoyo|orientacion)` +
        `\\s+para\\s+${subject}\\b.{0,60}` +
        `\\b(?:en|de)\\s+(.+)$`
      ),
    ];

    for (const pattern of patterns) {
      const match =
        text.match(pattern);

      if (!match?.[1]) {
        continue;
      }

      const province =
        provinceMatcher(
          match[1]
        );

      if (province) {
        return province;
      }
    }
  }

  /*
   * Referencia al sujeto ya conocido:
   * "Ella vive en Burgos"
   * "Él reside en Navarra"
   * "Perdón, vive en Gipuzkoa"
   */
  const contextualLocation =
    text.match(
      /(?:^|\b)(?:ella|el)?\s*(?:vive|reside|esta|se encuentra)\s+en\s+(.+)$/
    );

  if (
    contextualLocation?.[1]
  ) {
    const province =
      provinceMatcher(
        contextualLocation[1]
      );

    if (province) {
      return province;
    }
  }

  /*
   * Fallback conservador:
   * si existe sujeto conocido/explícito,
   * aparece exactamente una provincia
   * y no se atribuye al interlocutor,
   * puede pertenecer al destinatario.
   *
   * Resuelve:
   * "Mi padre tiene Parkinson, vive solo
   * y casi no puede salir de casa en Burgos"
   */
  const firstPersonLocation =
    /\b(?:yo\s+)?(?:vivo|resido|estoy)\s+en\b/
      .test(text);

  if (!firstPersonLocation) {
    const province =
      provinceMatcher(
        inputMessage
      );

    if (province) {
      return province;
    }
  }

  return null;
}

export function enrichConversationContextV1({
  conversationContext,
  inputMessage,
  selectedProvince,
  provinceMatcher = null,
} = {}) {
  const context =
    normalizeConversationContextV1(
      conversationContext
    );

  const relationship =
    extractRelationship(
      inputMessage
    );

  if (relationship) {
    context.subject.relationship =
      relationship;
  }

  if (
    !context.territory.province &&
    typeof selectedProvince ===
      "string" &&
    selectedProvince.trim()
  ) {
    context.territory.province =
      selectedProvince.trim();
  }

  const targetProvince =
    extractTargetProvince({
      inputMessage,
      relationship:
        context.subject.relationship,
      provinceMatcher,
    });

  if (targetProvince) {
    context.territory.province =
      targetProvince;
  }

  return context;
}
