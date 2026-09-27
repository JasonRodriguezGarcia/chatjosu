import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const ROOT =
  path.resolve(__dirname, "../..");

const MASTER_PATH =
  path.join(
    ROOT,
    "data/master/associations.base.jsonl"
  );

const PROPOSALS_PATH =
  path.join(
    ROOT,
    "data/enrichment/embedded-field-proposals.jsonl"
  );

const SUMMARY_PATH =
  path.join(
    ROOT,
    "data/reports/master-v3-embedded-field-summary.json"
  );

function readJsonl(pathname) {
  return fs
    .readFileSync(
      pathname,
      "utf8"
    )
    .split(/\r?\n/)
    .filter(Boolean)
    .map(
      (line, index) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          throw new Error(
            `JSONL inválido ${pathname}:${index + 1}: ${error.message}`
          );
        }
      }
    );
}

function clean(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const text =
    String(value)
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();

  return text || null;
}

function validEmail(value) {
  const text = clean(value);

  return Boolean(
    text &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
  );
}

function validUrl(value) {
  const text = clean(value);

  if (!text) {
    return false;
  }

  try {
    const parsed =
      new URL(text);

    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function validPostalCode(value) {
  return /^\d{5}$/.test(
    clean(value) ?? ""
  );
}

function validPhone(value) {
  const text = clean(value);

  if (!text) {
    return false;
  }

  const groups =
    extractPhones(text);

  return groups.length > 0;
}

function normalizeEmail(value) {
  return value
    .trim()
    .replace(
      /^[,;:.]+|[,;:.]+$/g,
      ""
    )
    .toLowerCase();
}

function normalizeUrl(value) {
  let candidate =
    value
      .trim()
      .replace(
        /^[([{<]+|[)\]}>.,;:]+$/g,
        ""
      );

  if (
    !/^https?:\/\//i.test(candidate)
  ) {
    candidate =
      `https://${candidate}`;
  }

  try {
    const parsed =
      new URL(candidate);

    parsed.hash = "";

    return parsed.toString();
  } catch {
    return candidate;
  }
}

function normalizePhone(value) {
  return value
    .replace(
      /[‐-‒–—]/g,
      "-"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .replace(
      /^[,;:.]+|[,;:.]+$/g,
      ""
    );
}

function unique(values) {
  return [
    ...new Set(
      values.filter(Boolean)
    ),
  ];
}

function extractEmails(text) {
  if (!text) {
    return [];
  }

  const matches =
    text.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
    ) ?? [];

  return unique(
    matches.map(
      normalizeEmail
    )
  );
}

function extractUrls(text) {
  if (!text) {
    return [];
  }

  const result = [];

  const explicit =
    text.match(
      /https?:\/\/[^\s<>"']+/gi
    ) ?? [];

  for (
    const value
    of explicit
  ) {
    result.push(
      normalizeUrl(value)
    );
  }

  const www =
    text.match(
      /\bwww\.[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?/gi
    ) ?? [];

  for (
    const value
    of www
  ) {
    result.push(
      normalizeUrl(value)
    );
  }

  const bare =
    text.match(
      /\b(?:[a-z0-9-]+\.)+(?:es|org|com|net|eu|cat)(?:\/[^\s<>"']*)?/gi
    ) ?? [];

  for (
    const value
    of bare
  ) {
    if (
      value.includes("@")
    ) {
      continue;
    }

    result.push(
      normalizeUrl(value)
    );
  }

  return unique(result);
}

function extractPostalCodes(text) {
  if (!text) {
    return [];
  }

  const matches =
    text.match(
      /(?<!\d)(?:0[1-9]|[1-4]\d|5[0-2])\d{3}(?!\d)/g
    ) ?? [];

  return unique(matches);
}

function extractPhones(text) {
  if (!text) {
    return [];
  }

  const candidates =
    text.match(
      /(?:(?:\+34|0034)[ .-]*)?(?:[6789]\d{2})(?:[ .-]*\d{3}){2}/g
    ) ?? [];

  return unique(
    candidates.map(
      normalizePhone
    )
  );
}

function sourceEntries(row) {
  return [
    ["name", row.name],
    ["description", row.description],
    ["address", row.address],
    ["phone", row.phone],
    ["email", row.email],
    ["website", row.website],
    [
      "municipality_name",
      row.municipality_name,
    ],
    [
      "original_category",
      row.original_category,
    ],
  ].filter(
    ([, value]) =>
      clean(value)
  );
}

function confidenceFor(
  target,
  sourceField,
  sourceText
) {
  const text =
    String(
      sourceText ?? ""
    ).trim();

  const normalized =
    text.toLocaleLowerCase(
      "es"
    );

  const phoneCandidates =
    extractPhones(
      text
    );

  const urlCandidates =
    extractUrls(
      text
    );

  const postalCandidates =
    extractPostalCodes(
      text
    );

  const phoneOnly =
    phoneCandidates.length > 0 &&
    text
      .replace(
        /(?:(?:\+34|0034)[ .-]*)?(?:[6789]\d{2})(?:[ .-]*\d{3}){2}/g,
        ""
      )
      .replace(
        /[\s/|,;()\-]+/g,
        ""
      )
      .length === 0;

  if (
    target === "phone" &&
    (
      /tel[eé]fono\s*[:\-]/i.test(
        text
      ) ||
      /tel\.?\s*[:\-]/i.test(
        text
      ) ||
      phoneOnly
    )
  ) {
    return "high";
  }

  if (
    target === "email" &&
    normalized.includes("@")
  ) {
    return "high";
  }

  if (
    target === "website" &&
    (
      /\bweb\s*[:\-]/i.test(
        text
      ) ||
      /https?:\/\//i.test(
        text
      ) ||
      /^www\./i.test(
        text
      ) ||
      (
        urlCandidates.length === 1 &&
        /^(?:[a-z0-9-]+\.)+(?:es|org|com|net|eu|cat)\/?$/i.test(
          text
        )
      )
    )
  ) {
    return "high";
  }

  if (
    target === "postal_code" &&
    (
      sourceField ===
        "address" ||
      /\b(?:cp|c\.p\.)\s*[:\-]?\s*\d{5}\b/i.test(
        text
      ) ||
      (
        postalCandidates.length === 1 &&
        /^\d{5}$/.test(
          text
        )
      )
    )
  ) {
    return "high";
  }

  return "medium";
}

function currentValid(
  field,
  value
) {
  switch (field) {
    case "phone":
      return validPhone(
        value
      );

    case "email":
      return validEmail(
        value
      );

    case "website":
      return validUrl(
        value
      );

    case "postal_code":
      return validPostalCode(
        value
      );

    default:
      return Boolean(
        clean(value)
      );
  }
}

const rows =
  readJsonl(
    MASTER_PATH
  );

const proposals = [];

for (
  const row
  of rows
) {
  const sources =
    sourceEntries(row);

  const candidates = {
    phone: [],
    email: [],
    website: [],
    postal_code: [],
  };

  for (
    const [
      sourceField,
      sourceValue,
    ]
    of sources
  ) {
    const sourceText =
      clean(sourceValue);

    for (
      const value
      of extractPhones(
        sourceText
      )
    ) {
      candidates.phone.push({
        value,
        source_field:
          sourceField,
        source_text:
          sourceText,
      });
    }

    for (
      const value
      of extractEmails(
        sourceText
      )
    ) {
      candidates.email.push({
        value,
        source_field:
          sourceField,
        source_text:
          sourceText,
      });
    }

    /*
     * Nunca inferimos la web de una organización a partir
     * únicamente del dominio de su correo.
     *
     * foo@gmail.com -> gmail.com NO es la web de foo.
     *
     * Si el campo email contiene realmente una URL por un
     * desplazamiento de columnas, permitimos únicamente URLs
     * explícitas http(s):// o www.
     */
    const sourceCanProvideWebsite =
      sourceField !== "email" ||
      /https?:\/\/|\bwww\./i.test(
        sourceText
      );

    if (sourceCanProvideWebsite) {
      for (
        const value
        of extractUrls(
          sourceText
        )
      ) {
        candidates.website.push({
          value,
          source_field:
            sourceField,
          source_text:
            sourceText,
        });
      }
    }

    for (
      const value
      of extractPostalCodes(
        sourceText
      )
    ) {
      candidates.postal_code.push({
        value,
        source_field:
          sourceField,
        source_text:
          sourceText,
      });
    }
  }

  for (
    const field
    of [
      "phone",
      "email",
      "website",
      "postal_code",
    ]
  ) {
    if (
      currentValid(
        field,
        row[field]
      )
    ) {
      continue;
    }

    const seen =
      new Map();

    for (
      const candidate
      of candidates[field]
    ) {
      if (
        !seen.has(
          candidate.value
        )
      ) {
        seen.set(
          candidate.value,
          candidate
        );
      }
    }

    const values =
      [...seen.values()];

    if (
      values.length === 0
    ) {
      continue;
    }

    const proposal =
      values[0];

    proposals.push({
      association_id:
        Number(
          row.association_id
        ),
      field,
      current_value:
        row[field] ?? null,
      proposed_value:
        proposal.value,
      source_field:
        proposal.source_field,
      source_text:
        proposal.source_text,
      confidence:
        confidenceFor(
          field,
          proposal.source_field,
          proposal.source_text
        ),
      candidate_count:
        values.length,
      alternatives:
        values
          .slice(1)
          .map(
            (item) =>
              item.value
          ),
      decision:
        values.length === 1
          ? "auto_candidate"
          : "review_multiple_candidates",
      method:
        "embedded_text_extraction_v1",
    });
  }
}

proposals.sort(
  (a, b) =>
    a.association_id -
      b.association_id ||
    a.field.localeCompare(
      b.field
    )
);

fs.writeFileSync(
  PROPOSALS_PATH,
  `${
    proposals
      .map(
        (row) =>
          JSON.stringify(row)
      )
      .join("\n")
  }\n`,
  "utf8"
);

const fieldCounts = {};
const confidenceCounts = {};
const decisionCounts = {};
const sourceFieldCounts = {};

for (
  const proposal
  of proposals
) {
  fieldCounts[
    proposal.field
  ] =
    (
      fieldCounts[
        proposal.field
      ] ?? 0
    ) + 1;

  confidenceCounts[
    proposal.confidence
  ] =
    (
      confidenceCounts[
        proposal.confidence
      ] ?? 0
    ) + 1;

  decisionCounts[
    proposal.decision
  ] =
    (
      decisionCounts[
        proposal.decision
      ] ?? 0
    ) + 1;

  const sourceKey =
    `${proposal.field}<-${proposal.source_field}`;

  sourceFieldCounts[
    sourceKey
  ] =
    (
      sourceFieldCounts[
        sourceKey
      ] ?? 0
    ) + 1;
}

const summary = {
  format_version: 1,
  associations_total:
    rows.length,
  proposals_total:
    proposals.length,
  associations_with_proposals:
    new Set(
      proposals.map(
        (row) =>
          row.association_id
      )
    ).size,
  field_counts:
    fieldCounts,
  confidence_counts:
    confidenceCounts,
  decision_counts:
    decisionCounts,
  source_field_counts:
    sourceFieldCounts,
};

fs.writeFileSync(
  SUMMARY_PATH,
  `${JSON.stringify(
    summary,
    null,
    2
  )}\n`,
  "utf8"
);

console.log(
  `ASSOCIATIONS_TOTAL=${rows.length}`
);

console.log(
  `PROPOSALS_TOTAL=${proposals.length}`
);

console.log(
  `ASSOCIATIONS_WITH_PROPOSALS=${summary.associations_with_proposals}`
);

console.log(
  `FIELD_COUNTS=${JSON.stringify(fieldCounts)}`
);

console.log(
  `CONFIDENCE_COUNTS=${JSON.stringify(confidenceCounts)}`
);

console.log(
  `DECISION_COUNTS=${JSON.stringify(decisionCounts)}`
);

console.log(
  `PROPOSALS=${path.relative(ROOT, PROPOSALS_PATH)}`
);

console.log(
  `SUMMARY=${path.relative(ROOT, SUMMARY_PATH)}`
);
