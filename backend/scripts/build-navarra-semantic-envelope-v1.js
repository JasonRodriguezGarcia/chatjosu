#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  mapNavarraSourceTaxonomyV1,
} from "./lib/navarra-source-taxonomy-mapper-v1.js";

import {
  classifyAssociationRelevance,
} from "./lib/association-relevance-v1.js";

import {
  mapAssociationTagsV1,
} from "./lib/association-tag-mapper-v1.js";

import {
  buildAssociationSemanticCandidateGateV1,
} from "./lib/association-semantic-candidate-gate-v1.js";

import {
  buildAssociationFunctionEvidenceGateV1,
} from "./lib/association-function-evidence-gate-v1.js";

import {
  buildAssociationUtilityGateV1,
} from "./lib/association-utility-gate-v1.js";

const ROOT = process.cwd();

const SOURCE_ID =
  "navarra_registro_asociaciones";

const NORMALIZED_PATH =
  path.join(
    ROOT,
    "data/acquisition/",
    SOURCE_ID,
    "normalized.jsonl"
  );

const OUT_DIR =
  path.join(
    ROOT,
    "data/curation/semantic/envelopes"
  );

const OUTPUT_PATH =
  path.join(
    OUT_DIR,
    "navarra-semantic-envelope-v1.jsonl"
  );

