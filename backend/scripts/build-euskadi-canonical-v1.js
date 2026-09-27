import fs from "node:fs";
import path from "node:path";

import {
  buildCanonicalAssociationV1,
} from "./lib/canonical-association-v1.js";

import {
  buildAssociationSupportEligibilityV1,
} from "./lib/association-support-eligibility-v1.js";


import {
  mapEuskadiSourceTaxonomyV1,
} from "./lib/euskadi-source-taxonomy-mapper-v1.js";

import {
  mapAssociationTagsV1,
} from "./lib/association-tag-mapper-v1.js";

import {
  buildAssociationSemanticCandidateGateV1,
} from "./lib/association-semantic-candidate-gate-v1.js";

import {
  buildAssociationFunctionEvidenceGateV1,
} from "./lib/association-function-evidence-gate-v1.js";

const ROOT =
  process.cwd();

const SOURCE_ID =
  "euskadi_registro_asociaciones";

const NORMALIZED_PATH =
  path.join(
    ROOT,
    "data/acquisition",
    SOURCE_ID,
    "normalized.jsonl"
  );

const RAW_PATH =
  path.join(
    ROOT,
    "data/acquisition",
    SOURCE_ID,
    "raw/asociaciones.json"
  );

const CENSUS_PATH =
  path.join(
    ROOT,
    "data/curation/semantic/census",
    "euskadi-semantic-census-v1.jsonl"
  );

const OUTPUT_DIR =
  path.join(
    ROOT,
    "data/curation/canonical"
  );

const OUTPUT_PATH =
  path.join(
    OUTPUT_DIR,
    "euskadi-canonical-v1.jsonl"
  );

