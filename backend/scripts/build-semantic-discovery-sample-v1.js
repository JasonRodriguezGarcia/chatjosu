import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  classifyAssociationRelevance,
} from "./lib/association-relevance-v1.js";

const ROOT = process.cwd();

const SOURCE_ID =
  "euskadi_registro_asociaciones";

const RAW_PATH = path.join(
  ROOT,
  "data/acquisition",
  SOURCE_ID,
  "raw/asociaciones.json"
);

const OUTPUT_DIR = path.join(
  ROOT,
  "data/curation/semantic/discovery"
);

const OUTPUT_PATH = path.join(
  OUTPUT_DIR,
  "euskadi-sample-v1.jsonl"
);

const REPORT_PATH = path.join(
  OUTPUT_DIR,
  "euskadi-sample-v1.report.json"
);

const TARGET_PER_RELEVANCE = 300;

function clean(value) {
  const text =
    String(value ?? "").trim();

  return text || null;
}

function hashScore(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
}

function descriptionBucket(text) {
  const n =
    String(text ?? "").length;

  if (n === 0) {
    return "empty";
  }

  if (n < 250) {
    return "short";
  }

  if (n < 1000) {
    return "medium";
  }

  return "long";
}

function relevanceFor(row) {
  return classifyAssociationRelevance({
    name:
      clean(
        row.recName ||
        row.documentName
      ),

    categories: [
      row.asoSection,
      row.asoSorting,
      row.asoGoalType,
    ],

    text: [
      row.documentDescription &&
      row.documentDescription !==
        row.recName
        ? row.documentDescription
        : null,
      row.recGoal,
    ],
  });
}

function buildSemanticText(row) {
  return [
    clean(row.documentDescription),
    clean(row.recGoal),
  ]
    .filter(Boolean)
    .filter(
      (value, index, array) =>
        array.indexOf(value) === index
    )
    .join("\n\n") || null;
}

function makeRecord(
  row,
  index
) {
  const recordId =
    clean(row.recNumRec);

  const candidateId =
    recordId
      ? `${SOURCE_ID}:${recordId}`
      : `${SOURCE_ID}:row-${index}`;

  const relevance =
    relevanceFor(row);

  const description =
    buildSemanticText(row);

  return {
    candidate_id:
      candidateId,

    source_record_id:
      recordId,

    source_row_index:
      index,

    name:
      clean(
        row.recName ||
        row.documentName
      ),

    description,

    source_categories: [
      clean(row.asoSection),
      clean(row.asoSorting),
      clean(row.asoGoalType),
    ].filter(Boolean),

    scope:
      clean(row.asoScope),

    territory:
      clean(row.territory),

    territory_code:
      clean(row.territorycode),

    municipality:
      clean(row.municipality),

    deterministic_relevance:
      relevance,

    discovery_strata: {
      relevance:
        relevance.status,

      territory:
        clean(row.territory)
        ?? "UNKNOWN",

      section:
        clean(row.asoSection)
        ?? "UNKNOWN",

      description_length:
        descriptionBucket(
          description
        ),
    },
  };
}

const raw =
  JSON.parse(
    fs.readFileSync(
      RAW_PATH,
      "utf8"
    )
  );

const records =
  raw.map(
    (row, index) =>
      makeRecord(
        row,
        index
      )
  );

const byRelevance =
  new Map();

for (const record of records) {
  const key =
    record
      .deterministic_relevance
      .status;

  if (!byRelevance.has(key)) {
    byRelevance.set(
      key,
      []
    );
  }

  byRelevance
    .get(key)
    .push(record);
}

/*
 * Dentro de cada clase de relevancia
 * queremos maximizar diversidad.
 *
 * Primera pasada:
 * una entidad por combinación
 * territorio + sección + longitud.
 *
 * Segunda pasada:
 * rellenamos de manera determinista
 * mediante hash.
 */