const REPORT_PATH =
  path.join(
    OUT_DIR,
    "navarra-semantic-envelope-v1.report.json"
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

function uniqueKeys(rows) {
  return [
    ...new Set(
      (rows ?? [])
        .map(row => row.key)
        .filter(Boolean)
    ),
  ];
}

function semanticCount(object) {
  return Object.values(
    object ?? {}
  ).reduce(
    (sum, values) =>
      sum + (
        Array.isArray(values)
          ? values.length
          : 0
      ),
    0
  );
}

fs.mkdirSync(
  OUT_DIR,
  {
    recursive: true,
  }
);

const candidates =
  readJsonl(
    NORMALIZED_PATH
  );

if (
  candidates.length !== 10254
) {
  throw new Error(
    "UNEXPECTED_NAVARRA_NORMALIZED_ROWS:"
    + candidates.length
  );
}

const output = [];

const report = {
  format_version: 1,

  source_id:
    SOURCE_ID,

  source_candidates:
    candidates.length,

  taxonomy: {
    matched: 0,
    unmatched: 0,

    modes: {
      source_assertion: 0,
      strong_candidate: 0,
      candidate_set: 0,
      context: 0,
      none: 0,
    },
  },

  relevance: {},

  utility: {
    keep: 0,
    drop: 0,
    protected: 0,
  },

  routing: {
    out_of_scope: 0,
    deterministic_only: 0,
    constrained: 0,
    llm_open: 0,
  },

  dimensions: {
    needs: 0,
    functions: 0,
    populations: 0,
    activities: 0,
  },

  signals: {
    need_or_function: 0,
    population_only: 0,
    activity_only: 0,
    no_signal: 0,
  },
};

for (
  const candidate
  of candidates
) {
  const name =
    String(
      candidate.name
      ?? ""
    );

  const description =
    String(
      candidate.description
      ?? ""
    );

  const sourceClass =
    candidate.original_category
    ?? null;

  const official =
    mapNavarraSourceTaxonomyV1({
      sourceClass,
    });

  if (official.matched) {
    report.taxonomy.matched += 1;

    if (
      Object.hasOwn(
        report.taxonomy.modes,
        official.mode
      )
    ) {
      report.taxonomy
        .modes[
          official.mode
        ] += 1;
    }
  } else {
    report.taxonomy
      .unmatched += 1;
  }

  /*
   * Navarra source class is provenance/context,
   * not generic semantic evidence.
   *
   * Generic gates may inspect the association
   * name and FINES/description only.
   *
   * Official CLASE semantics are handled solely
   * through mapNavarraSourceTaxonomyV1().
   */
  const relevance =
    classifyAssociationRelevance({
      name,

      categories: [],

      text: [
        description,
      ].filter(Boolean),
    });

  const relevanceKey =
    `${relevance.decision}:`
    + `${relevance.status}`;

  report.relevance[
    relevanceKey
  ] =
    (
      report.relevance[
        relevanceKey
      ] ?? 0
    ) + 1;

  const needsResult =
    mapAssociationTagsV1({
      name,
      description,

      originalCategory:
        null,
    });

  const semanticResult =
    buildAssociationSemanticCandidateGateV1({
      name,
      description,

      originalCategory:
        null,

      categoryGoal:
        null,
    });

  const functionResult =
    buildAssociationFunctionEvidenceGateV1({
      name,
      description,

      categoryGoal:
        null,
    });

  const needs =
    uniqueKeys(
      needsResult.tags
    );

  const functions =
    uniqueKeys(
      functionResult.candidates
    );

  const populations =
    uniqueKeys(
      semanticResult
        .populations
        ?.candidates
    );

  const activities =
    uniqueKeys(
      semanticResult
        .activities
        ?.candidates
    );

  const utility =
    buildAssociationUtilityGateV1({
      relevanceDecision:
        relevance.decision,

      needKeys:
        needs,

      functionKeys:
        functions,

      hints:
        official.hints,
    });

  report.utility[
    utility.decision
  ] += 1;

  if (utility.protected) {
    report.utility
      .protected += 1;
  }

  const officialAssertionCount =
    semanticCount(
      official.assertions
    );

  const explicitEvidenceCount =
    officialAssertionCount
    + needs.length
    + functions.length
    + populations.length
    + activities.length;

  const hasOfficialUncertainty =
    official.mode ===
      "strong_candidate"
    || official.mode ===
      "candidate_set"
    || official.mode ===
      "context";

  let route;

  if (
    utility.decision === "drop"
  ) {
    route =
      "out_of_scope";
  } else if (
    explicitEvidenceCount === 0
  ) {
    route =
      "llm_open";
  } else if (
    hasOfficialUncertainty
  ) {
    route =
      "constrained";
  } else {
    route =
      "deterministic_only";
  }

  report.routing[
    route
  ] += 1;

  if (needs.length) {
    report.dimensions
      .needs += 1;
  }

  if (functions.length) {
    report.dimensions
      .functions += 1;
  }

  if (populations.length) {
    report.dimensions
      .populations += 1;
  }

  if (activities.length) {
    report.dimensions
      .activities += 1;
  }

  if (
    needs.length
    || functions.length
  ) {
    report.signals
      .need_or_function += 1;
  } else if (
    populations.length
  ) {
    report.signals
      .population_only += 1;
  } else if (
    activities.length
  ) {
    report.signals
      .activity_only += 1;
  } else {
    report.signals
      .no_signal += 1;
  }

  output.push({
    format_version: 1,

    candidate_id:
      candidate.candidate_id,

    source_id:
      candidate.source_id
      ?? SOURCE_ID,

    source_record_id:
      candidate.source_record_id,

    content_hash:
      candidate.content_hash
      ?? null,

    name:
      candidate.name,

    description:
      candidate.description,

    province_key:
      candidate.province_key,

    municipality_name:
      candidate.municipality_name,

    relevance,

    utility,

    routing: {
      route,

      explicit_evidence_count:
        explicitEvidenceCount,

      official_mode:
        official.mode,
    },

    source_taxonomy: {
      class:
        sourceClass,

      scope:
        candidate.scope
        ?? null,

      mapping:
        official,
    },

    deterministic: {
      needs: {
        keys:
          needs,

        evidence:
          needsResult.tags
          ?? [],
      },

      functions: {
        keys:
          functions,

        evidence:
          functionResult.candidates
          ?? [],
      },

      populations: {
        keys:
          populations,

        evidence:
          semanticResult
            .populations
            ?.candidates
          ?? [],
      },

      activities: {
        keys:
          activities,

        evidence:
          semanticResult
            .activities
            ?.candidates
          ?? [],
      },
    },
  });
}

if (
  output.length !==
  candidates.length
) {
  throw new Error(
    "NAVARRA_ENVELOPE_PARITY_FAIL"
  );
}

const uniqueCandidateIds =
  new Set(
    output.map(
      row =>
        row.candidate_id
    )
  );

if (
  uniqueCandidateIds.size !==
  output.length
) {
  throw new Error(
    "NAVARRA_ENVELOPE_DUPLICATE_IDS"
  );
}

const routeTotal =
  Object.values(
    report.routing
  ).reduce(
    (a, b) => a + b,
    0
  );

if (
  routeTotal !==
  output.length
) {
  throw new Error(
    "NAVARRA_ROUTE_PARTITION_FAIL"
  );
}

if (
  report.taxonomy.unmatched
  !== 0
) {
  throw new Error(
    "NAVARRA_TAXONOMY_UNMATCHED:"
    + report.taxonomy.unmatched
  );
}

fs.writeFileSync(
  OUTPUT_PATH,
  output
    .map(
      row =>
        JSON.stringify(row)
    )
    .join("\n")
    + "\n"
);

fs.writeFileSync(
  REPORT_PATH,
  JSON.stringify(
    report,
    null,
    2
  )
  + "\n"
);

console.log(
  "INPUT_RECORDS=",
  candidates.length
);

console.log(
  "OUTPUT_RECORDS=",
  output.length
);

console.log(
  "UNIQUE_IDS=",
  uniqueCandidateIds.size
);

console.log();

console.log(
  "===== TAXONOMY MODES ====="
);

for (
  const [
    mode,
    count,
  ]
  of Object.entries(
    report.taxonomy.modes
  )
) {
  console.log(
    count,
    mode
  );
}

console.log();

console.log(
  "===== RELEVANCE ====="
);

for (
  const [
    key,
    count,
  ]
  of Object.entries(
    report.relevance
  ).sort(
    (a, b) =>
      b[1] - a[1]
  )
) {
  console.log(
    count,
    key
  );
}

console.log();

console.log(
  "===== UTILITY ====="
);

for (
  const key of [
    "keep",
    "drop",
    "protected",
  ]
) {
  console.log(
    report.utility[key],
    key
  );
}

console.log();

console.log(
  "===== ROUTING ====="
);

for (
  const [
    route,
    count,
  ]
  of Object.entries(
    report.routing
  )
) {
  console.log(
    count,
    route
  );
}

console.log();

console.log(
  "===== SIGNALS ====="
);

for (
  const [
    key,
    count,
  ]
  of Object.entries(
    report.signals
  )
) {
  console.log(
    count,
    key
  );
}

console.log();

console.log(
  "NAVARRA_SEMANTIC_ENVELOPE_V1=PASS"
);
