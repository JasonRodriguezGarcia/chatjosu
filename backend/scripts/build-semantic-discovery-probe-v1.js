import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SAMPLE_PATH = path.join(
  ROOT,
  "data/curation/semantic/discovery/euskadi-sample-v2.jsonl"
);

const CONTRACT_PATH = path.join(
  ROOT,
  "data/curation/semantic/semantic-profile-v1.json"
);

const TAXONOMY_PATH = path.join(
  ROOT,
  "data/curation/tag-taxonomy-v2.proposal.json"
);

const OUTPUT_PATH = path.join(
  ROOT,
  "data/curation/semantic/discovery/euskadi-probe-24-v1.json"
);

function loadJson(pathname) {
  return JSON.parse(
    fs.readFileSync(
      pathname,
      "utf8"
    )
  );
}

function loadJsonl(pathname) {
  return fs
    .readFileSync(
      pathname,
      "utf8"
    )
    .split(/\r?\n/)
    .filter(Boolean)
    .map(
      line =>
        JSON.parse(line)
    );
}

const contract =
  loadJson(
    CONTRACT_PATH
  );

const taxonomy =
  loadJson(
    TAXONOMY_PATH
  );

const sample =
  loadJsonl(
    SAMPLE_PATH
  );

const target = {
  direct_relevance: 6,
  contextual_relevance: 6,
  needs_review: 6,
  out_of_scope: 6,
};

const selected = [];

const counts =
  Object.fromEntries(
    Object.keys(target)
      .map(
        key =>
          [key, 0]
      )
  );

for (const row of sample) {
  const status =
    row
      .deterministic_relevance
      .status;

  if (
    !Object.hasOwn(
      target,
      status
    )
  ) {
    continue;
  }

  if (
    counts[status] >=
    target[status]
  ) {
    continue;
  }

  selected.push({
    candidate_id:
      row.candidate_id,

    name:
      row.name,

    description:
      row.description,

    source_categories:
      row.source_categories,

    scope:
      row.scope,

    territory:
      row.territory,

    municipality:
      row.municipality,
  });

  counts[status] += 1;

  if (
    selected.length === 24
  ) {
    break;
  }
}

const needs =
  taxonomy.needs.map(
    row => ({
      key:
        row.key,
      label:
        row.label,
      parent:
        row.parent ?? null,
    })
  );

const payload = {
  format_version: 1,
  probe_version:
    "1.0",

  allowed: {
    relevance_classes:
      contract
        .relevance_classes,

    relation_roles:
      contract
        .relation_roles,

    confidence_levels:
      contract
        .confidence_levels,

    needs,

    functions:
      contract
        .initial_functions,

    populations:
      contract
        .initial_populations,

    activities:
      contract
        .initial_activities,

    organization_types:
      contract
        .organization_types,

    service_modes:
      contract
        .service_modes,
  },

  records:
    selected,
};

fs.writeFileSync(
  OUTPUT_PATH,
  JSON.stringify(
    payload,
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(
  `RECORDS=${selected.length}`
);

console.log(
  `NEEDS=${needs.length}`
);

console.log(
  `FUNCTIONS=${payload.allowed.functions.length}`
);

console.log(
  `POPULATIONS=${payload.allowed.populations.length}`
);

console.log(
  `ACTIVITIES=${payload.allowed.activities.length}`
);

console.log(
  `OUTPUT=${path.relative(ROOT, OUTPUT_PATH)}`
);

console.log(
  "STRATA=",
  JSON.stringify(counts)
);