function selectDiverse(
  rows,
  target
) {
  const ordered =
    [...rows].sort(
      (a, b) =>
        hashScore(
          a.candidate_id
        ).localeCompare(
          hashScore(
            b.candidate_id
          )
        )
    );

  const selected = [];
  const selectedIds =
    new Set();

  const strataSeen =
    new Set();

  for (const row of ordered) {
    const strataKey = [
      row.discovery_strata
        .territory,
      row.discovery_strata
        .section,
      row.discovery_strata
        .description_length,
    ].join("|");

    if (
      strataSeen.has(
        strataKey
      )
    ) {
      continue;
    }

    selected.push(row);
    selectedIds.add(
      row.candidate_id
    );
    strataSeen.add(
      strataKey
    );

    if (
      selected.length >= target
    ) {
      return selected;
    }
  }

  for (const row of ordered) {
    if (
      selectedIds.has(
        row.candidate_id
      )
    ) {
      continue;
    }

    selected.push(row);
    selectedIds.add(
      row.candidate_id
    );

    if (
      selected.length >= target
    ) {
      break;
    }
  }

  return selected;
}

const desiredStatuses = [
  "direct_relevance",
  "contextual_relevance",
  "needs_review",
  "out_of_scope",
];

const sample = [];

const report = {
  format_version: 1,
  discovery_version: "1.0",
  source_id: SOURCE_ID,
  source_rows:
    records.length,
  target_per_relevance:
    TARGET_PER_RELEVANCE,
  selected: {},
  source_distribution: {},
};

for (
  const status
  of desiredStatuses
) {
  const rows =
    byRelevance.get(
      status
    ) ?? [];

  report
    .source_distribution[
      status
    ] = rows.length;

  const chosen =
    selectDiverse(
      rows,
      Math.min(
        TARGET_PER_RELEVANCE,
        rows.length
      )
    );

  report.selected[
    status
  ] = chosen.length;

  sample.push(
    ...chosen
  );
}

sample.sort(
  (a, b) =>
    hashScore(
      a.candidate_id
    ).localeCompare(
      hashScore(
        b.candidate_id
      )
    )
);

fs.mkdirSync(
  OUTPUT_DIR,
  {
    recursive: true,
  }
);

fs.writeFileSync(
  OUTPUT_PATH,
  sample
    .map(
      row =>
        JSON.stringify(row)
    )
    .join("\n") +
    "\n",
  "utf8"
);

const territoryCounts = {};
const lengthCounts = {};
const sectionCounts = {};

for (const row of sample) {
  const territory =
    row.discovery_strata
      .territory;

  territoryCounts[
    territory
  ] =
    (
      territoryCounts[
        territory
      ] ?? 0
    ) + 1;

  const length =
    row.discovery_strata
      .description_length;

  lengthCounts[
    length
  ] =
    (
      lengthCounts[
        length
      ] ?? 0
    ) + 1;

  const section =
    row.discovery_strata
      .section;

  sectionCounts[
    section
  ] =
    (
      sectionCounts[
        section
      ] ?? 0
    ) + 1;
}

report.sample_rows =
  sample.length;

report.sample_percentage =
  Number(
    (
      sample.length /
      records.length *
      100
    ).toFixed(2)
  );

report.territories =
  territoryCounts;

report.description_lengths =
  lengthCounts;

report.sections =
  Object.fromEntries(
    Object.entries(
      sectionCounts
    ).sort(
      (a, b) =>
        b[1] - a[1]
    )
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
  `SOURCE_ROWS=${records.length}`
);

console.log(
  `SAMPLE_ROWS=${sample.length}`
);

console.log(
  `SAMPLE_PERCENT=${report.sample_percentage}`
);

for (
  const status
  of desiredStatuses
) {
  console.log(
    `${status}=${report.selected[status] ?? 0}`
  );
}

console.log(
  `OUTPUT=${path.relative(ROOT, OUTPUT_PATH)}`
);

console.log(
  `REPORT=${path.relative(ROOT, REPORT_PATH)}`
);
