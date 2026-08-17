#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const WORKLOAD_PATH = path.join(
  ROOT,
  "data/curation/semantic/workloads/",
  "navarra-qwen-candidate-resolution-v1.json"
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
  "data/curation/semantic/workloads/",
  "navarra-qwen-candidate-resolution-run-input-v1.json"
);

function unique(values) {
  return [
    ...new Set(
      (values ?? []).filter(Boolean)
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

function canonicalKeys(values) {
  return unique(
    (values ?? [])
      .map(value =>
        typeof value === "string"
          ? value
          : value?.key
      )
      .filter(Boolean)
  );
}

const workloadPayload =
  JSON.parse(
    fs.readFileSync(
      WORKLOAD_PATH,
      "utf8"
    )
  );

const workload =
  workloadPayload.records;

if (
  !Array.isArray(workload)
  || workload.length !== 3702
) {
  throw new Error(
    "UNEXPECTED_NAVARRA_CANDIDATE_WORKLOAD:"
    + (
      Array.isArray(workload)
        ? workload.length
        : "not-array"
    )
  );
}

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

function buildRouteAllowed(row) {
  const semantic =
    row.semantic_context
    ?? {};

  const deterministic =
    semantic.deterministic
    ?? {};

  const mapping =
    semantic.source_taxonomy
      ?.mapping
    ?? {};

  const needKeys =
    unique([
      ...canonicalKeys(
        deterministic
          .needs
          ?.keys
      ),
      ...officialKeys(
        mapping,
        "needs"
      ),
    ]);

  const functionKeys =
    unique([
      ...canonicalKeys(
        deterministic
          .functions
          ?.keys
      ),
      ...officialKeys(
        mapping,
        "functions"
      ),
    ]);

  const populationKeys =
    unique([
      ...canonicalKeys(
        deterministic
          .populations
          ?.keys
      ),
      ...officialKeys(
        mapping,
        "populations"
      ),
    ]);

  const activityKeys =
    unique([
      ...canonicalKeys(
        deterministic
          .activities
          ?.keys
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
     * No deterministic narrowing contract
     * exists yet for these dimensions.
     */
    organization_types:
      allowed.organization_types,

    service_modes:
      allowed.service_modes,
  };
}

const records =
  workload.map(
    row => {
      const semantic =
        row.semantic_context
        ?? {};

      const sourceTaxonomy =
        semantic.source_taxonomy
        ?? {};

      const mapping =
        sourceTaxonomy.mapping
        ?? {};

      return {
        candidate_id:
          row.candidate_id,

        route:
          "constrained",

        refined_route:
          "candidate_resolution",

        route_allowed:
          buildRouteAllowed(row),

        semantic_context: {
          deterministic:
            semantic.deterministic
            ?? {},

          source_mapping:
            mapping,
        },

        fields: {
          N1:
            row.fields?.name
            ?? null,

          /*
           * Navarra does not expose the
           * Euskadi section/sorting hierarchy.
           */
          C1:
            null,

          C2:
            null,

          /*
           * Official Navarra registry class.
           */
          C3:
            sourceTaxonomy.class
            ?? null,

          S1:
            sourceTaxonomy.scope
            ?? null,

          T1:
            row.fields?.province_key
            ?? null,

          M1:
            row.fields?.municipality_name
            ?? null,

          D1:
            row.fields?.description
            ?? null,
        },
      };
    }
  );

const output = {
  format_version: 3,

  workload_version:
    "navarra-qwen-candidate-resolution-v1",

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

console.log(
  "RECORDS=",
  records.length
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
  "NAVARRA_QWEN_RUN_INPUT_V1=PASS"
);
