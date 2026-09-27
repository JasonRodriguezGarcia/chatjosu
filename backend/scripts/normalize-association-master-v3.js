import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

const MASTER_PATH = path.join(
  ROOT,
  "data/master/associations.base.jsonl"
);

const REPORT_PATH = path.join(
  ROOT,
  "data/reports/master-v3-structural-normalization.json"
);

const PLACEHOLDER_PATTERNS = [
  /^consultar(?:\s+en)?(?:\s+web)?(?:\s*\/\s*sede)?$/i,
  /^\(?consultar sede\)?$/i,
  /^sitio web$/i,
  /^no especificado/i,
  /^no se encontr/i,
  /^sin datos?$/i,
  /^n\/?a$/i,
  /^null$/i,
  /^undefined$/i,
  /^-+$/,
];

function cleanText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();

  if (!text) {
    return null;
  }

  if (
    PLACEHOLDER_PATTERNS.some(
      (pattern) => pattern.test(text)
    )
  ) {
    return null;
  }

  return text;
}

function cleanUrl(value) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  const markdown = text.match(
    /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/i
  );

  let candidate = markdown
    ? markdown[2]
    : text;

  candidate = candidate.trim();

  if (
    !/^https?:\/\//i.test(candidate) &&
    /^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(candidate)
  ) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);

    url.hash = "";

    return url.toString();
  } catch {
    return text;
  }
}

function cleanEmail(value) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  const markdown = text.match(
    /^\[([^\]]+)\]\(mailto:([^)]+)\)$/i
  );

  const candidate = (
    markdown
      ? markdown[2]
      : text.replace(/^mailto:/i, "")
  )
    .trim()
    .toLowerCase();

  if (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)
  ) {
    return candidate;
  }

  return text;
}

function cleanPostalCode(value) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  const match = text.match(
    /(?:^|\D)(\d{5})(?:\D|$)/
  );

  return match
    ? match[1]
    : text;
}

function cleanPhone(value) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  const normalized = text
    .replace(/[‐-‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

function normalizeScope(value) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  const key = text.toLocaleLowerCase("es");

  if (key === "nacional") {
    return "Nacional";
  }

  if (key === "provincial") {
    return "Provincial";
  }

  if (key === "local") {
    return "Local";
  }

  return text;
}

function readJsonl(pathname) {
  return fs
    .readFileSync(pathname, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(
          `JSONL inválido ${pathname}:${index + 1}: ${error.message}`
        );
      }
    });
}

function writeJsonl(pathname, rows) {
  fs.writeFileSync(
    pathname,
    `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
    "utf8"
  );
}

const rows = readJsonl(
  MASTER_PATH
);

const changes = [];
const fieldCounts = {};

function recordChange(
  associationId,
  field,
  before,
  after
) {
  if (
    JSON.stringify(before) ===
    JSON.stringify(after)
  ) {
    return;
  }

  fieldCounts[field] =
    (fieldCounts[field] ?? 0) + 1;

  changes.push({
    association_id: associationId,
    field,
    before,
    after,
  });
}

const normalizedRows = rows.map(
  (row) => {
    const next = structuredClone(row);

    const transforms = {
      name: cleanText,
      scope: normalizeScope,
      province_key: cleanText,
      province_name: cleanText,
      municipality_key: cleanText,
      municipality_name: cleanText,
      address: cleanText,
      postal_code: cleanPostalCode,
      phone: cleanPhone,
      email: cleanEmail,
      website: cleanUrl,
      description: cleanText,
      location_precision: cleanText,
      list_distance: cleanText,
      original_category: cleanText,
      content_hash: cleanText,
    };

    for (
      const [field, transform]
      of Object.entries(transforms)
    ) {
      const before = next[field];
      const after = transform(before);

      recordChange(
        next.association_id,
        field,
        before,
        after
      );

      next[field] = after;
    }

    if (next.source) {
      for (
        const field
        of ["sheet", "id", "quality"]
      ) {
        const before =
          next.source[field];

        const after =
          cleanText(before);

        recordChange(
          next.association_id,
          `source.${field}`,
          before,
          after
        );

        next.source[field] =
          after;
      }
    }

    return next;
  }
);

writeJsonl(
  MASTER_PATH,
  normalizedRows
);

const report = {
  format_version: 1,
  rows_total:
    normalizedRows.length,
  changes_total:
    changes.length,
  field_change_counts:
    fieldCounts,
  changes,
};

fs.writeFileSync(
  REPORT_PATH,
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);

console.log(
  `NORMALIZED_ROWS=${normalizedRows.length}`
);

console.log(
  `CHANGES_TOTAL=${changes.length}`
);

console.log(
  `FIELD_CHANGES=${JSON.stringify(fieldCounts)}`
);

console.log(
  `REPORT=${path.relative(ROOT, REPORT_PATH)}`
);
