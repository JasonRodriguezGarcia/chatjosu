#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const WORKLOAD_PATH = path.join(
  ROOT,
  "data/curation/semantic/workloads/" +
    "euskadi-qwen-candidate-resolution-v1.json"
);

const CONSOLIDATED_PATH = path.join(
  ROOT,
  "data/curation/semantic/discovery/consolidated/" +
    "euskadi-candidate-resolution-v1.jsonl"
);

const OUTPUT_DIR = path.join(
  ROOT,
  "data/curation/semantic/reconciliation"
);

const OUTPUT_PATH = path.join(
  OUTPUT_DIR,
  "euskadi-candidate-resolution-v1.jsonl"
);

const REPORT_PATH = path.join(
  OUTPUT_DIR,
  "euskadi-candidate-resolution-v1.report.json"
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

function unique(values) {
  return [...new Set(values)];
}

function canonicalKey(value) {
  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    typeof value.key === "string"
  ) {
    return value.key;
  }

  return null;
}

function canonicalKeys(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return unique(
    values
      .map(canonicalKey)
      .filter(Boolean)
  );
}

function getAllowedKeys(workload, dimension) {
  const allowed =
    workload.route_allowed || {};

  let values;

  if (dimension === "organization_type") {
    values = allowed.organization_types;
  } else {
    values = allowed[dimension];
  }

  return canonicalKeys(values);
}

function getDeterministic(
  workload,
  dimension
) {
  const deterministic =
    workload.semantic_context &&
    workload.semantic_context.deterministic &&
    workload.semantic_context.deterministic[
      dimension
    ];

  if (
    !deterministic ||
    typeof deterministic !== "object"
  ) {
    return {
      keys: [],
      evidence: [],
    };
  }

  return {
    keys: canonicalKeys(
      deterministic.keys
    ),
    evidence: Array.isArray(
      deterministic.evidence
    )
      ? deterministic.evidence
      : [],
  };
}

function getSourceMapping(workload) {
  return (
    (
      workload.semantic_context &&
      workload.semantic_context.source_mapping
    ) ||
    {}
  );
}

function getSourceCandidateKeys(
  workload,
  dimension
) {
  const mapping =
    getSourceMapping(workload);

  const candidates =
    mapping.candidates || {};

  return canonicalKeys(
    candidates[dimension]
  );
}

function getSourceAssertionKeys(
  workload,
  dimension
) {
  const mapping =
    getSourceMapping(workload);

  const assertions =
    mapping.assertions || {};

  return canonicalKeys(
    assertions[dimension]
  );
}

function parseQwenItems(
  result,
  dimension
) {
  const raw =
    result &&
    result[dimension];

  if (!Array.isArray(raw)) {
    return [];
  }

  if (
    dimension === "organization_type"
  ) {
    if (
      raw.length >= 1 &&
      typeof raw[0] === "string"
    ) {
      return [
        {
          key: raw[0],
          confidence:
            typeof raw[1] === "string"
              ? raw[1]
              : null,
          evidence_fields: [],
          raw,
        },
      ];
    }

    return [];
  }

  const out = [];

  for (const item of raw) {
    if (
      !Array.isArray(item) ||
      typeof item[0] !== "string"
    ) {
      continue;
    }

    if (dimension === "needs") {
      out.push({
        key: item[0],
        relation_role:
          typeof item[1] === "string"
            ? item[1]
            : null,
        confidence:
          typeof item[2] === "string"
            ? item[2]
            : null,
        evidence_fields:
          Array.isArray(item[3])
            ? item[3]
            : [],
        raw: item,
      });

      continue;
    }

    out.push({
      key: item[0],
      confidence:
        typeof item[1] === "string"
          ? item[1]
          : null,
      evidence_fields:
        Array.isArray(item[2])
          ? item[2]
          : [],
      raw: item,
    });
  }

  return out;
}

