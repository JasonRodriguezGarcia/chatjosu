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
    + "canarias-taxonomy-map-v1.proposal.json"
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
    parsed.format_version !== "1"
    || !Array.isArray(parsed.classes)
  ) {
    throw new Error(
      "INVALID_CANARIAS_SOURCE_TAXONOMY_V1"
    );
  }

  cachedTaxonomy = new Map(
    parsed.classes.map(
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

export function mapCanariasSourceTaxonomyV1({
  sourceClass = null,
} = {}) {
  const normalizedClass =
    String(
      sourceClass ?? ""
    ).trim();

  /*
   * The proposal represents absence of
   * official class explicitly as <missing>.
   */
  const lookupValue =
    normalizedClass || "<missing>";

  const source = {
    class:
      normalizedClass || null,
  };

  const taxonomy =
    loadTaxonomy();

  const row =
    taxonomy.get(
      lookupValue
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
        "UNKNOWN_CANARIAS_TAXONOMY_MODE:"
        + row.mode
      );
  }
}

export function getCanariasSourceTaxonomyCoverageV1() {
  const taxonomy =
    loadTaxonomy();

  return {
    class_count:
      taxonomy.size,

    classes:
      [...taxonomy.keys()],
  };
}
