import test from "node:test";
import assert from "node:assert/strict";

import {
  getOpenClarificationPolicyV1,
  isAllowedOpenClarificationTagV1,
  listOpenClarificationPoliciesV1,
  resolveOpenClarificationInsufficientV1,
} from "../helpchat/open-clarification-policy-v1.js";

test(
  "open clarification policy exposes the canonical open nodes",
  () => {
    assert.deepEqual(
      listOpenClarificationPoliciesV1(),
      [
        "health_detail",
        "mental_behavior_detail",
        "addiction_substance_detail",
        "addiction_behavior_detail",
      ],
    );
  },
);

test(
  "health_detail can resolve only against its bounded catalog",
  () => {
    assert.equal(
      isAllowedOpenClarificationTagV1({
        nodeId:
          "health_detail",
        tagId: 13,
      }),
      true,
    );

    assert.equal(
      isAllowedOpenClarificationTagV1({
        nodeId:
          "health_detail",
        tagId: 25,
      }),
      false,
    );

    assert.equal(
      isAllowedOpenClarificationTagV1({
        nodeId:
          "health_detail",
        tagId: 2,
      }),
      false,
    );
  },
);

test(
  "mental_behavior_detail cannot escape its bounded mental-health catalog",
  () => {
    for (
      const tagId of [
        4,
        31,
        32,
        33,
      ]
    ) {
      assert.equal(
        isAllowedOpenClarificationTagV1({
          nodeId:
            "mental_behavior_detail",
          tagId,
        }),
        true,
      );
    }

    assert.equal(
      isAllowedOpenClarificationTagV1({
        nodeId:
          "mental_behavior_detail",
        tagId: 25,
      }),
      false,
    );
  },
);

test(
  "non-alcohol substance clarification has no invented operational tag",
  () => {
    const policy =
      getOpenClarificationPolicyV1(
        "addiction_substance_detail",
      );

    assert.equal(
      policy.canResolveDirectly,
      false,
    );

    assert.deepEqual(
      policy.allowedTagIds,
      [],
    );

    assert.equal(
      isAllowedOpenClarificationTagV1({
        nodeId:
          "addiction_substance_detail",
        tagId: 2,
      }),
      false,
    );
  },
);

test(
  "behavioral addiction clarification has no invented operational tag",
  () => {
    const policy =
      getOpenClarificationPolicyV1(
        "addiction_behavior_detail",
      );

    assert.equal(
      policy.canResolveDirectly,
      false,
    );

    assert.deepEqual(
      policy.allowedTagIds,
      [],
    );

    assert.equal(
      isAllowedOpenClarificationTagV1({
        nodeId:
          "addiction_behavior_detail",
        tagId: 2,
      }),
      false,
    );
  },
);


test(
  "mental behavior detail is an optional refinement over broad mental-health support",
  () => {
    const policy =
      getOpenClarificationPolicyV1(
        "mental_behavior_detail",
      );

    assert.equal(
      policy.purpose,
      "optional_refinement",
    );

    assert.deepEqual(
      policy.baseNeed,
      {
        tag_id: 31,
        descripcion:
          "SALUD MENTAL",
      },
    );

    assert.equal(
      policy.insufficientStrategy,
      "retain_existing_base_need",
    );
  },
);

test(
  "insufficient optional refinement retains an existing base need",
  () => {
    assert.deepEqual(
      resolveOpenClarificationInsufficientV1({
        nodeId:
          "mental_behavior_detail",
        person: {
          id:
            "person_1",
          needs: [
            "SALUD MENTAL",
          ],
        },
      }),
      {
        status:
          "resolved",
        reason:
          "optional_detail_unavailable",
        need: {
          tag_id: 31,
          descripcion:
            "SALUD MENTAL",
        },
      },
    );
  },
);

test(
  "optional refinement cannot invent a missing base need",
  () => {
    assert.deepEqual(
      resolveOpenClarificationInsufficientV1({
        nodeId:
          "mental_behavior_detail",
        person: {
          id:
            "person_1",
          needs: [],
        },
      }),
      {
        status:
          "unresolved",
        reason:
          "base_need_not_established",
        need: null,
      },
    );
  },
);

test(
  "required or unspecified clarification does not silently advance on insufficient input",
  () => {
    assert.deepEqual(
      resolveOpenClarificationInsufficientV1({
        nodeId:
          "health_detail",
        person: {
          id:
            "person_1",
          needs: [
            "SALUD MENTAL",
          ],
        },
      }),
      {
        status:
          "unresolved",
        reason:
          "strategy_not_applicable",
        need: null,
      },
    );
  },
);