function buildDimension(
  workload,
  result,
  dimension
) {
  const deterministic =
    getDeterministic(
      workload,
      dimension
    );

  const allowed = getAllowedKeys(
    workload,
    dimension
  );

  const sourceCandidates =
    getSourceCandidateKeys(
      workload,
      dimension
    );

  const sourceAssertions =
    getSourceAssertionKeys(
      workload,
      dimension
    );

  const qwenItems =
    parseQwenItems(
      result,
      dimension
    );

  const allowedSet =
    new Set(allowed);

  const sourceCandidateSet =
    new Set(sourceCandidates);

  const sourceAssertionSet =
    new Set(sourceAssertions);

  const deterministicSet =
    new Set(deterministic.keys);

  const violations = [];

  for (const item of qwenItems) {
    if (
      !allowedSet.has(item.key)
    ) {
      violations.push({
        type: "qwen_outside_allowed",
        key: item.key,
      });
    }
  }

  const resolvedByKey =
    new Map();

  function ensure(key) {
    if (!resolvedByKey.has(key)) {
      resolvedByKey.set(
        key,
        {
          key,
          evidence_sources: [],
          confidence: "medium",
        }
      );
    }

    return resolvedByKey.get(key);
  }

  /*
   * Deterministic evidence is authoritative
   * for a canonical concept already emitted
   * by the deterministic mapper.
   */
  for (
    const key of deterministic.keys
  ) {
    const item = ensure(key);

    item.evidence_sources.push(
      "deterministic"
    );

    item.confidence = "high";

    item.deterministic_evidence =
      deterministic.evidence.filter(
        (evidence) =>
          evidence &&
          evidence.key === key
      );
  }

  /*
   * Explicit source assertions, if any,
   * are also authoritative.
   */
  for (
    const key of sourceAssertions
  ) {
    const item = ensure(key);

    item.evidence_sources.push(
      "source_assertion"
    );

    item.confidence = "high";
  }

  /*
   * Qwen may only select from the
   * constrained allowed vocabulary.
   */
  for (const qwen of qwenItems) {
    if (!allowedSet.has(qwen.key)) {
      continue;
    }

    const item = ensure(
      qwen.key
    );

    item.evidence_sources.push(
      "qwen_selection"
    );

    item.qwen = qwen;

    if (
      sourceAssertionSet.has(
        qwen.key
      )
    ) {
      item.confidence = "high";
    } else if (
      deterministicSet.has(
        qwen.key
      )
    ) {
      item.confidence = "high";
    } else if (
      sourceCandidateSet.has(
        qwen.key
      )
    ) {
      const mode =
        getSourceMapping(
          workload
        ).mode;

      item.confidence =
        mode === "strong_candidate"
          ? "high"
          : "medium";

      item.evidence_sources.push(
        "source_candidate"
      );
    } else {
      /*
       * Still constrained by route_allowed,
       * but not directly backed by the
       * source taxonomy candidate.
       */
      item.confidence = "medium";
    }
  }

  const resolved = [
    ...resolvedByKey.values(),
  ]
    .map((item) => ({
      ...item,
      evidence_sources: unique(
        item.evidence_sources
      ),
    }))
    .sort((a, b) =>
      a.key.localeCompare(b.key)
    );

  return {
    deterministic_keys:
      deterministic.keys,
    source_assertion_keys:
      sourceAssertions,
    source_candidate_keys:
      sourceCandidates,
    allowed_keys: allowed,
    qwen_selected:
      qwenItems,
    resolved,
    violations,
  };
}

function deterministicEvidenceRefs(item) {
  const refs = new Set();

  for (
    const entry of (
      item.deterministic_evidence || []
    )
  ) {
    const evidence =
      entry && entry.evidence
        ? entry.evidence
        : entry || {};

    const ref =
      evidence.evidence_ref ||
      (
        evidence.field === "description"
          ? "D1"
          : evidence.field === "name"
          ? "N1"
          : evidence.field === "category_goal"
          ? "C3"
          : null
      );

    if (ref) {
      refs.add(ref);
    }
  }

  return [...refs];
}

function classifyCoreEvidence(item) {
  const sources = new Set(
    item.evidence_sources || []
  );

  const qwenFields = new Set(
    (
      item.qwen &&
      item.qwen.evidence_fields
    ) || []
  );

  const deterministicRefs =
    new Set(
      deterministicEvidenceRefs(item)
    );

  const substantiveD1 =
    qwenFields.has("D1") ||
    deterministicRefs.has("D1");

  if (substantiveD1) {
    return {
      quality: "strong",
      reason: "substantive_d1",
      qwen_evidence_fields:
        [...qwenFields],
      deterministic_evidence_refs:
        [...deterministicRefs],
    };
  }

  const independentSignals =
    [
      sources.has("deterministic"),
      sources.has("qwen_selection"),
      sources.has("source_candidate"),
      sources.has("source_assertion"),
    ].filter(Boolean).length;

  if (
    sources.has("source_assertion")
  ) {
    return {
      quality: "strong",
      reason: "source_assertion",
      qwen_evidence_fields:
        [...qwenFields],
      deterministic_evidence_refs:
        [...deterministicRefs],
    };
  }

  if (independentSignals >= 2) {
    return {
      quality: "corroborated",
      reason:
        "multiple_non_d1_signals",
      qwen_evidence_fields:
        [...qwenFields],
      deterministic_evidence_refs:
        [...deterministicRefs],
    };
  }

  return {
    quality: "weak",
    reason:
      "non_substantive_single_signal",
    qwen_evidence_fields:
      [...qwenFields],
    deterministic_evidence_refs:
      [...deterministicRefs],
  };
}