const REPORT_PATH =
  path.join(
    OUTPUT_DIR,
    "euskadi-canonical-v1.report.json"
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

function sourceLocatorFromRaw(
  raw
) {
  const values = [
    raw?.physicalUrl,
    raw?.dataXML,
    raw?.metadataXML,
  ];

  const patterns = [
    /\/contenidos\/asociacion\/([^/]+)\//i,
    /\/r01Index\/([^/]+)-idxContent\.xml/i,
  ];

  const found =
    new Set();

  for (const value of values) {
    const text =
      String(
        value ?? ""
      );

    for (
      const pattern
      of patterns
    ) {
      const match =
        text.match(
          pattern
        );

      if (match?.[1]) {
        found.add(
          match[1]
        );
      }
    }
  }

  if (found.size > 1) {
    throw new Error(
      "CONFLICTING_SOURCE_LOCATORS"
    );
  }

  return (
    [...found][0] ??
    null
  );
}

function identity(row) {
  const sourceId =
    row.source_id ??
    row.source?.source_id ??
    "";

  const sourceRecordId =
    row.source_record_id ??
    row.source?.record_id ??
    "";

  return (
    String(sourceId) +
    "::" +
    String(sourceRecordId)
  );
}

function unique(values) {
  return [
    ...new Set(
      (values ?? [])
        .filter(Boolean)
    ),
  ];
}

function evidenceKeys(rows) {
  return unique(
    (rows ?? [])
      .map(item =>
        typeof item === "string"
          ? item
          : item?.key
      )
      .filter(Boolean)
  );
}

function semanticKeys(value) {
  if (Array.isArray(value)) {
    return unique(value);
  }

  if (
    value &&
    typeof value === "object" &&
    Array.isArray(value.keys)
  ) {
    return unique(
      value.keys
    );
  }

  return [];
}

function sourceTaxonomyEvidence({
  dimension,
  keys,
  raw,
  official,
}) {
  return keys.map(key => ({
    key,

    evidence_type:
      official.mode ===
        "source_assertion"
        ? "source_taxonomy_assertion"
        : "source_taxonomy_candidate",

    source_field:
      "asoGoalType",

    source_value:
      raw.asoGoalType ??
      null,

    taxonomy_mode:
      official.mode ??
      null,

    dimension,
  }));
}

function mergeDimension({
  gateKeys = [],
  gateEvidence = [],
  officialKeys = [],
  officialEvidence = [],
}) {
  return {
    keys:
      unique([
        ...gateKeys,
        ...officialKeys,
      ]),

    evidence: [
      ...(gateEvidence ?? []),
      ...(officialEvidence ?? []),
    ],
  };
}

export function buildDeterministicFallbackV1({
  normalized,
  raw,
} = {}) {
  const name =
    String(
      normalized?.name ??
      raw?.recName ??
      ""
    );

  const description =
    String(
      normalized?.description ??
      raw?.recGoal ??
      ""
    );

  const official =
    mapEuskadiSourceTaxonomyV1({
      section:
        raw?.asoSection,

      sorting:
        raw?.asoSorting,

      goalType:
        raw?.asoGoalType,
    });

  const tags =
    mapAssociationTagsV1({
      name,
      description,

      originalCategory:
        raw?.asoGoalType,
    });

  const semantic =
    buildAssociationSemanticCandidateGateV1({
      name,
      description,

      categorySection:
        raw?.asoSection,

      categorySorting:
        raw?.asoSorting,

      categoryGoal:
        raw?.asoGoalType,
    });

  const functions =
    buildAssociationFunctionEvidenceGateV1({
      name,
      description,

      categorySection:
        raw?.asoSection,

      categorySorting:
        raw?.asoSorting,

      categoryGoal:
        raw?.asoGoalType,
    });

  const gateNeeds =
    evidenceKeys(
      tags.tags
    );

  const gateFunctions =
    evidenceKeys(
      functions.candidates
    );

  const gatePopulations =
    evidenceKeys(
      semantic
        .populations
        ?.candidates
    );

  const gateActivities =
    evidenceKeys(
      semantic
        .activities
        ?.candidates
    );

  const officialNeeds =
    unique([
      ...semanticKeys(
        official.assertions
          ?.needs
      ),
      ...semanticKeys(
        official.candidates
          ?.needs
      ),
    ]);

  const officialFunctions =
    unique([
      ...semanticKeys(
        official.assertions
          ?.functions
      ),
      ...semanticKeys(
        official.candidates
          ?.functions
      ),
    ]);

  const officialPopulations =
    unique([
      ...semanticKeys(
        official.assertions
          ?.populations
      ),
      ...semanticKeys(
        official.candidates
          ?.populations
      ),
    ]);

  const officialActivities =
    unique([
      ...semanticKeys(
        official.assertions
          ?.activities
      ),
      ...semanticKeys(
        official.candidates
          ?.activities
      ),
    ]);

  const deterministic = {
    needs:
      mergeDimension({
        gateKeys:
          gateNeeds,

        gateEvidence:
          tags.tags ?? [],

        officialKeys:
          officialNeeds,

        officialEvidence:
          sourceTaxonomyEvidence({
            dimension: "needs",
            keys:
              officialNeeds,
            raw,
            official,
          }),
      }),

    functions:
      mergeDimension({
        gateKeys:
          gateFunctions,

        gateEvidence:
          functions.candidates ??
          [],

        officialKeys:
          officialFunctions,

        officialEvidence:
          sourceTaxonomyEvidence({
            dimension:
              "functions",
            keys:
              officialFunctions,
            raw,
            official,
          }),
      }),

    populations:
      mergeDimension({
        gateKeys:
          gatePopulations,

        gateEvidence:
          semantic
            .populations
            ?.candidates ??
          [],

        officialKeys:
          officialPopulations,

        officialEvidence:
          sourceTaxonomyEvidence({
            dimension:
              "populations",
            keys:
              officialPopulations,
            raw,
            official,
          }),
      }),

    activities:
      mergeDimension({
        gateKeys:
          gateActivities,

        gateEvidence:
          semantic
            .activities
            ?.candidates ??
          [],

        officialKeys:
          officialActivities,

        officialEvidence:
          sourceTaxonomyEvidence({
            dimension:
              "activities",
            keys:
              officialActivities,
            raw,
            official,
          }),
      }),
  };

  return {
    deterministic,

    relevance:
      normalized.relevance ??
      null,

    utility:
      normalized.utility ??
      null,

    semantic_status:
      "deterministic_fallback",

    taxonomy_review: null,

    source_taxonomy: {
      section:
        raw?.asoSection ??
        null,

      sorting:
        raw?.asoSorting ??
        null,

      goal_type:
        raw?.asoGoalType ??
        null,

      scope:
        raw?.asoScope ??
        null,

      mapping:
        official,
    },
  };
}

export function buildEuskadiCanonicalProjectionV1({
  normalizedRows,
  censusRows,
  rawRows,
} = {}) {
  if (
    !Array.isArray(
      normalizedRows
    ) ||
    !Array.isArray(
      censusRows
    ) ||
    !Array.isArray(
      rawRows
    )
  ) {
    throw new TypeError(
      "normalizedRows, censusRows and rawRows are required"
    );
  }

  const censusByIdentity =
    new Map(
      censusRows.map(row => [
        identity(row),
        row,
      ])
    );

  if (
    censusByIdentity.size !==
    censusRows.length
  ) {
    throw new Error(
      "DUPLICATE_CENSUS_IDENTITY"
    );
  }

  const seen =
    new Set();

  const output = [];

  const report = {
    format_version: 1,

    source_id:
      SOURCE_ID,

    normalized_rows:
      normalizedRows.length,

    census_rows:
      censusRows.length,

    canonical_rows: 0,

    census_reused: 0,

    deterministic_fallback: 0,

    raw_resolution_failures: 0,

    duplicate_identity: 0,

    publication: {
      support_resource: 0,
      community_wellbeing: 0,
      both: 0,
      neither: 0,

      support_reasons: {
        direct_relevance: 0,
        need: 0,
        protective_hint: 0,
      },
    },

    deterministic_fallback_dimensions: {
      needs: 0,
      functions: 0,
      populations: 0,
      activities: 0,
      any: 0,
      zero: 0,
    },
  };

  for (
    const normalized
    of normalizedRows
  ) {
    const id =
      identity(
        normalized
      );

    if (seen.has(id)) {
      report
        .duplicate_identity += 1;

      throw new Error(
        `DUPLICATE_NORMALIZED_IDENTITY:${id}`
      );
    }

    seen.add(id);

    let semantic =
      censusByIdentity.get(id) ??
      null;

    let semanticProvenance;

    if (semantic) {
      report
        .census_reused += 1;

      semanticProvenance = {
        method:
          "semantic_census",

        source:
          "euskadi-semantic-census-v1",

        llm_inference_possible:
          true,
      };
    } else {
      const index =
        normalized.source
          ?.source_row_index;

      if (
        !Number.isInteger(
          index
        ) ||
        index < 0 ||
        index >=
          rawRows.length
      ) {
        report
          .raw_resolution_failures += 1;

        throw new Error(
          "RAW_RESOLUTION_FAILED:" +
          normalized.candidate_id
        );
      }

      semantic =
        buildDeterministicFallbackV1({
          normalized,
          raw:
            rawRows[index],
        });

      semanticProvenance = {
        method:
          "deterministic_fallback",

        components: [
          "euskadi_source_taxonomy_v1",
          "association_tag_mapper_v1",
          "association_semantic_candidate_gate_v1",
          "association_function_evidence_gate_v1",
        ],

        llm_called:
          false,
      };

      report
        .deterministic_fallback += 1;

      const dimensions =
        semantic.deterministic;

      let any = false;

      for (
        const dimension
        of [
          "needs",
          "functions",
          "populations",
          "activities",
        ]
      ) {
        if (
          dimensions[
            dimension
          ].keys.length
        ) {
          report
            .deterministic_fallback_dimensions[
              dimension
            ] += 1;

          any = true;
        }
      }

      if (any) {
        report
          .deterministic_fallback_dimensions
          .any += 1;
      } else {
        report
          .deterministic_fallback_dimensions
          .zero += 1;
      }
    }

    const semanticNeeds =
      semanticKeys(
        semantic
          ?.deterministic
          ?.needs
      );

    const semanticHints =
      semantic
        ?.source_taxonomy
        ?.mapping
        ?.hints ??
      [];

    const supportEligibility =
      buildAssociationSupportEligibilityV1({
        relevanceDecision:
          normalized
            .relevance
            ?.decision ??
          null,

        needKeys:
          semanticNeeds,

        hints:
          semanticHints,
      });

    const supportEligible =
      supportEligibility
        .eligible;

    const rawIndex =
      normalized.source
        ?.source_row_index;

    const rawForIdentity =
      Number.isInteger(
        rawIndex
      ) &&
      rawIndex >= 0 &&
      rawIndex < rawRows.length
        ? rawRows[
            rawIndex
          ]
        : null;

    const normalizedForCanonical = {
      ...normalized,

      source: {
        ...(normalized.source ?? {}),

        source_locator:
          sourceLocatorFromRaw(
            rawForIdentity
          ),
      },
    };

    const canonical =
      buildCanonicalAssociationV1({
        normalized:
          normalizedForCanonical,

        semantic,
        supportEligible,
        semanticProvenance,
      });

    const lanes =
      canonical
        .publication
        .lanes;

    const support =
      lanes.includes(
        "support_resource"
      );

    const community =
      lanes.includes(
        "community_wellbeing"
      );

    if (support) {
      report
        .publication
        .support_resource += 1;

      for (
        const reason
        of supportEligibility.reasons
      ) {
        if (
          Object.hasOwn(
            report
              .publication
              .support_reasons,
            reason
          )
        ) {
          report
            .publication
            .support_reasons[
              reason
            ] += 1;
        }
      }
    }

    if (community) {
      report
        .publication
        .community_wellbeing += 1;
    }

    if (
      support &&
      community
    ) {
      report
        .publication
        .both += 1;
    } else if (
      !support &&
      !community
    ) {
      report
        .publication
        .neither += 1;
    }

    output.push(
      canonical
    );
  }

  report.canonical_rows =
    output.length;

  if (
    report.canonical_rows !==
    normalizedRows.length
  ) {
    throw new Error(
      "CANONICAL_COVERAGE_MISMATCH"
    );
  }

  if (
    report.census_reused +
      report.deterministic_fallback
    !==
    normalizedRows.length
  ) {
    throw new Error(
      "SEMANTIC_ACCOUNTING_MISMATCH"
    );
  }

  return {
    output,
    report,
  };
}

function main() {
  const normalizedRows =
    readJsonl(
      NORMALIZED_PATH
    );

  const censusRows =
    readJsonl(
      CENSUS_PATH
    );

  const rawRows =
    JSON.parse(
      fs.readFileSync(
        RAW_PATH,
        "utf8"
      )
    );

  const {
    output,
    report,
  } =
    buildEuskadiCanonicalProjectionV1({
      normalizedRows,
      censusRows,
      rawRows,
    });

  if (
    report.normalized_rows !==
    28091
  ) {
    throw new Error(
      "EXPECTED_28091_NORMALIZED"
    );
  }

  if (
    report.census_reused !==
    20382
  ) {
    throw new Error(
      "EXPECTED_20382_CENSUS_REUSED"
    );
  }

  if (
    report.deterministic_fallback !==
    7709
  ) {
    throw new Error(
      "EXPECTED_7709_DETERMINISTIC_FALLBACK"
    );
  }

  fs.mkdirSync(
    OUTPUT_DIR,
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    OUTPUT_PATH,
    output
      .map(row =>
        JSON.stringify(row)
      )
      .join("\n") +
      "\n",
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
    `NORMALIZED=${report.normalized_rows}`
  );

  console.log(
    `CENSUS_REUSED=${report.census_reused}`
  );

  console.log(
    `DETERMINISTIC_FALLBACK=${report.deterministic_fallback}`
  );

  console.log(
    `CANONICAL=${report.canonical_rows}`
  );

  console.log(
    `COMMUNITY=${report.publication.community_wellbeing}`
  );

  console.log(
    `SUPPORT=${report.publication.support_resource}`
  );

  console.log(
    `BOTH=${report.publication.both}`
  );

  console.log(
    `NEITHER=${report.publication.neither}`
  );

  console.log(
    `FALLBACK_ZERO=${report.deterministic_fallback_dimensions.zero}`
  );

  console.log(
    "CANONICAL_OUTPUT=" +
    path.relative(
      ROOT,
      OUTPUT_PATH
    )
  );

  console.log(
    "REPORT=" +
    path.relative(
      ROOT,
      REPORT_PATH
    )
  );
}

if (
  process.argv[1] &&
  path.resolve(
    process.argv[1]
  ) ===
    path.resolve(
      new URL(
        import.meta.url
      ).pathname
    )
) {
  main();
}
