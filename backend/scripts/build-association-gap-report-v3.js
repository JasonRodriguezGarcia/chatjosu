import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const ROOT =
  path.resolve(__dirname, "../..");

const BASE_PATH =
  path.join(
    ROOT,
    "data/master/associations.base.jsonl"
  );

const CURATION_PATH =
  path.join(
    ROOT,
    "data/curation/association-overrides.jsonl"
  );

const TSV_PATH =
  path.join(
    ROOT,
    "data/reports/master-v3-gap-report.tsv"
  );

const SUMMARY_PATH =
  path.join(
    ROOT,
    "data/reports/master-v3-gap-summary.json"
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
      (line) =>
        JSON.parse(line)
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
    String(value).trim();

  return text || null;
}

function normalize(value) {
  return String(
    value ?? ""
  )
    .normalize("NFD")
    .replace(
      /\p{Diacritic}/gu,
      ""
    )
    .toLocaleLowerCase(
      "es"
    );
}

function looksLikeUrl(value) {
  const text =
    clean(value);

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

function looksLikeEmail(value) {
  const text =
    clean(value);

  if (!text) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    text
  );
}

function looksLikePostalCode(value) {
  const text =
    clean(value);

  if (!text) {
    return false;
  }

  return /^\d{5}$/.test(
    text
  );
}

function looksLikePhone(value) {
  const text =
    clean(value);

  if (!text) {
    return false;
  }

  const digits =
    text.replace(/\D/g, "");

  return (
    digits.length >= 9 &&
    digits.length <= 15
  );
}

function suspiciousTerritory(value) {
  const text =
    normalize(value);

  if (!text) {
    return false;
  }

  const signals = [
    "http",
    "www.",
    ".org",
    ".com",
    "@",
    "telefono",
    "tel.",
    "calle ",
    "c/ ",
    "avenida ",
    "av. ",
    "consultar",
    "no se encontro",
    "sitio web",
  ];

  return signals.some(
    (signal) =>
      text.includes(signal)
  );
}

function suspiciousAddress(value) {
  const text =
    normalize(value);

  if (!text) {
    return false;
  }

  return (
    text.includes("@") ||
    text.includes("http://") ||
    text.includes("https://") ||
    text.includes("www.")
  );
}

function gapInfo(
  base,
  curation
) {
  const missing = [];
  const invalid = [];
  const warnings = [];

  const tags =
    Array.isArray(
      curation.tags
    )
      ? curation.tags.filter(
          Boolean
        )
      : [];

  if (!clean(base.name)) {
    missing.push("name");
  }

  if (!clean(base.scope)) {
    missing.push("scope");
  }

  if (
    base.scope !== "Nacional" &&
    !clean(
      base.province_key
    )
  ) {
    missing.push(
      "province"
    );
  }

  if (
    !clean(
      base.municipality_name
    ) &&
    base.scope !== "Nacional"
  ) {
    missing.push(
      "municipality"
    );
  }

  if (
    tags.length === 0
  ) {
    missing.push(
      "canonical_tag"
    );
  }

  if (
    !clean(
      base.original_category
    )
  ) {
    missing.push(
      "source_category"
    );
  }

  if (!clean(base.address)) {
    missing.push(
      "address"
    );
  }

  if (
    !clean(
      base.postal_code
    )
  ) {
    missing.push(
      "postal_code"
    );
  } else if (
    !looksLikePostalCode(
      base.postal_code
    )
  ) {
    invalid.push(
      "postal_code"
    );
  }

  if (!clean(base.phone)) {
    missing.push(
      "phone"
    );
  } else if (
    !looksLikePhone(
      base.phone
    )
  ) {
    invalid.push(
      "phone"
    );
  }

  if (!clean(base.email)) {
    missing.push(
      "email"
    );
  } else if (
    !looksLikeEmail(
      base.email
    )
  ) {
    invalid.push(
      "email"
    );
  }

  if (!clean(base.website)) {
    missing.push(
      "website"
    );
  } else if (
    !looksLikeUrl(
      base.website
    )
  ) {
    invalid.push(
      "website"
    );
  }

  if (
    !clean(
      base.description
    )
  ) {
    missing.push(
      "description"
    );
  }

  if (
    suspiciousTerritory(
      base.municipality_name
    )
  ) {
    invalid.push(
      "municipality"
    );
  }

  if (
    suspiciousTerritory(
      base.province_name
    )
  ) {
    invalid.push(
      "province"
    );
  }

  if (
    suspiciousAddress(
      base.address
    )
  ) {
    invalid.push(
      "address"
    );
  }

  if (
    curation.record_status ===
      "duplicate"
  ) {
    warnings.push(
      "duplicate"
    );
  }

  if (
    curation.record_status ===
      "needs_review"
  ) {
    warnings.push(
      "needs_review"
    );
  }

  const usefulContactCount = [
    base.phone,
    base.email,
    base.website,
  ].filter(
    (value) =>
      clean(value)
  ).length;

  if (
    usefulContactCount === 0
  ) {
    warnings.push(
      "no_contact"
    );
  }

  const priority = (() => {
    if (
      curation.record_status ===
        "duplicate"
    ) {
      return 90;
    }

    if (
      invalid.length > 0
    ) {
      return 10;
    }

    if (
      curation.record_status ===
        "needs_enrichment" &&
      tags.length === 0
    ) {
      return 20;
    }

    if (
      curation.record_status ===
        "needs_review"
    ) {
      return 30;
    }

    if (
      missing.length >= 5
    ) {
      return 40;
    }

    if (
      missing.length > 0
    ) {
      return 50;
    }

    return 60;
  })();

  return {
    tags,
    missing:
      [...new Set(missing)],
    invalid:
      [...new Set(invalid)],
    warnings:
      [...new Set(warnings)],
    priority,
  };
}