function parseSuggested(result) {
  const raw =
    result &&
    result.suggested;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(
      (item) =>
        Array.isArray(item) &&
        typeof item[0] === "string" &&
        typeof item[1] === "string"
    )
    .map((item) => ({
      dimension: item[0],
      label: item[1],
      confidence:
        typeof item[2] === "string"
          ? item[2]
          : null,
      evidence_fields:
        Array.isArray(item[3])
          ? item[3]
          : [],
      raw: item,
    }));
}

const workloadPayload =
  readJson(WORKLOAD_PATH);

const workloads =
  workloadPayload.records;

const workloadById =
  new Map(
    workloads.map((row) => [
      row.candidate_id,
      row,
    ])
  );

const inferences =
  readJsonl(
    CONSOLIDATED_PATH
  );

const dimensions = [
  "needs",
  "functions",
  "populations",
  "activities",
];

const output = [];

const counters = {
  resolved: 0,
  review: 0,
  insufficient: 0,
};

const dimensionResolvedCounts = {
  needs: 0,
  functions: 0,
  populations: 0,
  activities: 0,
};

const keyCounts = {
  needs: {},
  functions: {},
  populations: {},
  activities: {},
};

let contractViolations = 0;
let suggestedRecords = 0;
let suggestedItems = 0;
let assistiveResolved = 0;
let activitiesOnly = 0;
let organizationTypeResolved = 0;

