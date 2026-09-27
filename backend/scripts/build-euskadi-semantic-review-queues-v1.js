#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  buildAssociationSemanticReviewRouteV1,
} from "./lib/association-semantic-review-router-v1.js";

const ROOT =
  process.cwd();

const EUSKADI_PRIORITY_SUPPORT_CATEGORIES_V1 =
  [
    "Ayuda a Otros Colectivos",
    "Ayuda a Enfermos",
    "Ayuda a Grupos Marginados",
    "Promoción de Empleo",
    "Promoción del Menor",
    "Ayuda a Accid/Gru. Rescate",
    "Ayuda a Minusválidos",
    "Ayuda a Drogadictos",
    "Ayuda a Ancianos",
    "De Viudos-as",
    "De Divorciados-as",
  ];

const INPUT_PATH =
  path.join(
    ROOT,
    "data/curation/canonical/",
    "euskadi-canonical-v1.jsonl"
  );

const OUT_DIR =
  path.join(
    ROOT,
    "data/curation/semantic/",
    "review-queues"
  );

const REPORT_PATH =
  path.join(
    OUT_DIR,
    "euskadi-semantic-review-queues-v1.report.json"
  );

const QUEUE_PATHS = {
  support_critical:
    path.join(
      OUT_DIR,
      "euskadi-support-critical-v1.jsonl"
    ),

  support_review:
    path.join(
      OUT_DIR,
      "euskadi-support-review-v1.jsonl"
    ),

  semantic_zero:
    path.join(
      OUT_DIR,
      "euskadi-semantic-zero-v1.jsonl"
    ),
};

function sha256File(
  filename
) {
  return crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(filename)
    )
    .digest("hex");
}

const rows =
  fs.readFileSync(
    INPUT_PATH,
    "utf8"
  )
    .split(/\r?\n/)
    .map(line =>
      line.trim()
    )
    .filter(Boolean)
    .map(JSON.parse);

const queues = {
  support_critical: [],
  support_review: [],
  semantic_zero: [],
};

const counts = {
  support_critical: 0,
  support_review: 0,
  semantic_zero: 0,
  no_action: 0,
};

for (const row of rows) {
  const routing =
    buildAssociationSemanticReviewRouteV1({
      canonical: row,

      prioritySupportCategories:
        EUSKADI_PRIORITY_SUPPORT_CATEGORIES_V1,
    });

  counts[
    routing.route
  ] += 1;

  if (
    routing.route ===
    "no_action"
  ) {
    continue;
  }

  const item = {
    format_version: 1,

    canonical_id:
      row.identity
        .canonical_id,

    source_id:
      row.identity
        .source_id,

    source_record_id:
      row.identity
        .source_record_id,

    source_locator:
      row.identity
        .source_locator ??
      null,

    routing,

    /*
     * Language handling V1:
     *
     * - original strings are preserved;
     * - no translation or transliteration is
     *   applied before semantic inference;
     * - canonical semantic keys remain
     *   language-independent;
     * - Euskadi source material may contain
     *   Spanish, Basque or mixed text.
     *
     * These are source/context hints, not a
     * claim that every individual record uses
     * both languages.
     */
    language_context: {
      policy:
        "preserve_original",

      source_language_hints: [
        "es",
        "eu",
      ],

      detected_language:
        null,

      dialect_or_variant:
        null,

      translation_applied:
        false,
    },

    fields: {
      name:
        row.source_facts
          ?.name ??
        null,

      description:
        row.source_facts
          ?.description ??
        null,

      source_categories:
        row.source_facts
          ?.source_categories ??
        [],
    },

    existing_semantic:
      row.semantic,

    curation:
      row.curation,

    publication:
      row.publication,
  };

  queues[
    routing.route
  ].push(
    item
  );
}

if (
  rows.length !==
  28091
) {
  throw new Error(
    `CANONICAL_COUNT_MISMATCH:${rows.length}`
  );
}

if (
  counts.support_critical !==
  313
) {
  throw new Error(
    "SUPPORT_CRITICAL_COUNT_MISMATCH:" +
    counts.support_critical
  );
}

if (
  counts.support_review !==
  861
) {
  throw new Error(
    "SUPPORT_REVIEW_COUNT_MISMATCH:" +
    counts.support_review
  );
}

if (
  counts.semantic_zero !==
  4666
) {
  throw new Error(
    "SEMANTIC_ZERO_COUNT_MISMATCH:" +
    counts.semantic_zero
  );
}

if (
  counts.no_action !==
  22251
) {
  throw new Error(
    "NO_ACTION_COUNT_MISMATCH:" +
    counts.no_action
  );
}

fs.mkdirSync(
  OUT_DIR,
  {
    recursive: true,
  }
);

for (
  const [
    route,
    filename,
  ]
  of Object.entries(
    QUEUE_PATHS
  )
) {
  fs.writeFileSync(
    filename,
    queues[route]
      .map(row =>
        JSON.stringify(row)
      )
      .join("\n")
      + "\n",
    "utf8"
  );
}

const report = {
  format_version: 1,

  source_id:
    "euskadi_registro_asociaciones",

  input_rows:
    rows.length,

  input_sha256:
    sha256File(
      INPUT_PATH
    ),

  routes:
    counts,

  language_policy: {
    preserve_original:
      true,

    canonical_semantics_language_independent:
      true,

    source_language_hints: [
      "es",
      "eu",
    ],

    per_record_detection:
      "pending",

    dialect_or_variant_detection:
      "pending",
  },

  outputs:
    Object.fromEntries(
      Object.entries(
        QUEUE_PATHS
      ).map(
        ([
          route,
          filename,
        ]) => [
          route,
          path.relative(
            ROOT,
            filename
          ),
        ]
      )
    ),
};

fs.writeFileSync(
  REPORT_PATH,
  JSON.stringify(
    report,
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(
  "CANONICAL=",
  rows.length
);

console.log(
  "SUPPORT_CRITICAL=",
  counts.support_critical
);

console.log(
  "SUPPORT_REVIEW=",
  counts.support_review
);

console.log(
  "SEMANTIC_ZERO=",
  counts.semantic_zero
);

console.log(
  "NO_ACTION=",
  counts.no_action
);

console.log(
  "LANGUAGE_POLICY=preserve_original"
);

console.log(
  "SEMANTIC_REVIEW_QUEUE_BUILD=PASS"
);
