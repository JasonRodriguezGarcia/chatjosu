import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const ROOT =
  path.resolve(__dirname, "../..");

const PROPOSALS_PATH =
  path.join(
    ROOT,
    "data/enrichment/embedded-field-proposals.jsonl"
  );

const OUTPUT_PATH =
  path.join(
    ROOT,
    "data/enrichment/field-enrichment.jsonl"
  );

function readJsonl(pathname) {
  return fs
    .readFileSync(
      pathname,
      "utf8"
    )
    .split(/\r?\n/)
    .filter(Boolean)
    .map(
      (line) =>
        JSON.parse(line)
    );
}

const proposals =
  readJsonl(
    PROPOSALS_PATH
  );

const selected =
  proposals
    .filter(
      (row) =>
        row.confidence === "high" &&
        row.decision === "auto_candidate"
    )
    .map(
      (row) => ({
        association_id:
          Number(
            row.association_id
          ),
        field:
          row.field,
        value:
          row.proposed_value,
        provenance: {
          source_type:
            "embedded_source",
          source_field:
            row.source_field,
          source_text:
            row.source_text,
          method:
            row.method,
          confidence:
            row.confidence,
          verified:
            false,
        },
      })
    )
    .sort(
      (a, b) =>
        a.association_id -
          b.association_id ||
        a.field.localeCompare(
          b.field
        )
    );

const keys =
  selected.map(
    (row) =>
      `${row.association_id}:${row.field}`
  );

if (
  new Set(keys).size !==
  keys.length
) {
  throw new Error(
    "Hay más de un enrichment automático para association_id+field"
  );
}

fs.writeFileSync(
  OUTPUT_PATH,
  `${
    selected
      .map(
        (row) =>
          JSON.stringify(row)
      )
      .join("\n")
  }\n`,
  "utf8"
);

console.log(
  `SAFE_ENRICHMENTS=${selected.length}`
);

console.log(
  `ASSOCIATIONS=${new Set(
    selected.map(
      (row) =>
        row.association_id
    )
  ).size}`
);

console.log(
  `OUTPUT=${path.relative(ROOT, OUTPUT_PATH)}`
);
