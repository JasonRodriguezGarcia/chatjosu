#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT =
  process.cwd();

const QUEUE_PATH =
  path.join(
    ROOT,
    "data/curation/semantic/review-queues/",
    "euskadi-support-critical-v1.jsonl"
  );

const NORMALIZED_PATH =
  path.join(
    ROOT,
    "data/acquisition/",
    "euskadi_registro_asociaciones/",
    "normalized.jsonl"
  );

const PROFILE_PATH =
  path.join(
    ROOT,
    "data/curation/semantic/",
    "semantic-profile-v1.json"
  );

const TAXONOMY_PATH =
  path.join(
    ROOT,
    "data/curation/",
    "tag-taxonomy-v2.proposal.json"
  );

const PROMPT_PATH =
  path.join(
    ROOT,
    "data/curation/semantic/prompts/",
    "discovery-single-v3.txt"
  );

const OUT_DIR =
  path.join(
    ROOT,
    "data/curation/semantic/",
    "review-queues/run-input"
  );

const OUTPUT_PATH =
  path.join(
    OUT_DIR,
    "euskadi-support-critical-run-input-v1.json"
  );

const REPORT_PATH =
  path.join(
    OUT_DIR,
    "euskadi-support-critical-run-input-v1.report.json"
  );

function readJsonl(
  filename
) {
  return fs
    .readFileSync(
      filename,
      "utf8"
    )
    .split(/\r?\n/)
    .map(line =>
      line.trim()
    )
    .filter(Boolean)
    .map(JSON.parse);
}

function sha256File(
  filename
) {
  return crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(
        filename
      )
    )
    .digest("hex");
}

