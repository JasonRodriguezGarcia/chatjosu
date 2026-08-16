import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT =
  process.cwd();

const ENVELOPE_PATH =
  path.join(
    ROOT,
    "data/curation/semantic/envelopes/"
      + "euskadi-semantic-envelope-v1.jsonl"
  );

const OUTPUT_DIR =
  path.join(
    ROOT,
    "data/curation/semantic/workloads"
  );

const OUTPUT_PATH =
  path.join(
    OUTPUT_DIR,
    "euskadi-qwen-workload-v1.jsonl"
  );

const REPORT_PATH =
  path.join(
    OUTPUT_DIR,
    "euskadi-qwen-workload-v1.report.json"
  );

function sha256File(filename) {
  return crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(filename)
    )
    .digest("hex");
}

const envelopes =
  fs.readFileSync(
    ENVELOPE_PATH,
    "utf8"
  )
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean)
  .map(JSON.parse);

const workload = [];

const report = {
  format_version: 1,

  source_id:
    "euskadi_registro_asociaciones",

  envelope_rows:
    envelopes.length,

  skipped_deterministic_only:
    0,

  workload_rows:
    0,

  routing: {
    constrained: 0,
    llm_open: 0,
  },
};

for (const envelope of envelopes) {
  const route =
    envelope.routing?.route;

  if (
    route ===
    "deterministic_only"
  ) {
    report
      .skipped_deterministic_only += 1;

    continue;
  }

  if (
    route !== "constrained"
    && route !== "llm_open"
  ) {
    throw new Error(
      "UNKNOWN_ENVELOPE_ROUTE:"
      + String(route)
    );
  }

  report.routing[
    route
  ] += 1;

  /*
   * This is a workload/provenance object,
   * not yet a provider-specific prompt.
   *
   * The Qwen runner will later transform
   * this minimal semantic context into its
   * constrained response schema.
   */
  workload.push({
    format_version: 1,

    candidate_id:
      envelope.candidate_id,

    source_id:
      envelope.source_id,

    source_record_id:
      envelope.source_record_id,

    content_hash:
      envelope.content_hash
      ?? null,

    route,

    input: {
      name:
        envelope.name,

      description:
        envelope.description,

      source_taxonomy:
        envelope.source_taxonomy,

      deterministic:
        envelope.deterministic,

      relevance:
        envelope.relevance,

      utility:
        envelope.utility,
    },
  });
}

report.workload_rows =
  workload.length;

report.input_sha256 =
  sha256File(
    ENVELOPE_PATH
  );

fs.mkdirSync(
  OUTPUT_DIR,
  {
    recursive: true,
  }
);

fs.writeFileSync(
  OUTPUT_PATH,
  workload
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
  "ENVELOPES=",
  envelopes.length
);

console.log(
  "SKIPPED_DETERMINISTIC_ONLY=",
  report.skipped_deterministic_only
);

console.log(
  "CONSTRAINED=",
  report.routing.constrained
);

console.log(
  "LLM_OPEN=",
  report.routing.llm_open
);

console.log(
  "WORKLOAD_ROWS=",
  report.workload_rows
);

console.log(
  "QWEN_WORKLOAD_BUILD=PASS"
);
