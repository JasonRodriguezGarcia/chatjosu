import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAssociationSemanticReviewRouteV1,
} from "../scripts/lib/association-semantic-review-router-v1.js";

import {
  buildSemanticGatedAllowedV1,
} from "../scripts/run-semantic-discovery-v1.js";

const EUSKADI_PRIORITY_SUPPORT_CATEGORIES =
  [
    "Ayuda a Enfermos",
  ];

function canonical({
  categories = [],
  needs = [],
  functions = [],
  populations = [],
  activities = [],
  lanes = [],
} = {}) {
  return {
    source_facts: {
      source_categories:
        categories,
    },

    semantic: {
      needs: {
        keys: needs,
      },

      functions: {
        keys: functions,
      },

      populations: {
        keys: populations,
      },

      activities: {
        keys: activities,
      },
    },

    publication: {
      lanes,
    },
  };
}

test(
  "semantic zero in assistive source domain is support critical",
  () => {
    const result =
      buildAssociationSemanticReviewRouteV1({
        canonical:
          canonical({
            categories: [
              "Carácter Benéfico Asistencial",
              "Ayuda a Enfermos",
            ],
          }),

        prioritySupportCategories:
          EUSKADI_PRIORITY_SUPPORT_CATEGORIES,
      });

    assert.equal(
      result.route,
      "support_critical"
    );

    assert.equal(
      result.priority,
      10
    );
  }
);

test(
  "strong function without support lane becomes support review",
  () => {
    const result =
      buildAssociationSemanticReviewRouteV1({
        canonical:
          canonical({
            functions: [
              "TERAPIA",
            ],
          }),
      });

    assert.equal(
      result.route,
      "support_review"
    );
  }
);

test(
  "strong function does not require review when already support",
  () => {
    const result =
      buildAssociationSemanticReviewRouteV1({
        canonical:
          canonical({
            functions: [
              "TERAPIA",
            ],

            lanes: [
              "support_resource",
            ],
          }),
      });

    assert.equal(
      result.route,
      "no_action"
    );
  }
);

test(
  "other semantic zero remains lower-priority semantic zero",
  () => {
    const result =
      buildAssociationSemanticReviewRouteV1({
        canonical:
          canonical({
            categories: [
              "Cultura General",
              "Promoción Cultural",
            ],
          }),
      });

    assert.equal(
      result.route,
      "semantic_zero"
    );

    assert.equal(
      result.priority,
      30
    );
  }
);

test(
  "resolved community record requires no immediate inference",
  () => {
    const result =
      buildAssociationSemanticReviewRouteV1({
        canonical:
          canonical({
            activities: [
              "MUSICA",
            ],

            lanes: [
              "community_wellbeing",
            ],
          }),
      });

    assert.equal(
      result.route,
      "no_action"
    );
  }
);

test(
  "source-specific category does not affect generic router unless configured",
  () => {
    const row =
      canonical({
        categories: [
          "Carácter Benéfico Asistencial",
          "Ayuda a Enfermos",
        ],
      });

    const generic =
      buildAssociationSemanticReviewRouteV1({
        canonical: row,
      });

    assert.equal(
      generic.route,
      "semantic_zero"
    );

    const configured =
      buildAssociationSemanticReviewRouteV1({
        canonical: row,

        prioritySupportCategories: [
          "Ayuda a Enfermos",
        ],
      });

    assert.equal(
      configured.route,
      "support_critical"
    );
  }
);

test(
  "gated allowed: constrained uses route_allowed, llm_open keeps full allowed, legacy filters",
  () => {
    const allowed =
      {
        needs:
          [
            { key: "A1", label: "a1" },
            { key: "A2", label: "a2" },
          ],

        populations:
          [
            "P1",
            "P2",
          ],

        activities:
          [
            "ACT1",
            "ACT2",
          ],

        functions:
          [
            "F1",
            "F2",
          ],

        organization_types:
          [
            "OT1",
          ],

        service_modes:
          [
            "SM1",
          ],
      };

    const constrained =
      buildSemanticGatedAllowedV1({
        route:
          "constrained",

        routeAllowed:
          {
            needs:
              [
                { key: "A1", label: "a1" },
              ],

            populations:
              [
                "P1",
              ],

            activities:
              [
                "ACT1",
              ],

            functions:
              [
                "F1",
              ],
          },

        allowed,
      });

    assert.deepEqual(
      constrained.needs,
      [
        { key: "A1", label: "a1" },
      ]
    );

    assert.deepEqual(
      constrained.populations,
      [
        "P1",
      ]
    );

    assert.deepEqual(
      constrained.activities,
      [
        "ACT1",
      ]
    );

    assert.deepEqual(
      constrained.functions,
      [
        "F1",
      ]
    );

    assert.deepEqual(
      constrained.organization_types,
      allowed.organization_types
    );

    assert.deepEqual(
      constrained.service_modes,
      allowed.service_modes
    );

    const llmOpen =
      buildSemanticGatedAllowedV1({
        route:
          "llm_open",

        routeAllowed:
          undefined,

        allowed,
      });

    assert.deepEqual(
      llmOpen.needs,
      allowed.needs
    );

    assert.deepEqual(
      llmOpen.populations,
      allowed.populations
    );

    assert.deepEqual(
      llmOpen.activities,
      allowed.activities
    );

    assert.deepEqual(
      llmOpen.functions,
      allowed.functions
    );

    const legacy =
      buildSemanticGatedAllowedV1({
        route:
          "semantic_zero",

        routeAllowed:
          undefined,

        allowed,

        candidateNeedKeys:
          new Set(
            [
              "A2",
            ]
          ),

        candidatePopulationKeys:
          new Set(
            [
              "P2",
            ]
          ),

        candidateActivityKeys:
          new Set(
            [
              "ACT2",
            ]
          ),

        functionEvidenceKeys:
          new Set(
            [
              "F2",
            ]
          ),
      });

    assert.deepEqual(
      legacy.needs,
      [
        { key: "A2", label: "a2" },
      ]
    );

    assert.deepEqual(
      legacy.populations,
      [
        "P2",
      ]
    );

    assert.deepEqual(
      legacy.activities,
      [
        "ACT2",
      ]
    );

    assert.deepEqual(
      legacy.functions,
      [
        "F2",
      ]
    );
  }
);
