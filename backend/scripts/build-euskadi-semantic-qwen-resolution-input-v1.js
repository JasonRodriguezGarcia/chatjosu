import fs from "node:fs";
import path from "node:path";

const ROOT =
  process.cwd();

const INPUT_PATH =
  path.join(
    ROOT,
    "data/curation/semantic/workloads/"
      + "euskadi-qwen-run-input-v1.json"
  );

const OUTPUT_DIR =
  path.join(
    ROOT,
    "data/curation/semantic/workloads"
  );

const RESOLUTION_PATH =
  path.join(
    OUTPUT_DIR,
    "euskadi-qwen-candidate-resolution-v1.json"
  );

const CONTEXT_PATH =
  path.join(
    OUTPUT_DIR,
    "euskadi-context-only-v1.jsonl"
  );

const REPORT_PATH =
  path.join(
    OUTPUT_DIR,
    "euskadi-qwen-resolution-routing-v1.report.json"
  );

function countDimensionValues(
  object
) {
  return Object.values(
    object ?? {}
  )
    .filter(Array.isArray)
    .reduce(
      (total, values) =>
        total + values.length,
      0
    );
}

const input =
  JSON.parse(
    fs.readFileSync(
      INPUT_PATH,
      "utf8"
    )
  );

const constrained =
  input.records.filter(
    row =>
      row.route ===
      "constrained"
  );

const resolution = [];
const contextOnly = [];
const unexpected = [];

const modes = {};
const candidateDimensions = {};

for (const row of constrained) {
  const mapping =
    row.semantic_context
      ?.source_mapping
    ?? {};

  const mode =
    mapping.mode
    ?? "none";

  modes[mode] =
    (modes[mode] ?? 0)
    + 1;

  const candidates =
    mapping.candidates
    ?? {};

  const candidateCount =
    countDimensionValues(
      candidates
    );

  for (
    const [
      dimension,
      values,
    ]
    of Object.entries(
      candidates
    )
  ) {
    if (!Array.isArray(values)) {
      continue;
    }

    candidateDimensions[
      dimension
    ] =
      (
        candidateDimensions[
          dimension
        ] ?? 0
      )
      + values.length;
  }

  if (
    mode === "context"
    && candidateCount === 0
  ) {
    contextOnly.push({
      ...row,

      refined_route:
        "context_only",
    });

    continue;
  }

  if (
    (
      mode ===
        "strong_candidate"
      || mode ===
        "candidate_set"
    )
    && candidateCount > 0
  ) {
    resolution.push({
      ...row,

      refined_route:
        "candidate_resolution",
    });

    continue;
  }

  unexpected.push({
    candidate_id:
      row.candidate_id,

    mode,

    candidate_count:
      candidateCount,
  });
}

if (
  resolution.length !== 3698
) {
  throw new Error(
    `RESOLUTION_COUNT_MISMATCH:${resolution.length}`
  );
}

if (
  contextOnly.length !== 2968
) {
  throw new Error(
    `CONTEXT_COUNT_MISMATCH:${contextOnly.length}`
  );
}

if (
  unexpected.length !== 0
) {
  throw new Error(
    `UNEXPECTED_ROUTING:${unexpected.length}`
  );
}

const output = {
  format_version:
    input.format_version,

  workload_version:
    "euskadi-qwen-candidate-resolution-v1",

  allowed:
    input.allowed,

  records:
    resolution,
};

fs.mkdirSync(
  OUTPUT_DIR,
  {
    recursive: true,
  }
);

fs.writeFileSync(
  RESOLUTION_PATH,
  JSON.stringify(
    output,
    null,
    2
  ) + "\n",
  "utf8"
);

fs.writeFileSync(
  CONTEXT_PATH,
  contextOnly
    .map(
      row =>
        JSON.stringify(row)
    )
    .join("\n")
    + "\n",
  "utf8"
);

const report = {
  format_version: 1,

  constrained_total:
    constrained.length,

  candidate_resolution:
    resolution.length,

  context_only:
    contextOnly.length,

  unexpected:
    unexpected.length,

  official_modes:
    modes,

  official_candidate_dimensions:
    candidateDimensions,
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
  "CONSTRAINED_TOTAL=",
  constrained.length
);

console.log(
  "CANDIDATE_RESOLUTION=",
  resolution.length
);

console.log(
  "CONTEXT_ONLY=",
  contextOnly.length
);

console.log(
  "UNEXPECTED=",
  unexpected.length
);

console.log(
  "CANDIDATE_DIMENSIONS=",
  JSON.stringify(
    candidateDimensions
  )
);

console.log(
  "QWEN_RESOLUTION_ROUTING=PASS"
);
