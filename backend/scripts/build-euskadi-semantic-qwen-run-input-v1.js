import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const WORKLOAD_PATH = path.join(
  ROOT,
  "data/curation/semantic/workloads/"
    + "euskadi-qwen-workload-v1.jsonl"
);

const TAXONOMY_PATH = path.join(
  ROOT,
  "data/curation/tag-taxonomy-v2.proposal.json"
);

const PROFILE_PATH = path.join(
  ROOT,
  "data/curation/semantic/semantic-profile-v1.json"
);

const OUTPUT_PATH = path.join(
  ROOT,
  "data/curation/semantic/workloads/"
    + "euskadi-qwen-run-input-v1.json"
);

function readJsonl(filename) {
  return fs.readFileSync(
    filename,
    "utf8"
  )
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(JSON.parse);
}

function unique(values) {
  return [
    ...new Set(
      (values ?? [])
        .filter(Boolean)
    ),
  ];
}

function dimensionValues(
  object,
  key
) {
  const value =
    object?.[key];

  return Array.isArray(value)
    ? value
    : [];
}

const workload =
  readJsonl(
    WORKLOAD_PATH
  );

const taxonomy =
  JSON.parse(
    fs.readFileSync(
      TAXONOMY_PATH,
      "utf8"
    )
  );

const profile =
  JSON.parse(
    fs.readFileSync(
      PROFILE_PATH,
      "utf8"
    )
  );

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

const needByKey =
  new Map(
    allowed.needs.map(
      row => [
        row.key,
        row,
      ]
    )
  );

function officialKeys(
  mapping,
  dimension
) {
  return unique([
    ...dimensionValues(
      mapping?.assertions,
      dimension
    ),
    ...dimensionValues(
      mapping?.candidates,
      dimension
    ),
  ]);
}

function constrainedAllowed(
  row
) {
  const input =
    row.input;

  const mapping =
    input.source_taxonomy
      ?.mapping ?? {};

  const deterministic =
    input.deterministic ?? {};

  const needKeys =
    unique([
      ...(
        deterministic
          .needs
          ?.keys ?? []
      ),
      ...officialKeys(
        mapping,
        "needs"
      ),
    ]);

  const functionKeys =
    unique([
      ...(
        deterministic
          .functions
          ?.keys ?? []
      ),
      ...officialKeys(
        mapping,
        "functions"
      ),
    ]);

  const populationKeys =
    unique([
      ...(
        deterministic
          .populations
          ?.keys ?? []
      ),
      ...officialKeys(
        mapping,
        "populations"
      ),
    ]);

  const activityKeys =
    unique([
      ...(
        deterministic
          .activities
          ?.keys ?? []
      ),
      ...officialKeys(
        mapping,
        "activities"
      ),
    ]);

  return {
    needs:
      needKeys
        .map(
          key =>
            needByKey.get(key)
        )
        .filter(Boolean),

    functions:
      functionKeys.filter(
        key =>
          allowed.functions.includes(
            key
          )
      ),

    populations:
      populationKeys.filter(
        key =>
          allowed.populations.includes(
            key
          )
      ),

    activities:
      activityKeys.filter(
        key =>
          allowed.activities.includes(
            key
          )
      ),

    /*
     * We currently have no deterministic
     * narrowing contract for these two.
     */
    organization_types:
      allowed.organization_types,

    service_modes:
      allowed.service_modes,
  };
}

function fullRouteAllowed() {
  return {
    needs:
      allowed.needs,

    functions:
      allowed.functions,

    populations:
      allowed.populations,

    activities:
      allowed.activities,

    organization_types:
      allowed.organization_types,

    service_modes:
      allowed.service_modes,
  };
}

const records =
  workload.map(
    row => {
      const input =
        row.input;

      const taxonomySource =
        input.source_taxonomy ?? {};

      const routeAllowed =
        row.route === "constrained"
          ? constrainedAllowed(row)
          : fullRouteAllowed();

      return {
        candidate_id:
          row.candidate_id,

        route:
          row.route,

        route_allowed:
          routeAllowed,

        /*
         * Provenance is retained outside the
         * fields sent to the LLM.
         */
        semantic_context: {
          deterministic:
            input.deterministic,

          source_mapping:
            taxonomySource.mapping,
        },

        fields: {
          N1:
            input.name ?? null,

          C1:
            taxonomySource.section
            ?? null,

          C2:
            taxonomySource.sorting
            ?? null,

          C3:
            taxonomySource.goal_type
            ?? null,

          S1:
            taxonomySource.scope
            ?? null,

          T1:
            input.province_key
            ?? null,

          M1:
            input.municipality_name
            ?? null,

          D1:
            input.description
            ?? null,
        },
      };
    }
  );

const output = {
  format_version: 3,

  workload_version:
    "euskadi-qwen-v1",

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

const counts = {
  constrained:
    records.filter(
      row =>
        row.route ===
        "constrained"
    ).length,

  llm_open:
    records.filter(
      row =>
        row.route ===
        "llm_open"
    ).length,
};

console.log(
  "RECORDS=",
  records.length
);

console.log(
  "CONSTRAINED=",
  counts.constrained
);

console.log(
  "LLM_OPEN=",
  counts.llm_open
);

console.log(
  "CANONICAL_NEEDS=",
  allowed.needs.length
);

console.log(
  "CANONICAL_FUNCTIONS=",
  allowed.functions.length
);

console.log(
  "CANONICAL_POPULATIONS=",
  allowed.populations.length
);

console.log(
  "CANONICAL_ACTIVITIES=",
  allowed.activities.length
);

console.log(
  "OUTPUT=",
  path.relative(
    ROOT,
    OUTPUT_PATH
  )
);

console.log(
  "QWEN_RUN_INPUT_BUILD=PASS"
);