function firstString(
  ...values
) {
  for (const value of values) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function sourceRecordId(
  row
) {
  return firstString(
    row.source_record_id,
    row.source?.record_id,
    row.source?.source_record_id
  );
}

const queue =
  readJsonl(
    QUEUE_PATH
  );

const normalized =
  readJsonl(
    NORMALIZED_PATH
  );

const profile =
  JSON.parse(
    fs.readFileSync(
      PROFILE_PATH,
      "utf8"
    )
  );

const taxonomy =
  JSON.parse(
    fs.readFileSync(
      TAXONOMY_PATH,
      "utf8"
    )
  );

const normalizedByRecordId =
  new Map();

for (const row of normalized) {
  const id =
    sourceRecordId(row);

  if (!id) {
    continue;
  }

  if (
    normalizedByRecordId
      .has(id)
  ) {
    throw new Error(
      "DUPLICATE_NORMALIZED_SOURCE_RECORD_ID:" +
      id
    );
  }

  normalizedByRecordId.set(
    id,
    row
  );
}

const allowed = {
  relevance_classes:
    profile.relevance_classes,

  relation_roles:
    profile.relation_roles,

  confidence_levels:
    profile.confidence_levels,

  needs:
    taxonomy.needs,

  functions:
    profile.initial_functions,

  populations:
    profile.initial_populations,

  activities:
    profile.initial_activities,

  organization_types:
    profile.organization_types,

  service_modes:
    profile.service_modes,
};

const records = [];

const evidenceCoverage = {
  N1: 0,
  C1: 0,
  C2: 0,
  C3: 0,
  S1: 0,
  T1: 0,
  M1: 0,
  D1: 0,
};

let missingNormalized = 0;

for (const item of queue) {
  const recordId =
    firstString(
      item.source_record_id
    );

  const source =
    recordId
      ? normalizedByRecordId
          .get(recordId)
      : null;

  if (!source) {
    missingNormalized += 1;

    throw new Error(
      "SUPPORT_CRITICAL_NORMALIZED_JOIN_FAILED:" +
      item.canonical_id
    );
  }

  const categories =
    Array.isArray(
      source.source_categories
    )
      ? source.source_categories
      : [];

  /*
   * Euskadi normalized source categories carry
   * sorting / goal hierarchy. The registral
   * section can be recovered independently.
   *
   * Never merge these fields: the model must
   * know which source field supports a result.
   */
  const fields = {
    N1:
      firstString(
        source.name,
        item.fields?.name
      ),

    C1:
      firstString(
        source.tipo_registro,
        source.source
          ?.tipo_registro,
        source.source
          ?.record_type,
        "Asociación"
      ),

    C2:
      firstString(
        categories[0]
      ),

    C3:
      firstString(
        categories[1],
        source.original_category
      ),

    S1:
      firstString(
        source.scope
      ),

    T1:
      firstString(
        source.province_name,
        source.territory
      ),

    M1:
      firstString(
        source.municipality_name
      ),

    D1:
      firstString(
        source.description,
        item.fields
          ?.description
      ),
  };

  for (
    const key
    of Object.keys(
      evidenceCoverage
    )
  ) {
    if (fields[key]) {
      evidenceCoverage[
        key
      ] += 1;
    }
  }

  records.push({
    candidate_id:
      item.canonical_id,

    source_record_id:
      recordId,

    route:
      "llm_open",

    review_route:
      "support_critical",

    /*
     * Keep every source field separate.
     *
     * The model can combine evidence from
     * several fields, but must cite which
     * ones justify each semantic selection.
     */
    fields,

    existing_semantic:
      item.existing_semantic,

    language_context:
      item.language_context,

    publication:
      item.publication,

    routing:
      item.routing,
  });
}

if (
  records.length !== 313
) {
  throw new Error(
    "SUPPORT_CRITICAL_INPUT_COUNT_MISMATCH:" +
    records.length
  );
}

if (
  missingNormalized !== 0
) {
  throw new Error(
    "MISSING_NORMALIZED_ROWS:" +
    missingNormalized
  );
}

if (
  new Set(
    records.map(
      row =>
        row.candidate_id
    )
  ).size !==
  records.length
) {
  throw new Error(
    "DUPLICATE_CANDIDATE_ID"
  );
}

/*
 * N1 and registral categories are mandatory
 * for this workload. D1 is intentionally not:
 * four known records currently have no source
 * description and must remain inferable from
 * the other source fields without fabrication.
 */
if (
  evidenceCoverage.N1 !==
  313
) {
  throw new Error(
    "N1_COVERAGE_MISMATCH:" +
    evidenceCoverage.N1
  );
}

if (
  evidenceCoverage.C2 !==
  313
) {
  throw new Error(
    "C2_COVERAGE_MISMATCH:" +
    evidenceCoverage.C2
  );
}

if (
  evidenceCoverage.C3 !==
  313
) {
  throw new Error(
    "C3_COVERAGE_MISMATCH:" +
    evidenceCoverage.C3
  );
}

if (
  evidenceCoverage.D1 !==
  309
) {
  throw new Error(
    "D1_COVERAGE_MISMATCH:" +
    evidenceCoverage.D1
  );
}

fs.mkdirSync(
  OUT_DIR,
  {
    recursive: true,
  }
);

const output = {
  format_version: 3,

  workload_version:
    "euskadi-support-critical-v1",

  execution_contract: {
    runner_family:
      "semantic-discovery-v1",

    model:
      "qwen3:8b",

    prompt:
      path.relative(
        ROOT,
        PROMPT_PATH
      ),

    inference_policy:
      "proposal_only",

    source_evidence_fields: {
      N1: "name",
      C1: "registral_section",
      C2: "registral_sorting",
      C3: "registral_goal_type",
      S1: "scope",
      T1: "territory",
      M1: "municipality",
      D1: "description_or_purpose",
    },

    language_policy:
      "preserve_original",
  },

  allowed,

  records,
};

fs.writeFileSync(
  OUTPUT_PATH,
  JSON.stringify(
    output,
    null,
    2
  ) + "\n",
  "utf8"
);

const report = {
  format_version: 1,

  workload_version:
    output.workload_version,

  records:
    records.length,

  input_sha256:
    sha256File(
      QUEUE_PATH
    ),

  normalized_sha256:
    sha256File(
      NORMALIZED_PATH
    ),

  prompt_sha256:
    sha256File(
      PROMPT_PATH
    ),

  profile_sha256:
    sha256File(
      PROFILE_PATH
    ),

  taxonomy_sha256:
    sha256File(
      TAXONOMY_PATH
    ),

  evidence_coverage:
    evidenceCoverage,

  missing_normalized:
    missingNormalized,

  language_policy:
    "preserve_original",

  translation_applied:
    false,

  model_called:
    false,
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
  "RECORDS=",
  records.length
);

console.log(
  "EVIDENCE_COVERAGE=",
  JSON.stringify(
    evidenceCoverage
  )
);

console.log(
  "MISSING_NORMALIZED=",
  missingNormalized
);

console.log(
  "MODEL_CALLED=false"
);

console.log(
  "SUPPORT_CRITICAL_RUN_INPUT_BUILD=PASS"
);
