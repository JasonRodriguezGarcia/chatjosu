import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveNoRepeatContextV1,
} from "../helpchat/conversation-no-repeat-context-v1.js";

function context({
  pendingClarification = null,
  personResolvedDimensions = null,
  currentFocus = "self",
} = {}) {
  return {
    version: 2,
    people: [
      {
        id: "self",
        relationship: "self",
        needs: [],
        facts: [],
        constraints: [],
      },
      {
        id: "person_1",
        relationship: "hermano",
        needs: [],
        facts: [],
        constraints: [],
        ...(personResolvedDimensions
          ? {
              resolvedDimensions:
                personResolvedDimensions,
            }
          : {}),
      },
    ],
    currentFocus,
    currentGoal: null,
    pendingClarification,
    territory: {
      province: null,
      municipality: null,
    },
    resourcesShown: [],
  };
}

test(
  "derives optional refinement purpose from canonical open policy",
  () => {
    const result =
      resolveNoRepeatContextV1({
        beforeContext:
          context({
            pendingClarification: {
              node:
                "mental_behavior_detail",
              personId:
                "person_1",
              mode:
                "free_text",
            },
          }),
        afterContext:
          context({
            pendingClarification: {
              node:
                "mental_behavior_detail",
              personId:
                "person_1",
              mode:
                "free_text",
            },
          }),
      });

    assert.deepEqual(
      result,
      {
        clarificationPurpose:
          "optional_refinement",
        dimensionResolved:
          false,
      },
    );
  },
);

test(
  "does not invent required purpose for an unspecified open policy",
  () => {
    const result =
      resolveNoRepeatContextV1({
        beforeContext:
          context({
            pendingClarification: {
              node:
                "health_detail",
              personId:
                "person_1",
              mode:
                "free_text",
            },
          }),
        afterContext:
          context({
            pendingClarification: {
              node:
                "health_detail",
              personId:
                "person_1",
              mode:
                "free_text",
            },
          }),
      });

    assert.deepEqual(
      result,
      {
        clarificationPurpose:
          null,
        dimensionResolved:
          false,
      },
    );
  },
);

test(
  "detects a resolved pending dimension for the pending person",
  () => {
    const before =
      context({
        pendingClarification: {
          node:
            "health_detail",
          personId:
            "person_1",
          mode:
            "free_text",
          dimension:
            "diagnosis_status",
        },
      });

    const after =
      context({
        pendingClarification: {
          node:
            "health_detail",
          personId:
            "person_1",
          mode:
            "free_text",
          dimension:
            "diagnosis_status",
        },
        personResolvedDimensions: {
          diagnosis_status:
            "not_confirmed",
        },
      });

    assert.deepEqual(
      resolveNoRepeatContextV1({
        beforeContext:
          before,
        afterContext:
          after,
      }),
      {
        clarificationPurpose:
          null,
        dimensionResolved:
          true,
      },
    );
  },
);

test(
  "does not use current focus instead of the pending person",
  () => {
    const before =
      context({
        currentFocus:
          "self",
        pendingClarification: {
          node:
            "health_detail",
          personId:
            "person_1",
          mode:
            "free_text",
          dimension:
            "diagnosis_status",
        },
      });

    const after =
      context({
        currentFocus:
          "self",
        pendingClarification: {
          node:
            "health_detail",
          personId:
            "person_1",
          mode:
            "free_text",
          dimension:
            "diagnosis_status",
        },
      });

    /*
     * Aunque self fuera el currentFocus,
     * la dimensión pertenece a person_1.
     */
    after.people[0].resolvedDimensions = {
      diagnosis_status:
        "confirmed",
    };

    assert.deepEqual(
      resolveNoRepeatContextV1({
        beforeContext:
          before,
        afterContext:
          after,
      }),
      {
        clarificationPurpose:
          null,
        dimensionResolved:
          false,
      },
    );
  },
);

test(
  "without a pending clarification there is no guard metadata",
  () => {
    assert.deepEqual(
      resolveNoRepeatContextV1({
        beforeContext:
          context(),
        afterContext:
          context(),
      }),
      {
        clarificationPurpose:
          null,
        dimensionResolved:
          false,
      },
    );
  },
);
