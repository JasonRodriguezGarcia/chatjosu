#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const ENVELOPE_PATH = path.join(
  ROOT,
  "data/curation/semantic/envelopes/",
  "euskadi-semantic-envelope-v1.jsonl"
);

const CONTEXT_PATH = path.join(
  ROOT,
  "data/curation/semantic/workloads/",
  "euskadi-context-only-v1.jsonl"
);

const CANDIDATE_PATH = path.join(
  ROOT,
  "data/curation/semantic/workloads/",
  "euskadi-qwen-candidate-resolution-v1.json"
);

const RECONCILIATION_PATH = path.join(
  ROOT,
  "data/curation/semantic/reconciliation/",
  "euskadi-candidate-resolution-v1.jsonl"
);

const OUTPUT_DIR = path.join(
  ROOT,
  "data/curation/semantic/census"
);

const OUTPUT_PATH = path.join(
  OUTPUT_DIR,
  "euskadi-semantic-census-v1.jsonl"
);

const REPORT_PATH = path.join(
  OUTPUT_DIR,
  "euskadi-semantic-census-v1.report.json"
);

function readJson(file) {
  return JSON.parse(
    fs.readFileSync(file, "utf8")
  );
}

function readJsonl(file) {
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function uniq(values) {
  return [...new Set(values)];
}

function deterministicDimension(
  envelope,
  dimension
) {
  const value =
    envelope.deterministic &&
    envelope.deterministic[dimension];

  if (
    !value ||
    typeof value !== "object"
  ) {
    return {
      keys: [],
      evidence: [],
    };
  }

  return {
    keys: Array.isArray(value.keys)
      ? uniq(value.keys)
      : [],
    evidence:
      Array.isArray(value.evidence)
        ? value.evidence
        : [],
  };
}

function evidenceRef(entry) {
  if (
    !entry ||
    typeof entry !== "object"
  ) {
    return null;
  }

  const evidence =
    entry.evidence &&
    typeof entry.evidence === "object"
      ? entry.evidence
      : entry;

  if (evidence.evidence_ref) {
    return evidence.evidence_ref;
  }

  if (
    evidence.field === "description"
  ) {
    return "D1";
  }

  if (evidence.field === "name") {
    return "N1";
  }

  if (
    evidence.field === "category_goal"
  ) {
    return "C3";
  }

  return null;
}

function exactEvidence(
  envelope,
  dimension,
  key
) {
  const value =
    deterministicDimension(
      envelope,
      dimension
    );

  return value.evidence.filter(
    (entry) =>
      entry &&
      entry.key === key
  );
}

function sourceMapping(envelope) {
  return (
    envelope.source_taxonomy &&
    envelope.source_taxonomy.mapping
  ) || {};
}

function mappingKeys(
  envelope,
  group,
  dimension
) {
  const mapping =
    sourceMapping(envelope);

  const container =
    mapping[group];

  if (
    !container ||
    typeof container !== "object"
  ) {
    return [];
  }

  const value =
    container[dimension];

  return Array.isArray(value)
    ? value.filter(
        (key) =>
          typeof key === "string"
      )
    : [];
}

function classifyDeterministicConcept(
  envelope,
  dimension,
  key
) {
  const evidence =
    exactEvidence(
      envelope,
      dimension,
      key
    );

  const refs = uniq(
    evidence
      .map(evidenceRef)
      .filter(Boolean)
  );

  const assertions =
    new Set(
      mappingKeys(
        envelope,
        "assertions",
        dimension
      )
    );

  const candidates =
    new Set(
      mappingKeys(
        envelope,
        "candidates",
        dimension
      )
    );

  if (
    refs.includes("D1")
  ) {
    return {
      key,
      quality: "strong",
      reason: "deterministic_d1",
      evidence_refs: refs,
      source_assertion:
        assertions.has(key),
      source_candidate:
        candidates.has(key),
    };
  }

  if (assertions.has(key)) {
    return {
      key,
      quality: "strong",
      reason: "source_assertion",
      evidence_refs: refs,
      source_assertion: true,
      source_candidate:
        candidates.has(key),
    };
  }

  if (
    evidence.length > 0 &&
    candidates.has(key)
  ) {
    return {
      key,
      quality: "corroborated",
      reason:
        "deterministic_plus_source_candidate",
      evidence_refs: refs,
      source_assertion: false,
      source_candidate: true,
    };
  }

  return {
    key,
    quality: "weak",
    reason:
      "non_substantive_deterministic",
    evidence_refs: refs,
    source_assertion: false,
    source_candidate:
      candidates.has(key),
  };
}

function deterministicCore(envelope) {
  const out = [];

  for (
    const dimension of [
      "needs",
      "functions",
    ]
  ) {
    const value =
      deterministicDimension(
        envelope,
        dimension
      );

    for (const key of value.keys) {
      out.push({
        dimension,
        ...classifyDeterministicConcept(
          envelope,
          dimension,
          key
        ),
      });
    }
  }

  return out;
}

function deterministicContext(
  envelope
) {
  const out = {};

  for (
    const dimension of [
      "needs",
      "functions",
      "populations",
      "activities",
    ]
  ) {
    out[dimension] =
      deterministicDimension(
        envelope,
        dimension
      ).keys;
  }

  return out;
}

const envelope =
  readJsonl(ENVELOPE_PATH);

const contextRows =
  readJsonl(CONTEXT_PATH);

const candidateRows =
  readJson(CANDIDATE_PATH)
    .records;

const reconciledRows =
  readJsonl(
    RECONCILIATION_PATH
  );

const contextIds = new Set(
  contextRows.map(
    (row) => row.candidate_id
  )
);

const candidateIds = new Set(
  candidateRows.map(
    (row) => row.candidate_id
  )
);

const reconciliationById =
  new Map(
    reconciledRows.map(
      (row) => [
        row.candidate_id,
        row,
      ]
    )
  );

if (
  envelope.length !== 20382
) {
  throw new Error(
    `Unexpected envelope size: ${envelope.length}`
  );
}

if (
  new Set(
    envelope.map(
      (row) => row.candidate_id
    )
  ).size !== envelope.length
) {
  throw new Error(
    "Duplicate candidate_id in envelope"
  );
}

if (
  candidateIds.size !== 3698
) {
  throw new Error(
    `Unexpected candidate_resolution size: ${candidateIds.size}`
  );
}

if (
  contextIds.size !== 2968
) {
  throw new Error(
    `Unexpected context_only size: ${contextIds.size}`
  );
}

if (
  reconciliationById.size !==
  candidateIds.size
) {
  throw new Error(
    "Reconciliation size mismatch"
  );
}

const rows = [];

const routeCounts = {};
const resolutionCounts = {};
const deterministicQualityRecords = {
  strong: 0,
  corroborated: 0,
  weak: 0,
};

let taxonomyReview = 0;

function inc(object, key) {
  object[key] =
    (object[key] || 0) + 1;
}

for (const env of envelope) {
  const cid =
    env.candidate_id;

  const originalRoute =
    env.routing &&
    env.routing.route;

  let route;

  if (
    originalRoute ===
    "deterministic_only"
  ) {
    route =
      "deterministic_only";
  } else if (
    originalRoute === "llm_open"
  ) {
    route = "llm_open";
  } else if (
    originalRoute ===
    "constrained"
  ) {
    if (candidateIds.has(cid)) {
      route =
        "candidate_resolution";
    } else if (
      contextIds.has(cid)
    ) {
      route = "context_only";
    } else {
      throw new Error(
        `Unmaterialized constrained record: ${cid}`
      );
    }
  } else {
    throw new Error(
      `Unexpected route ${originalRoute} for ${cid}`
    );
  }

  inc(routeCounts, route);

  const deterministic =
    deterministicContext(env);

  const core =
    deterministicCore(env);

  let resolutionLevel;
  let semanticStatus;
  let taxonomyReviewFlag = false;
  let candidateCoreStatus = null;
  let candidateCoreEvidence = [];

  if (
    route ===
    "candidate_resolution"
  ) {
    const rec =
      reconciliationById.get(cid);

    if (!rec) {
      throw new Error(
        `Missing reconciliation: ${cid}`
      );
    }

    candidateCoreStatus =
      rec.core_status;

    candidateCoreEvidence =
      rec.core_evidence || [];

    taxonomyReviewFlag =
      Boolean(
        rec.taxonomy_review
      );

    if (
      rec.core_status ===
      "resolved_strong"
    ) {
      resolutionLevel =
        "resolved_strong";
    } else if (
      rec.core_status ===
      "resolved_corroborated"
    ) {
      resolutionLevel =
        "resolved_corroborated";
    } else if (
      rec.core_status ===
      "review_weak"
    ) {
      resolutionLevel =
        "review_weak";
    } else if (
      rec.core_status ===
      "context_population_only"
    ) {
      resolutionLevel =
        "context_population_only";
    } else {
      resolutionLevel =
        "insufficient";
    }

    semanticStatus =
      rec.semantic_status;
  } else if (
    route ===
    "deterministic_only"
  ) {
    const strong =
      core.some(
        (item) =>
          item.quality === "strong"
      );

    const corroborated =
      core.some(
        (item) =>
          item.quality ===
          "corroborated"
      );

    const weak =
      core.some(
        (item) =>
          item.quality === "weak"
      );

    if (strong) {
      resolutionLevel =
        "resolved_strong";
      semanticStatus =
        "resolved";
      deterministicQualityRecords
        .strong += 1;
    } else if (corroborated) {
      resolutionLevel =
        "resolved_corroborated";
      semanticStatus =
        "resolved";
      deterministicQualityRecords
        .corroborated += 1;
    } else if (weak) {
      resolutionLevel =
        "review_weak";
      semanticStatus =
        "review";
      deterministicQualityRecords
        .weak += 1;
    } else if (
      deterministic.populations
        .length > 0
    ) {
      resolutionLevel =
        "context_population_only";
      semanticStatus =
        "insufficient";
    } else if (
      deterministic.activities
        .length > 0
    ) {
      resolutionLevel =
        "activity_only";
      semanticStatus =
        "insufficient";
    } else {
      resolutionLevel =
        "no_signal";
      semanticStatus =
        "insufficient";
    }
  } else if (
    route === "context_only"
  ) {
    /*
     * Preserve this route as contextual.
     * We inventory its deterministic
     * signals but do not automatically
     * promote them in V1.
     */
    if (
      deterministic.needs.length ||
      deterministic.functions.length
    ) {
      resolutionLevel =
        "context_with_core_signal";
    } else if (
      deterministic.populations.length
    ) {
      resolutionLevel =
        "context_population_only";
    } else if (
      deterministic.activities.length
    ) {
      resolutionLevel =
        "context_activity_only";
    } else {
      resolutionLevel =
        "context_no_signal";
    }

    semanticStatus =
      "context";
  } else {
    resolutionLevel =
      "unresolved_open";
    semanticStatus =
      "unresolved";
  }

  if (taxonomyReviewFlag) {
    taxonomyReview += 1;
  }

  inc(
    resolutionCounts,
    resolutionLevel
  );

  rows.push({
    candidate_id: cid,
    source_id:
      env.source_id,
    source_record_id:
      env.source_record_id,
    content_hash:
      env.content_hash,

    name:
      env.name,
    description:
      env.description,
    province_key:
      env.province_key,
    municipality_name:
      env.municipality_name,

    route,
    original_route:
      originalRoute,

    resolution_level:
      resolutionLevel,

    semantic_status:
      semanticStatus,

    taxonomy_review:
      taxonomyReviewFlag,

    relevance:
      env.relevance,

    utility:
      env.utility,

    source_taxonomy:
      env.source_taxonomy,

    deterministic,

    deterministic_core_evidence:
      core,

    candidate_resolution:
      route ===
      "candidate_resolution"
        ? {
            core_status:
              candidateCoreStatus,
            core_evidence:
              candidateCoreEvidence,
          }
        : null,
  });
}

if (
  rows.length !== 20382
) {
  throw new Error(
    `Output size mismatch: ${rows.length}`
  );
}

if (
  new Set(
    rows.map(
      (row) => row.candidate_id
    )
  ).size !== rows.length
) {
  throw new Error(
    "Duplicate output candidate_id"
  );
}

const expectedRoutes = {
  deterministic_only: 8947,
  candidate_resolution: 3698,
  context_only: 2968,
  llm_open: 4769,
};

for (
  const [
    route,
    expected,
  ] of Object.entries(
    expectedRoutes
  )
) {
  const actual =
    routeCounts[route] || 0;

  if (actual !== expected) {
    throw new Error(
      `Route ${route}: expected ${expected}, got ${actual}`
    );
  }
}

const report = {
  format_version: "1",
  dataset:
    "euskadi-semantic-census-v1",

  input_records:
    envelope.length,

  output_records:
    rows.length,

  routes:
    routeCounts,

  resolution_levels:
    resolutionCounts,

  deterministic_only_core_quality_records:
    deterministicQualityRecords,

  taxonomy_review_records:
    taxonomyReview,

  invariants: {
    unique_candidate_ids:
      true,
    route_partition_complete:
      true,
    candidate_reconciliation_parity:
      reconciliationById.size ===
      candidateIds.size,
    context_candidate_overlap:
      [...contextIds].filter(
        (id) =>
          candidateIds.has(id)
      ).length,
  },
};

fs.mkdirSync(
  OUTPUT_DIR,
  {
    recursive: true,
  }
);

fs.writeFileSync(
  OUTPUT_PATH,
  rows
    .map(
      (row) =>
        JSON.stringify(row)
    )
    .join("\n") + "\n"
);

fs.writeFileSync(
  REPORT_PATH,
  JSON.stringify(
    report,
    null,
    2
  ) + "\n"
);

console.log(
  "INPUT_RECORDS=",
  report.input_records
);

console.log(
  "OUTPUT_RECORDS=",
  report.output_records
);

console.log();
console.log("ROUTES=");

for (
  const [
    route,
    count,
  ] of Object.entries(
    routeCounts
  )
) {
  console.log(
    count,
    route
  );
}

console.log();
console.log(
  "RESOLUTION_LEVELS="
);

for (
  const [
    level,
    count,
  ] of Object.entries(
    resolutionCounts
  ).sort(
    (a, b) =>
      b[1] - a[1]
  )
) {
  console.log(
    count,
    level
  );
}

console.log();
console.log(
  "TAXONOMY_REVIEW_RECORDS=",
  taxonomyReview
);

console.log(
  "UNIFIED_CENSUS_V1=PASS"
);
