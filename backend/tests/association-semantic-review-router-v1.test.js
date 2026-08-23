import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAssociationSemanticReviewRouteV1,
} from "../scripts/lib/association-semantic-review-router-v1.js";

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
