import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  mapEuskadiSourceTaxonomyV1,
} from "./lib/euskadi-source-taxonomy-mapper-v1.js";

import {
  mapAssociationTagsV1,
} from "./lib/association-tag-mapper-v1.js";

import {
  buildAssociationSemanticCandidateGateV1,
} from "./lib/association-semantic-candidate-gate-v1.js";

import {
  buildAssociationFunctionEvidenceGateV1,
} from "./lib/association-function-evidence-gate-v1.js";

const ROOT = process.cwd();

const SOURCE_DIR =
  "data/acquisition/euskadi_registro_asociaciones";

const NORMALIZED_PATH =
  path.join(
    ROOT,
    SOURCE_DIR,
    "normalized.jsonl"
  );

const RAW_PATH =
  path.join(
    ROOT,
    SOURCE_DIR,
    "raw/asociaciones.json"
  );

const OUT_DIR =
  path.join(
    ROOT,
    "data/curation/semantic/envelopes"
  );

const OUTPUT_PATH =
  path.join(
    OUT_DIR,
    "euskadi-semantic-envelope-v1.jsonl"
  );

const REPORT_PATH =
  path.join(
    OUT_DIR,
    "euskadi-semantic-envelope-v1.report.json"
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

function sha256File(filename) {
  return crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(filename)
    )
    .digest("hex");
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

const rawRows =
  JSON.parse(
    fs.readFileSync(
      RAW_PATH,
      "utf8"
    )
  );

const rawById =
  new Map(
    rawRows
      .filter(row => row.recNumRec)
      .map(row => [
        String(
          row.recNumRec
        ).trim(),
        row,
      ])
  );

const output = [];

const report = {
  format_version: 1,

  source_id:
    "euskadi_registro_asociaciones",

  source_candidates:
    candidates.length,

  missing_raw: 0,
  raw_resolved_by_source_row_index: 0,

  routing: {
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
};

for (const candidate of candidates) {
  const recordId =
    String(
      candidate.source_record_id
      ?? candidate.source?.record_id
      ?? ""
    ).trim();

  let raw =
    recordId
      ? rawById.get(
          recordId
        )
      : null;

  if (!raw) {
    const sourceRowIndex =
      candidate.source
        ?.source_row_index;

    if (
      Number.isInteger(
        sourceRowIndex
      )
      && sourceRowIndex >= 0
      && sourceRowIndex
        < rawRows.length
    ) {
      raw =
        rawRows[
          sourceRowIndex
        ];

      report
        .raw_resolved_by_source_row_index += 1;
    }
  }

  if (!raw) {
    report.missing_raw += 1;
    continue;
  }

  const name =
    String(
      candidate.name
      ?? raw.recName
      ?? ""
    );

  const description =
    String(
      candidate.description
      ?? raw.recGoal
      ?? ""
    );

  const official =
    mapEuskadiSourceTaxonomyV1({
      section:
        raw.asoSection,

      sorting:
        raw.asoSorting,

      goalType:
        raw.asoGoalType,
    });

  const needsResult =
    mapAssociationTagsV1({
      name,
      description,

      originalCategory:
        raw.asoGoalType,
    });

  const semanticResult =
    buildAssociationSemanticCandidateGateV1({
      name,
      description,

      categorySection:
        raw.asoSection,

      categorySorting:
        raw.asoSorting,

      categoryGoal:
        raw.asoGoalType,
    });

  const functionResult =
    buildAssociationFunctionEvidenceGateV1({
      name,
      description,

      categorySection:
        raw.asoSection,

      categorySorting:
        raw.asoSorting,

      categoryGoal:
        raw.asoGoalType,
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

  report
    .routing[
      route
    ] += 1;

  if (needs.length) {
    report
      .dimensions
      .needs += 1;
  }

  if (functions.length) {
    report
      .dimensions
      .functions += 1;
  }

  if (populations.length) {
    report
      .dimensions
      .populations += 1;
  }

  if (activities.length) {
    report
      .dimensions
      .activities += 1;
  }

  output.push({
    format_version: 1,

    candidate_id:
      candidate.candidate_id,

    source_id:
      candidate.source
        ?.source_id
      ?? "euskadi_registro_asociaciones",

    source_record_id:
      recordId,

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

    relevance:
      candidate.relevance,

    utility:
      candidate.utility,

    source_taxonomy: {
      section:
        raw.asoSection ?? null,

      sorting:
        raw.asoSorting ?? null,

      goal_type:
        raw.asoGoalType ?? null,

      scope:
        raw.asoScope ?? null,

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

    routing: {
      route,

      explicit_evidence_count:
        explicitEvidenceCount,

      official_mode:
        official.mode,
    },
  });
}

if (
  output.length
  !== (
    candidates.length
    - report.missing_raw
  )
) {
  throw new Error(
    "SEMANTIC_ENVELOPE_COUNT_MISMATCH"
  );
}

report.output_rows =
  output.length;

report.input_sha256 = {
  normalized:
    sha256File(
      NORMALIZED_PATH
    ),

  raw:
    sha256File(
      RAW_PATH
    ),
};

report.generated_at =
  new Date().toISOString();

fs.writeFileSync(
  OUTPUT_PATH,
  output
    .map(row =>
      JSON.stringify(row)
    )
    .join("\n")
    + "\n",
  "utf8"
);

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
  "INPUT_CANDIDATES=",
  candidates.length
);

console.log(
  "OUTPUT_ROWS=",
  output.length
);

console.log(
  "MISSING_RAW=",
  report.missing_raw
);

console.log(
  "ROUTING=",
  JSON.stringify(
    report.routing
  )
);

console.log(
  "DIMENSIONS=",
  JSON.stringify(
    report.dimensions
  )
);

console.log(
  "OUTPUT=",
  path.relative(
    ROOT,
    OUTPUT_PATH
  )
);

console.log(
  "REPORT=",
  path.relative(
    ROOT,
    REPORT_PATH
  )
);

console.log(
  "SEMANTIC_ENVELOPE_BUILD=PASS"
);
