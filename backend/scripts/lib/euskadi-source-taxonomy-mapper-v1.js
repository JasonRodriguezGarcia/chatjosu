import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(
  fileURLToPath(import.meta.url)
);

const ROOT = path.resolve(
  HERE,
  "../../.."
);

const TAXONOMY_PATH = path.join(
  ROOT,
  "data/curation/semantic/source-taxonomies/"
    + "euskadi-taxonomy-map-v2.proposal.json"
);

let cachedTaxonomy = null;

function loadTaxonomy() {
  if (cachedTaxonomy) {
    return cachedTaxonomy;
  }

  const parsed = JSON.parse(
    fs.readFileSync(
      TAXONOMY_PATH,
      "utf8"
    )
  );

  if (
    parsed.format_version !== 2
    || !Array.isArray(parsed.goal_types)
  ) {
    throw new Error(
      "INVALID_EUSKADI_SOURCE_TAXONOMY_V2"
    );
  }

  cachedTaxonomy = new Map(
    parsed.goal_types.map(
      row => [
        row.source_value,
        row,
      ]
    )
  );

  return cachedTaxonomy;
}

function cloneSemanticObject(value) {
  return JSON.parse(
    JSON.stringify(
      value ?? {}
    )
  );
}

export function mapEuskadiSourceTaxonomyV1({
  section = null,
  sorting = null,
  goalType = null,
} = {}) {
  const normalizedGoalType =
    String(
      goalType ?? ""
    ).trim();

  const source = {
    section:
      String(
        section ?? ""
      ).trim() || null,

    sorting:
      String(
        sorting ?? ""
      ).trim() || null,

    goal_type:
      normalizedGoalType || null,
  };

  if (!normalizedGoalType) {
    return {
      source,
      matched: false,
      mode: null,
      assertions: {},
      candidates: {},
      hints: [],
    };
  }

  const taxonomy = loadTaxonomy();

  const row = taxonomy.get(
    normalizedGoalType
  );

  if (!row) {
    return {
      source,
      matched: false,
      mode: null,
      assertions: {},
      candidates: {},
      hints: [],
    };
  }

  const semantics =
    cloneSemanticObject(
      row.semantics
    );

  const hints = [
    ...(row.hints ?? []),
  ];

  switch (row.mode) {
    case "source_assertion":
      return {
        source,
        matched: true,
        mode: row.mode,
        assertions: semantics,
        candidates: {},
        hints,
      };

    case "strong_candidate":
    case "candidate_set":
      return {
        source,
        matched: true,
        mode: row.mode,
        assertions: {},
        candidates: semantics,
        hints,
      };

    case "context":
      return {
        source,
        matched: true,
        mode: row.mode,
        assertions: {},
        candidates: {},
        hints,
      };

    case "none":
      return {
        source,
        matched: true,
        mode: row.mode,
        assertions: {},
        candidates: {},
        hints: [],
      };

    default:
      throw new Error(
        "UNKNOWN_EUSKADI_TAXONOMY_MODE:"
        + row.mode
      );
  }
}

export function getEuskadiSourceTaxonomyCoverageV1() {
  const taxonomy = loadTaxonomy();

  return {
    goal_type_count:
      taxonomy.size,

    goal_types:
      [...taxonomy.keys()],
  };
}