for (
  const inferenceRow of inferences
) {
  const candidateId =
    inferenceRow.candidate_id;

  const workload =
    workloadById.get(
      candidateId
    );

  if (!workload) {
    throw new Error(
      `Missing workload for ${candidateId}`
    );
  }

  const inference =
    inferenceRow.inference || {};

  if (
    inference.status !== "valid"
  ) {
    throw new Error(
      `Non-valid inference for ${candidateId}`
    );
  }

  const result =
    inference.result || {};

  const reconciliation = {};

  let rowViolations = 0;

  for (
    const dimension of dimensions
  ) {
    const value =
      buildDimension(
        workload,
        result,
        dimension
      );

    reconciliation[
      dimension
    ] = value;

    rowViolations +=
      value.violations.length;

    if (
      value.resolved.length > 0
    ) {
      dimensionResolvedCounts[
        dimension
      ] += 1;

      for (
        const item of value.resolved
      ) {
        keyCounts[
          dimension
        ][item.key] =
          (
            keyCounts[
              dimension
            ][item.key] || 0
          ) + 1;
      }
    }
  }

  const organizationType =
    buildDimension(
      workload,
      result,
      "organization_type"
    );

  reconciliation.organization_type =
    organizationType;

  rowViolations +=
    organizationType.violations.length;

  if (
    organizationType.resolved.length
  ) {
    organizationTypeResolved += 1;
  }

  const suggested =
    parseSuggested(result);

  if (suggested.length) {
    suggestedRecords += 1;
    suggestedItems +=
      suggested.length;
  }

  const assistiveSignal =
    reconciliation.needs.resolved.length > 0 ||
    reconciliation.functions.resolved.length > 0 ||
    reconciliation.populations.resolved.length > 0;

  const anyActivity =
    reconciliation.activities.resolved.length > 0;

  if (assistiveSignal) {
    assistiveResolved += 1;
  } else if (anyActivity) {
    activitiesOnly += 1;
  }

  const coreEvidence = [];

  for (
    const dimension of [
      "needs",
      "functions",
    ]
  ) {
    for (
      const item of reconciliation[
        dimension
      ].resolved
    ) {
      coreEvidence.push({
        dimension,
        key: item.key,
        ...classifyCoreEvidence(item),
      });
    }
  }

  const strongCore =
    coreEvidence.some(
      (item) =>
        item.quality === "strong"
    );

  const corroboratedCore =
    coreEvidence.some(
      (item) =>
        item.quality ===
        "corroborated"
    );

  const weakOnlyCore =
    coreEvidence.length > 0 &&
    !strongCore &&
    !corroboratedCore;

  let coreStatus;

  if (rowViolations > 0) {
    coreStatus = "review";
  } else if (strongCore) {
    coreStatus = "resolved_strong";
  } else if (corroboratedCore) {
    coreStatus =
      "resolved_corroborated";
  } else if (weakOnlyCore) {
    coreStatus = "review_weak";
  } else if (
    reconciliation.populations
      .resolved.length > 0
  ) {
    coreStatus =
      "context_population_only";
  } else {
    coreStatus = "insufficient";
  }

  const taxonomyReview =
    suggested.length > 0;

  let semanticStatus;

  if (
    coreStatus === "resolved_strong" ||
    coreStatus ===
      "resolved_corroborated"
  ) {
    semanticStatus = "resolved";
  } else if (
    coreStatus === "review" ||
    coreStatus === "review_weak"
  ) {
    semanticStatus = "review";
  } else {
    semanticStatus =
      "insufficient";
  }

  counters[
    semanticStatus
  ] += 1;

  contractViolations +=
    rowViolations;

  output.push({
    candidate_id: candidateId,
    semantic_status:
      semanticStatus,

    core_status:
      coreStatus,

    taxonomy_review:
      taxonomyReview,

    core_evidence:
      coreEvidence,

    route:
      workload.route,

    refined_route:
      workload.refined_route,

    source_mapping_mode:
      getSourceMapping(
        workload
      ).mode || null,

    qwen_relevance:
      Array.isArray(
        result.relevance
      )
        ? result.relevance
        : [],

    reconciliation,

    suggested,

    diagnostics: {
      assistive_signal:
        assistiveSignal,
      activities_only:
        !assistiveSignal &&
        anyActivity,
      contract_violations:
        rowViolations,
    },

    fields:
      workload.fields || {},
  });
}

const finalIds =
  output.map(
    (row) =>
      row.candidate_id
  );

if (
  finalIds.length !==
  workloads.length
) {
  throw new Error(
    "Output/workload size mismatch"
  );
}

if (
  new Set(finalIds).size !==
  finalIds.length
) {
  throw new Error(
    "Duplicate candidate_id in output"
  );
}

const report = {
  format_version: "1",
  dataset:
    "euskadi-candidate-resolution-v1",

  input_records:
    inferences.length,

  output_records:
    output.length,

  semantic_status:
    counters,

  assistive_resolved_records:
    assistiveResolved,

  activities_only_records:
    activitiesOnly,

  organization_type_resolved_records:
    organizationTypeResolved,

  suggested_records:
    suggestedRecords,

  suggested_items:
    suggestedItems,

  contract_violations:
    contractViolations,

  dimension_records_with_resolution:
    dimensionResolvedCounts,

  resolved_key_counts:
    Object.fromEntries(
      Object.entries(
        keyCounts
      ).map(
        ([dimension, counts]) => [
          dimension,
          Object.fromEntries(
            Object.entries(
              counts
            ).sort(
              (a, b) =>
                b[1] - a[1] ||
                a[0].localeCompare(
                  b[0]
                )
            )
          ),
        ]
      )
    ),
};

fs.mkdirSync(
  OUTPUT_DIR,
  {
    recursive: true,
  }
);

fs.writeFileSync(
  OUTPUT_PATH,
  output
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

console.log(
  "RESOLVED=",
  counters.resolved
);

console.log(
  "REVIEW=",
  counters.review
);

console.log(
  "INSUFFICIENT=",
  counters.insufficient
);

console.log(
  "ASSISTIVE_RESOLVED=",
  assistiveResolved
);

console.log(
  "ACTIVITIES_ONLY=",
  activitiesOnly
);

console.log(
  "SUGGESTED_RECORDS=",
  suggestedRecords
);

console.log(
  "SUGGESTED_ITEMS=",
  suggestedItems
);

console.log(
  "CONTRACT_VIOLATIONS=",
  contractViolations
);

console.log(
  "RECONCILIATION_V1=PASS"
);
