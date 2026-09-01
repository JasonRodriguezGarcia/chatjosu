import fs from "node:fs";
import path from "node:path";

import {
  mapAssociationTagsV1,
} from "./lib/association-tag-mapper-v1.js";

const ROOT = process.cwd();

const SOURCE_DIR =
  process.argv[2] ??
  "euskadi_registro_asociaciones";

const SOURCE_ROOT =
  path.join(
    ROOT,
    "data/acquisition",
    SOURCE_DIR
  );

const INPUT_NAME =
  process.argv[3] ??
  "normalized.jsonl";

const GATE =
  process.argv[4] ??
  "strict";

const INPUT =
  path.join(
    SOURCE_ROOT,
    INPUT_NAME
  );

const OUTPUT =
  path.join(
    SOURCE_ROOT,
    "runtime-candidates.jsonl"
  );

const PREFLIGHT =
  path.join(
    SOURCE_ROOT,
    "runtime-preflight.json"
  );

function readJsonl(filename) {
  return fs
    .readFileSync(
      filename,
      "utf8"
    )
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(JSON.parse);
}

function increment(
  object,
  key,
  amount = 1
) {
  object[key] =
    (object[key] ?? 0) +
    amount;
}

function isStrictRelevance(row) {
  const reasons =
    new Set(
      row.relevance?.reasons ?? []
    );

  return (
    reasons.has(
      "direct_category"
    ) ||
    reasons.has(
      "hard_direct_purpose"
    )
  );
}

function isDirectRelevance(row) {
  return (
    row.relevance?.status ===
    "direct_relevance"
  );
}

function passesGate(row) {
  if (GATE === "direct") {
    return isDirectRelevance(row);
  }

  if (GATE !== "strict") {
    throw new Error(
      "UNKNOWN_GATE=" + GATE
    );
  }

  return isStrictRelevance(row);
}

if (
  GATE !== "strict" &&
  GATE !== "direct"
) {
  throw new Error(
    "UNKNOWN_GATE=" + GATE
  );
}

const rows =
  readJsonl(INPUT);

const output = [];

const preflight = {
  format_version: 1,
  projection_version: "1.0",

  source_rows:
    rows.length,

  relevance: {
    strict_candidates: 0,
    rejected_non_strict: 0,
  },

  tagging: {
    high_associations: 0,
    review_only: 0,
    unmapped: 0,
    high_single_tag: 0,
    high_multiple_tags: 0,
    tag_assignments: 0,
    by_tag: {},
  },

  territory: {
    resolved: 0,
    unresolved: 0,
    by_province: {},
  },

  contacts: {
    with_phone: 0,
    with_email: 0,
    with_website: 0,
    with_any_contact: 0,
    without_direct_contact: 0,
    with_official_registry_url: 0,
  },

  coordinates: {
    with_coordinates: 0,
    without_coordinates: 0,
  },

  dedupe: {
    new_candidate: 0,
    exact_duplicate: 0,
    probable_duplicate: 0,
  },

  quality: {
    missing_name: 0,
    missing_municipality: 0,
    missing_province: 0,
  },
};

