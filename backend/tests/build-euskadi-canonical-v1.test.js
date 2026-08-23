import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDeterministicFallbackV1,
  buildEuskadiCanonicalProjectionV1,
} from "../scripts/build-euskadi-canonical-v1.js";

function normalized(
  overrides = {}
) {
  return {
    candidate_id:
      "euskadi_registro_asociaciones:A/1",

    source_record_id:
      "A/1",

    source: {
      source_id:
        "euskadi_registro_asociaciones",

      source_row_index:
        0,
    },

    name:
      "Asociación ejemplo",

    scope:
      "Municipal",

    province_key:
      "GUIPUZCOA",

    municipality_name:
      "Zizurkil",

    utility: {
      decision:
        "drop",
    },

    ...overrides,
  };
}

test(
  "reuses census by stable source identity",
  () => {
    const row =
      normalized({
        utility: {
          decision:
            "keep",
        },
      });

    const census = {
      candidate_id:
        row.candidate_id,

      source_id:
        "euskadi_registro_asociaciones",

      source_record_id:
        "A/1",

      deterministic: {
        needs: [],
        functions: [],
        populations: [],
        activities: [
          "CANTO",
        ],
      },
    };

    const result =
      buildEuskadiCanonicalProjectionV1({
        normalizedRows: [
          row,
        ],

        censusRows: [
          census,
        ],

        rawRows: [
          {},
        ],
      });

    assert.equal(
      result.report.census_reused,
      1
    );

    assert.equal(
      result.report.deterministic_fallback,
      0
    );

    assert.deepEqual(
      result.output[0]
        .publication
        .lanes,
      [
        "community_wellbeing",
      ]
    );
  }
);

test(
  "taxonomy-only activity creates community lane without support lane",
  () => {
    const row =
      normalized();

    const raw = {
      asoSection:
        "Asociación",

      asoSorting:
        "Cultura General",

      asoGoalType:
        "Corales",

      asoScope:
        "Municipal",

      recName:
        "Coral ejemplo",

      recGoal:
        "Promoción de la actividad coral",
    };

    const semantic =
      buildDeterministicFallbackV1({
        normalized:
          row,

        raw,
      });

    assert.ok(
      semantic
        .deterministic
        .activities
        .keys
        .includes(
          "CANTO"
        )
    );

    const result =
      buildEuskadiCanonicalProjectionV1({
        normalizedRows: [
          row,
        ],

        censusRows: [],

        rawRows: [
          raw,
        ],
      });

    assert.deepEqual(
      result.output[0]
        .publication
        .lanes,
      [
        "community_wellbeing",
      ]
    );

    assert.equal(
      result.report.deterministic_fallback,
      1
    );
  }
);

test(
  "taurine record can remain canonical with no publication lane",
  () => {
    const row =
      normalized({
        name:
          "Peña taurina",
      });

    const raw = {
      asoSection:
        "Asociación",

      asoSorting:
        "Cultura General",

      asoGoalType:
        "Taurinas",

      asoScope:
        "Local",

      recName:
        "Peña taurina",

      recGoal:
        "Fomento de la afición taurina",
    };

    const result =
      buildEuskadiCanonicalProjectionV1({
        normalizedRows: [
          row,
        ],

        censusRows: [],

        rawRows: [
          raw,
        ],
      });

    assert.equal(
      result.output.length,
      1
    );

    assert.deepEqual(
      result.output[0]
        .publication
        .lanes,
      []
    );
  }
);

test(
  "projection rejects unresolved raw fallback identity",
  () => {
    const row =
      normalized({
        source: {
          source_id:
            "euskadi_registro_asociaciones",

          source_row_index:
            99,
        },
      });

    assert.throws(
      () =>
        buildEuskadiCanonicalProjectionV1({
          normalizedRows: [
            row,
          ],

          censusRows: [],

          rawRows: [
            {},
          ],
        }),

      /RAW_RESOLUTION_FAILED/
    );
  }
);
