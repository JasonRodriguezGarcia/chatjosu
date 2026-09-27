import fs from "node:fs";
import path from "node:path";

const ROOT =
  process.cwd();

function parseArgs(argv) {
  const args = {
    sample:
      path.join(
        ROOT,
        "data/curation/semantic/discovery/euskadi-sample-v2.jsonl"
      ),

    template:
      path.join(
        ROOT,
        "data/curation/semantic/discovery/euskadi-single-benchmark-6-v2.json"
      ),

    output:
      path.join(
        ROOT,
        "data/curation/semantic/discovery/euskadi-discovery-block-001-v1.json"
      ),

    offset:
      0,

    limit:
      200,

    excludeBenchmark:
      true,
  };

  for (
    let i = 2;
    i < argv.length;
    i += 1
  ) {
    const key =
      argv[i];

    const value =
      argv[i + 1];

    if (key === "--sample") {
      args.sample =
        path.resolve(
          ROOT,
          value
        );
      i += 1;
      continue;
    }

    if (key === "--template") {
      args.template =
        path.resolve(
          ROOT,
          value
        );
      i += 1;
      continue;
    }

    if (key === "--output") {
      args.output =
        path.resolve(
          ROOT,
          value
        );
      i += 1;
      continue;
    }

    if (key === "--offset") {
      args.offset =
        Number.parseInt(
          value,
          10
        );
      i += 1;
      continue;
    }

    if (key === "--limit") {
      args.limit =
        Number.parseInt(
          value,
          10
        );
      i += 1;
      continue;
    }

    if (
      key ===
      "--include-benchmark"
    ) {
      args.excludeBenchmark =
        false;
      continue;
    }

    throw new Error(
      `UNKNOWN_ARGUMENT:${key}`
    );
  }

  if (
    !Number.isInteger(
      args.offset
    )
    || args.offset < 0
  ) {
    throw new Error(
      "INVALID_OFFSET"
    );
  }

  if (
    !Number.isInteger(
      args.limit
    )
    || args.limit < 1
  ) {
    throw new Error(
      "INVALID_LIMIT"
    );
  }

  return args;
}

function readJsonl(filePath) {
  return fs
    .readFileSync(
      filePath,
      "utf8"
    )
    .split(/\r?\n/)
    .filter(Boolean)
    .map(
      line =>
        JSON.parse(line)
    );
}

function toSemanticRecord(row) {
  return {
    candidate_id:
      row.candidate_id,

    fields: {
      N1:
        row.name
        ?? null,

      C1:
        row.source_categories
          ?.section
        ?? null,

      C2:
        row.source_categories
          ?.sorting
        ?? null,

      C3:
        row.source_categories
          ?.goal_type
        ?? null,

      S1:
        row.scope
        ?? null,

      T1:
        row.territory
        ?? null,

      M1:
        row.municipality
        ?? null,

      D1:
        row.description
        ?? null,
    },

    provenance: {
      source_record_id:
        row.source_record_id
        ?? null,

      source_row_index:
        row.source_row_index
        ?? null,

      discovery_strata:
        row.discovery_strata
        ?? null,

      discovery_selection_reason:
        row.discovery_selection_reason
        ?? null,
    },
  };
}

function main() {
  const args =
    parseArgs(
      process.argv
    );

  const sample =
    readJsonl(
      args.sample
    );

  const template =
    JSON.parse(
      fs.readFileSync(
        args.template,
        "utf8"
      )
    );

  /*
   * IMPORTANT:
   * deterministic_relevance from the sample is deliberately
   * NOT copied into records[].fields or provenance.
   *
   * The Qwen semantic pass must remain independent from the
   * deterministic relevance opinion.
   */

  const benchmarkIds =
    new Set(
      (
        template.records
        ?? []
      ).map(
        row =>
          row.candidate_id
      )
    );

  const eligible =
    sample.filter(
      row =>
        !args.excludeBenchmark
        || !benchmarkIds.has(
          row.candidate_id
        )
    );

  const selected =
    eligible.slice(
      args.offset,
      args.offset
        + args.limit
    );

  const output = {
    format_version: 1,

    semantic_input_version:
      "discovery-input-v1",

    source: {
      sample_path:
        path.relative(
          ROOT,
          args.sample
        ),

      source_records:
        sample.length,

      eligible_records:
        eligible.length,

      excluded_benchmark_records:
        sample.length
        - eligible.length,

      offset:
        args.offset,

      limit:
        args.limit,

      selected_records:
        selected.length,
    },

    allowed:
      template.allowed,

    records:
      selected.map(
        toSemanticRecord
      ),
  };

  fs.mkdirSync(
    path.dirname(
      args.output
    ),
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    args.output,
    JSON.stringify(
      output,
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(
    `SAMPLE_RECORDS=${sample.length}`
  );

  console.log(
    `ELIGIBLE_RECORDS=${eligible.length}`
  );

  console.log(
    `EXCLUDED_BENCHMARK=${sample.length - eligible.length}`
  );

  console.log(
    `SELECTED_RECORDS=${selected.length}`
  );

  console.log(
    `OUTPUT=${args.output}`
  );

  console.log(
    "DETERMINISTIC_RELEVANCE_EXPOSED=false"
  );

  console.log(
    "DISCOVERY_INPUT_BUILD=PASS"
  );
}

main();
