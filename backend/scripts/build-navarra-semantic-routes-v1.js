#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const INPUT_PATH = path.join(
  ROOT,
  "data/curation/semantic/envelopes/",
  "navarra-semantic-envelope-v1.jsonl"
);

const OUT_DIR = path.join(
  ROOT,
  "data/curation/semantic/workloads"
);

const CANDIDATE_PATH = path.join(
  OUT_DIR,
  "navarra-qwen-candidate-resolution-v1.json"
);

const CONTEXT_PATH = path.join(
  OUT_DIR,
  "navarra-context-only-v1.jsonl"
);

const REPORT_PATH = path.join(
  OUT_DIR,
  "navarra-semantic-routes-v1.report.json"
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

const rows =
  readJsonl(INPUT_PATH);

if (rows.length !== 10254) {
  throw new Error(
    `Unexpected envelope rows: ${rows.length}`
  );
}

const candidateResolution = [];
const contextOnly = [];

const untouched = {
  deterministic_only: 0,
  llm_open: 0,
  out_of_scope: 0,
};

for (const row of rows) {
  const route =
    row.routing?.route;

  const mode =
    row.routing?.official_mode;

  if (
    route === "constrained"
    && (
      mode === "strong_candidate"
      || mode === "candidate_set"
    )
  ) {
    candidateResolution.push({
      candidate_id:
        row.candidate_id,

      route:
        "constrained",

      refined_route:
        "candidate_resolution",

      route_allowed: [
        "candidate_resolution",
      ],

      fields: {
        name:
          row.name,

        description:
          row.description,

        province_key:
          row.province_key,

        municipality_name:
          row.municipality_name,
      },

      semantic_context: {
        relevance:
          row.relevance,

        utility:
          row.utility,

        deterministic:
          row.deterministic,

        source_taxonomy:
          row.source_taxonomy,
      },
    });

    continue;
  }

  if (
    route === "constrained"
    && mode === "context"
  ) {
    contextOnly.push({
      candidate_id:
        row.candidate_id,

      route:
        "constrained",

      refined_route:
        "context_only",

      route_allowed: [
        "context_only",
      ],

      fields: {
        name:
          row.name,

        description:
          row.description,

        province_key:
          row.province_key,

        municipality_name:
          row.municipality_name,
      },

      semantic_context: {
        relevance:
          row.relevance,

        utility:
          row.utility,

        deterministic:
          row.deterministic,

        source_taxonomy:
          row.source_taxonomy,
      },
    });

    continue;
  }

  if (
    Object.hasOwn(
      untouched,
      route
    )
  ) {
    untouched[route] += 1;
    continue;
  }

  throw new Error(
    "UNEXPECTED_NAVARRA_ROUTE_MODE:"
    + `${row.candidate_id}:`
    + `${route}:`
    + `${mode}`
  );
}

if (
  candidateResolution.length
  !== 3702
) {
  throw new Error(
    "UNEXPECTED_CANDIDATE_RESOLUTION:"
    + candidateResolution.length
  );
}

if (
  contextOnly.length
  !== 5002
) {
  throw new Error(
    "UNEXPECTED_CONTEXT_ONLY:"
    + contextOnly.length
  );
}

const candidateIds =
  new Set(
    candidateResolution.map(
      row => row.candidate_id
    )
  );

const contextIds =
  new Set(
    contextOnly.map(
      row => row.candidate_id
    )
  );

const overlap = [
  ...candidateIds
].filter(
  id =>
    contextIds.has(id)
);

if (overlap.length) {
  throw new Error(
    "NAVARRA_REFINED_ROUTE_OVERLAP:"
    + overlap.length
  );
}

const report = {
  format_version: 1,

  source_id:
    "navarra_registro_asociaciones",

  input_records:
    rows.length,

  refined: {
    candidate_resolution:
      candidateResolution.length,

    context_only:
      contextOnly.length,
  },

  untouched,

  invariants: {
    candidate_ids_unique:
      candidateIds.size
      === candidateResolution.length,

    context_ids_unique:
      contextIds.size
      === contextOnly.length,

    overlap:
      overlap.length,

    constrained_partition:
      candidateResolution.length
      + contextOnly.length
      === 8704,
  },
};

fs.mkdirSync(
  OUT_DIR,
  {
    recursive: true,
  }
);

fs.writeFileSync(
  CANDIDATE_PATH,
  JSON.stringify(
    {
      format_version: 1,

      source_id:
        "navarra_registro_asociaciones",

      route:
        "candidate_resolution",

      records:
        candidateResolution,
    },
    null,
    2
  ) + "\n"
);

fs.writeFileSync(
  CONTEXT_PATH,
  contextOnly
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
  ) + "\n"
);

console.log(
  "INPUT_RECORDS=",
  rows.length
);

console.log(
  "CANDIDATE_RESOLUTION=",
  candidateResolution.length
);

console.log(
  "CONTEXT_ONLY=",
  contextOnly.length
);

console.log(
  "DETERMINISTIC_ONLY=",
  untouched.deterministic_only
);

console.log(
  "LLM_OPEN=",
  untouched.llm_open
);

console.log(
  "OUT_OF_SCOPE=",
  untouched.out_of_scope
);

console.log(
  "OVERLAP=",
  overlap.length
);

console.log(
  "NAVARRA_REFINED_ROUTES_V1=PASS"
);
