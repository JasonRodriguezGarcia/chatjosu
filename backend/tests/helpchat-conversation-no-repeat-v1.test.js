import test from "node:test";
import assert from "node:assert/strict";

import {
  assessNoRepeatV1,
} from "../helpchat/conversation-no-repeat-v1.js";

function pending({
  node = "health_detail",
  personId = "self",
  mode = "free_text",
  dimension = null,
} = {}) {
  return {
    node,
    personId,
    mode,
    ...(dimension
      ? { dimension }
      : {}),
  };
}

test(
  "progress always permits the resulting state",
  () => {
    assert.deepEqual(
      assessNoRepeatV1({
        progress: {
          progressed: true,
          reasons: [
            "pending_node_changed",
          ],
        },
        beforePending:
          pending(),
        afterPending:
          pending({
            node:
              "mental_health_detail",
          }),
      }),
      {
        status: "allow",
        reason:
          "conversation_progressed",
      },
    );
  },
);

test(
  "no progress without a pending clarification is not a clarification loop",
  () => {
    assert.deepEqual(
      assessNoRepeatV1({
        progress: {
          progressed: false,
          reasons: [],
        },
        beforePending: null,
        afterPending: null,
      }),
      {
        status: "allow",
        reason:
          "no_pending_clarification",
      },
    );
  },
);

test(
  "a required unresolved clarification may remain pending after insufficient input",
  () => {
    assert.deepEqual(
      assessNoRepeatV1({
        progress: {
          progressed: false,
          reasons: [],
        },
        beforePending:
          pending({
            node:
              "health_detail",
            dimension:
              "diagnosis_status",
          }),
        afterPending:
          pending({
            node:
              "health_detail",
            dimension:
              "diagnosis_status",
          }),
        clarificationPurpose:
          "required",
        inputInsufficient:
          true,
        dimensionResolved:
          false,
      }),
      {
        status: "allow",
        reason:
          "required_clarification_still_unresolved",
      },
    );
  },
);

test(
  "a resolved dimension must not be asked again without progress",
  () => {
    assert.deepEqual(
      assessNoRepeatV1({
        progress: {
          progressed: false,
          reasons: [],
        },
        beforePending:
          pending({
            node:
              "health_detail",
            dimension:
              "diagnosis_status",
          }),
        afterPending:
          pending({
            node:
              "health_detail",
            dimension:
              "diagnosis_status",
          }),
        clarificationPurpose:
          "required",
        inputInsufficient:
          false,
        dimensionResolved:
          true,
      }),
      {
        status: "block_repeat",
        reason:
          "dimension_already_resolved",
      },
    );
  },
);

test(
  "an optional refinement must not repeat after an insufficient answer",
  () => {
    assert.deepEqual(
      assessNoRepeatV1({
        progress: {
          progressed: false,
          reasons: [],
        },
        beforePending:
          pending({
            node:
              "mental_behavior_detail",
          }),
        afterPending:
          pending({
            node:
              "mental_behavior_detail",
          }),
        clarificationPurpose:
          "optional_refinement",
        inputInsufficient:
          true,
        dimensionResolved:
          false,
      }),
      {
        status: "block_repeat",
        reason:
          "optional_refinement_unavailable",
      },
    );
  },
);

test(
  "same pending clarification after material input and no progress is suspicious",
  () => {
    assert.deepEqual(
      assessNoRepeatV1({
        progress: {
          progressed: false,
          reasons: [],
        },
        beforePending:
          pending({
            node:
              "health_detail",
          }),
        afterPending:
          pending({
            node:
              "health_detail",
          }),
        clarificationPurpose:
          "required",
        inputInsufficient:
          false,
        dimensionResolved:
          false,
      }),
      {
        status: "block_repeat",
        reason:
          "informative_answer_did_not_advance",
      },
    );
  },
);

test(
  "a changed pending state is not blocked even if progress metadata is inconsistent",
  () => {
    assert.deepEqual(
      assessNoRepeatV1({
        progress: {
          progressed: false,
          reasons: [],
        },
        beforePending:
          pending({
            node:
              "mental_health_detail",
            mode:
              "choice",
          }),
        afterPending:
          pending({
            node:
              "mental_behavior_detail",
            mode:
              "free_text",
          }),
        clarificationPurpose:
          "required",
        inputInsufficient:
          false,
        dimensionResolved:
          false,
      }),
      {
        status: "allow",
        reason:
          "pending_state_changed",
      },
    );
  },
);

test(
  "unknown clarification policy stays conservative on insufficient input",
  () => {
    assert.deepEqual(
      assessNoRepeatV1({
        progress: {
          progressed: false,
          reasons: [],
        },
        beforePending:
          pending(),
        afterPending:
          pending(),
        clarificationPurpose:
          null,
        inputInsufficient:
          true,
        dimensionResolved:
          false,
      }),
      {
        status: "allow",
        reason:
          "no_repeat_rule_not_applicable",
      },
    );
  },
);
