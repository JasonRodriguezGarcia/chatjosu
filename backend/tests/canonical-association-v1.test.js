import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCanonicalAssociationV1,
  canonicalAssociationV1,
} from "../scripts/lib/canonical-association-v1.js";

function euskadiNormalized(
  overrides = {}
) {
  return {
    source: {
      source_id:
        "euskadi_registro_asociaciones",
    },

    source_record_id:
      "A/1",

    name:
      "Asociación ejemplo",

    scope:
      "Municipal",

    province_key:
      "GUIPUZCOA",

    municipality_name:
      "Zizurkil",

    ...overrides,
  };
}

test(
  "normalizes Euskadi array semantic dimensions",
  () => {
    const result =
      buildCanonicalAssociationV1({
        normalized:
          euskadiNormalized(),

        semantic: {
          deterministic: {
            needs: [
              "loneliness_support",
            ],

            populations: [
              "MAYORES",
            ],

            functions: [
              "ACOMPANAMIENTO",
            ],

            activities: [
              "CANTO",
              "ACTIVIDAD_COMUNITARIA",
            ],
          },
        },

        supportEligible:
          true,
      });

    assert.deepEqual(
      result.semantic.activities.keys,
      [
        "CANTO",
        "ACTIVIDAD_COMUNITARIA",
      ]
    );

    assert.deepEqual(
      result.publication.lanes,
      [
        "support_resource",
        "community_wellbeing",
      ]
    );
  }
);

test(
  "normalizes Navarra keys/evidence semantic shape",
  () => {
    const result =
      buildCanonicalAssociationV1({
        normalized: {
          source_id:
            "navarra_registro_asociaciones",

          source_record_id:
            "6588",

          name:
            "Entidad ejemplo",

          province_key:
            "NAVARRA",

          scope:
            "N",
        },

        semantic: {
          deterministic: {
            needs: {
              keys: [],
              evidence: [],
            },

            populations: {
              keys: [],
              evidence: [],
            },

            functions: {
              keys: [
                "REPRESENTACION",
              ],

              evidence: [
                {
                  key:
                    "REPRESENTACION",

                  evidence_ref:
                    "D1",
                },
              ],
            },

            activities: {
              keys: [
                "CANTO",
              ],

              evidence: [
                {
                  key:
                    "CANTO",

                  evidence_ref:
                    "D2",
                },
              ],
            },
          },
        },
      });

    assert.deepEqual(
      result.semantic.functions.keys,
      [
        "REPRESENTACION",
      ]
    );

    assert.equal(
      result.semantic.functions
        .evidence[0]
        .evidence_ref,
      "D1"
    );

    assert.deepEqual(
      result.publication.lanes,
      [
        "community_wellbeing",
      ]
    );

    /*
     * "N" remains uninterpreted until
     * Navarra source semantics are proven.
     */
    assert.equal(
      result.service_scope.level,
      "unknown"
    );

    assert.equal(
      result.service_scope
        .source_value,
      "N"
    );
  }
);

test(
  "keeps physical location separate from service scope",
  () => {
    const result =
      buildCanonicalAssociationV1({
        normalized:
          euskadiNormalized({
            scope:
              "C.A. del País Vasco",
          }),
      });

    assert.equal(
      result.location.municipality,
      "Zizurkil"
    );

    assert.equal(
      result.service_scope.level,
      "autonomous_community"
    );

    assert.deepEqual(
      result.service_scope
        .autonomous_communities,
      [
        "EUSKADI",
      ]
    );

    assert.deepEqual(
      result.service_scope
        .municipalities,
      []
    );
  }
);

test(
  "supports multi-province scope",
  () => {
    const result =
      buildCanonicalAssociationV1({
        normalized:
          euskadiNormalized({
            scope:
              "T.H. de Gipuzkoa y Bizkaia",
          }),
      });

    assert.equal(
      result.service_scope.level,
      "multi_province"
    );

    assert.deepEqual(
      result.service_scope.provinces,
      [
        "GUIPUZCOA",
        "VIZCAYA",
      ]
    );
  }
);

test(
  "supports cross-autonomous-community scope",
  () => {
    const result =
      buildCanonicalAssociationV1({
        normalized:
          euskadiNormalized({
            scope:
              "C.A. del País Vasco y C.Foral de Navarra",
          }),
      });

    assert.equal(
      result.service_scope.level,
      "multi_autonomous_community"
    );

    assert.deepEqual(
      result.service_scope
        .autonomous_communities,
      [
        "EUSKADI",
        "NAVARRA",
      ]
    );
  }
);

test(
  "community activity does not imply support resource",
  () => {
    const result =
      buildCanonicalAssociationV1({
        normalized:
          euskadiNormalized(),

        semantic: {
          deterministic: {
            activities: [
              "CANTO",
            ],
          },
        },
      });

    assert.deepEqual(
      result.publication.lanes,
      [
        "community_wellbeing",
      ]
    );

    assert.deepEqual(
      result.semantic.needs.keys,
      []
    );
  }
);

test(
  "requires stable source identity",
  () => {
    assert.throws(
      () =>
        buildCanonicalAssociationV1({
          normalized: {
            source_record_id:
              "123",
          },
        }),

      /MISSING_SOURCE_ID/
    );
  }
);

test(
  "declares only current publication lanes",
  () => {
    assert.deepEqual(
      [
        ...canonicalAssociationV1
          .publicationLanes,
      ].sort(),

      [
        "community_wellbeing",
        "support_resource",
      ].sort()
    );
  }
);

test(
  "accepts source-backed nested record_id when top-level source_record_id is absent",
  () => {
    const result =
      buildCanonicalAssociationV1({
        normalized: {
          source: {
            source_id:
              "euskadi_registro_asociaciones",

            record_id:
              "A/NESTED/1",
          },

          name:
            "Entidad con identidad fuente anidada",
        },
      });

    assert.equal(
      result.identity
        .source_record_id,
      "A/NESTED/1"
    );

    assert.equal(
      result.identity
        .canonical_id,
      "euskadi_registro_asociaciones:A/NESTED/1"
    );
  }
);


test(
  "accepts stable source locator when registry record id is absent",
  () => {
    const result =
      buildCanonicalAssociationV1({
        normalized: {
          source: {
            source_id:
              "euskadi_registro_asociaciones",

            source_locator:
              "asg140102008",
          },

          name:
            "Entidad sin número registral",
        },
      });

    assert.equal(
      result.identity.source_record_id,
      null
    );

    assert.equal(
      result.identity.source_locator,
      "asg140102008"
    );

    assert.equal(
      result.identity.method,
      "source_locator"
    );

    assert.equal(
      result.identity.canonical_id,
      "euskadi_registro_asociaciones:locator:asg140102008"
    );
  }
);

test(
  "prefers registry record id over source locator",
  () => {
    const result =
      buildCanonicalAssociationV1({
        normalized: {
          source_record_id:
            "AS/B/12345",

          source: {
            source_id:
              "euskadi_registro_asociaciones",

            source_locator:
              "asg-example",
          },

          tax_id:
            "G12345678",

          name:
            "Entidad identificada",
        },
      });

    assert.equal(
      result.identity.method,
      "source_record_id"
    );

    assert.equal(
      result.identity.canonical_id,
      "euskadi_registro_asociaciones:AS/B/12345"
    );

    assert.equal(
      result.identity.source_locator,
      "asg-example"
    );

    assert.equal(
      result.identity.tax_id,
      "G12345678"
    );
  }
);