for (const row of rows) {
  if (!passesGate(row)) {
    preflight
      .relevance
      .rejected_non_strict += 1;

    continue;
  }

  preflight
    .relevance
    .strict_candidates += 1;

  const mapped =
    mapAssociationTagsV1({
      name: row.name,
      description:
        row.description,
      originalCategory:
        row.original_category,
    });

  const highTags =
    mapped.tags.filter(
      tag =>
        tag.confidence ===
        "high"
    );

  const reviewTags =
    mapped.tags.filter(
      tag =>
        tag.confidence ===
        "review"
    );

  if (!highTags.length) {
    if (reviewTags.length) {
      preflight
        .tagging
        .review_only += 1;
    } else {
      preflight
        .tagging
        .unmapped += 1;
    }

    continue;
  }

  preflight
    .tagging
    .high_associations += 1;

  preflight
    .tagging
    .tag_assignments +=
      highTags.length;

  if (highTags.length === 1) {
    preflight
      .tagging
      .high_single_tag += 1;
  } else {
    preflight
      .tagging
      .high_multiple_tags += 1;
  }

  for (const tag of highTags) {
    increment(
      preflight
        .tagging
        .by_tag,
      tag.key
    );
  }

  if (row.province_key) {
    preflight
      .territory
      .resolved += 1;

    increment(
      preflight
        .territory
        .by_province,
      row.province_key
    );
  } else {
    preflight
      .territory
      .unresolved += 1;
  }

  const hasPhone =
    Boolean(
      row.phone
    );

  const hasEmail =
    Boolean(
      row.email
    );

  const hasWebsite =
    Boolean(
      row.website
    );

  if (hasPhone) {
    preflight
      .contacts
      .with_phone += 1;
  }

  if (hasEmail) {
    preflight
      .contacts
      .with_email += 1;
  }

  if (hasWebsite) {
    preflight
      .contacts
      .with_website += 1;
  }

  if (
    hasPhone ||
    hasEmail ||
    hasWebsite
  ) {
    preflight
      .contacts
      .with_any_contact += 1;
  } else {
    preflight
      .contacts
      .without_direct_contact += 1;
  }

  if (
    row.source?.record_url ||
    row.source?.detail_url
  ) {
    preflight
      .contacts
      .with_official_registry_url += 1;
  }

  if (
    Number.isFinite(
      row.latitude
    ) &&
    Number.isFinite(
      row.longitude
    )
  ) {
    preflight
      .coordinates
      .with_coordinates += 1;
  } else {
    preflight
      .coordinates
      .without_coordinates += 1;
  }

  const dedupeStatus =
    row.dedupe?.status ??
    "new_candidate";

  increment(
    preflight.dedupe,
    dedupeStatus
  );

  if (!row.name) {
    preflight
      .quality
      .missing_name += 1;
  }

  if (!row.municipality_name) {
    preflight
      .quality
      .missing_municipality += 1;
  }

  if (!row.province_key) {
    preflight
      .quality
      .missing_province += 1;
  }

  output.push({
    candidate_id:
      row.candidate_id,

    name:
      row.name,

    tax_id:
      row.tax_id,

    scope:
      row.scope,

    province_key:
      row.province_key,

    province_name:
      row.province_name,

    municipality_key:
      row.municipality_key,

    municipality_name:
      row.municipality_name,

    address:
      row.address,

    postal_code:
      row.postal_code,

    latitude:
      row.latitude,

    longitude:
      row.longitude,

    phone:
      row.phone,

    email:
      row.email,

    website:
      row.website,

    description:
      row.description,

    tags:
      highTags.map(
        tag => ({
          key:
            tag.key,
          confidence:
            tag.confidence,
          evidence:
            tag.evidence,
        })
      ),

    review_tags:
      reviewTags.map(
        tag => ({
          key:
            tag.key,
          confidence:
            tag.confidence,
          evidence:
            tag.evidence,
        })
      ),

    runtime_eligible:
      true,

    runtime_reason:
      "strict_relevance+high_confidence_need",

    relevance:
      row.relevance,

    resource_role:
      "primary_candidate",

    dedupe:
      row.dedupe,

    source:
      row.source,
  });
}

preflight.runtime_candidates =
  output.length;

preflight.generated_at =
  new Date().toISOString();

if (
  output.length !==
  preflight
    .tagging
    .high_associations
) {
  throw new Error(
    "RUNTIME_COUNT_INVARIANT_FAILED"
  );
}

fs.writeFileSync(
  OUTPUT,
  output
    .map(
      row =>
        JSON.stringify(row)
    )
    .join("\n") +
    "\n",
  "utf8"
);

fs.writeFileSync(
  PREFLIGHT,
  JSON.stringify(
    preflight,
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(
  "SOURCE_NORMALIZED=" +
  preflight.source_rows
);

console.log(
  "STRICT=" +
  preflight
    .relevance
    .strict_candidates
);

console.log(
  "RUNTIME_CANDIDATES=" +
  preflight.runtime_candidates
);

console.log(
  "TAG_ASSIGNMENTS=" +
  preflight
    .tagging
    .tag_assignments
);

console.log(
  "MULTI_TAG=" +
  preflight
    .tagging
    .high_multiple_tags
);

console.log(
  "OUTPUT=" +
  path.relative(
    ROOT,
    OUTPUT
  )
);

console.log(
  "PREFLIGHT=" +
  path.relative(
    ROOT,
    PREFLIGHT
  )
);