function tsv(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value)
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, " ");
}

const baseRows =
  readJsonl(
    BASE_PATH
  );

const curationRows =
  readJsonl(
    CURATION_PATH
  );

const curationById =
  new Map(
    curationRows.map(
      (row) => [
        Number(
          row.association_id
        ),
        row,
      ]
    )
  );

const records = [];

for (
  const base
  of baseRows
) {
  const id =
    Number(
      base.association_id
    );

  const curation =
    curationById.get(id);

  if (!curation) {
    throw new Error(
      `Falta curación para association_id=${id}`
    );
  }

  const gap =
    gapInfo(
      base,
      curation
    );

  records.push({
    association_id: id,
    priority:
      gap.priority,
    record_status:
      curation.record_status,
    runtime_enabled:
      Boolean(
        curation.runtime_enabled
      ),
    name:
      base.name,
    scope:
      base.scope,
    province_key:
      base.province_key,
    municipality_name:
      base.municipality_name,
    tags:
      gap.tags.join("|"),
    original_category:
      base.original_category,
    address:
      base.address,
    postal_code:
      base.postal_code,
    phone:
      base.phone,
    email:
      base.email,
    website:
      base.website,
    description:
      base.description,
    missing:
      gap.missing.join("|"),
    invalid:
      gap.invalid.join("|"),
    warnings:
      gap.warnings.join("|"),
    duplicate_of:
      curation.duplicate_of,
    source_quality:
      base.source?.quality ??
      null,
  });
}

records.sort(
  (a, b) =>
    a.priority -
      b.priority ||
    a.association_id -
      b.association_id
);

const columns = [
  "association_id",
  "priority",
  "record_status",
  "runtime_enabled",
  "name",
  "scope",
  "province_key",
  "municipality_name",
  "tags",
  "original_category",
  "address",
  "postal_code",
  "phone",
  "email",
  "website",
  "description",
  "missing",
  "invalid",
  "warnings",
  "duplicate_of",
  "source_quality",
];

const output = [
  columns.join("\t"),
  ...records.map(
    (row) =>
      columns
        .map(
          (column) =>
            tsv(
              row[column]
            )
        )
        .join("\t")
  ),
].join("\n");

fs.writeFileSync(
  TSV_PATH,
  `${output}\n`,
  "utf8"
);

const statusCounts = {};
const missingCounts = {};
const invalidCounts = {};
const warningCounts = {};
const provinceCounts = {};
const priorityCounts = {};

for (
  const record
  of records
) {
  statusCounts[
    record.record_status
  ] =
    (
      statusCounts[
        record.record_status
      ] ?? 0
    ) + 1;

  priorityCounts[
    record.priority
  ] =
    (
      priorityCounts[
        record.priority
      ] ?? 0
    ) + 1;

  for (
    const item
    of record.missing
      .split("|")
      .filter(Boolean)
  ) {
    missingCounts[item] =
      (
        missingCounts[item] ??
        0
      ) + 1;
  }

  for (
    const item
    of record.invalid
      .split("|")
      .filter(Boolean)
  ) {
    invalidCounts[item] =
      (
        invalidCounts[item] ??
        0
      ) + 1;
  }

  for (
    const item
    of record.warnings
      .split("|")
      .filter(Boolean)
  ) {
    warningCounts[item] =
      (
        warningCounts[item] ??
        0
      ) + 1;
  }

  const province =
    record.province_key ||
    (
      record.scope ===
        "Nacional"
        ? "NACIONAL"
        : "<EMPTY>"
    );

  provinceCounts[
    province
  ] =
    (
      provinceCounts[
        province
      ] ?? 0
    ) + 1;
}

const actionable =
  records.filter(
    (row) =>
      row.record_status !==
        "duplicate" &&
      (
        row.missing ||
        row.invalid ||
        row.warnings
      )
  );

const enrichment =
  records.filter(
    (row) =>
      row.record_status ===
        "needs_enrichment"
  );

const summary = {
  format_version: 1,
  rows_total:
    records.length,
  actionable_total:
    actionable.length,
  needs_enrichment_total:
    enrichment.length,
  status_counts:
    statusCounts,
  priority_counts:
    priorityCounts,
  missing_field_counts:
    missingCounts,
  invalid_field_counts:
    invalidCounts,
  warning_counts:
    warningCounts,
  province_counts:
    provinceCounts,
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
  `ROWS_TOTAL=${records.length}`
);

console.log(
  `ACTIONABLE_TOTAL=${actionable.length}`
);

console.log(
  `NEEDS_ENRICHMENT=${enrichment.length}`
);

console.log(
  `TSV=${path.relative(ROOT, TSV_PATH)}`
);

console.log(
  `SUMMARY=${path.relative(ROOT, SUMMARY_PATH)}`
);
