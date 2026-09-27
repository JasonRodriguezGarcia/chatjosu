import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveConversationRecoveryV1,
} from "../helpchat/conversation-recovery-v1.js";

const BLOCKED_REPEAT =
  Object.freeze({
    status: "block_repeat",
    reason:
      "informative_answer_did_not_advance",
  });

function healthDiagnosisPending() {
  return {
    node: "health_detail",
    personId: "self",
    mode: "free_text",
    dimension:
      "diagnosis_status",
  };
}

test(
  "recovers a blocked health clarification through the legal alcohol graph path",
  () => {
    const result =
      resolveConversationRecoveryV1({
        inputMessage:
          "Es por alcohol",
        pendingClarification:
          healthDiagnosisPending(),
        noRepeatDecision:
          BLOCKED_REPEAT,
      });

    assert.equal(
      result.status,
      "recovered",
    );

    assert.deepEqual(
      result.action,
      {
        type:
          "resolve_need",
        resolvedNeeds: [
          {
            tag_id: 2,
            descripcion:
              "ALCOHOLISMO",
          },
        ],
      },
    );

    assert.deepEqual(
      result.path.map(
        (step) => ({
          nodeId:
            step.nodeId,
          choiceId:
            step.choiceId,
          actionType:
            step.actionType,
          targetNode:
            step.targetNode,
        }),
      ),
      [
        {
          nodeId:
            "need_type",
          choiceId:
            "addiction",
          actionType:
            "goto",
          targetNode:
            "addiction_detail",
        },
        {
          nodeId:
            "addiction_detail",
          choiceId:
            "alcohol",
          actionType:
            "resolve_need",
          targetNode:
            null,
        },
      ],
    );
  },
);

test(
  "does not recover when the no-repeat guard did not block",
  () => {
    const result =
      resolveConversationRecoveryV1({
        inputMessage:
          "Es por alcohol",
        pendingClarification:
          healthDiagnosisPending(),
        noRepeatDecision: {
          status: "allow",
          reason:
            "conversation_progressed",
        },
      });

    assert.equal(
      result.status,
      "not_applicable",
    );

    assert.equal(
      result.action,
      null,
    );
  },
);

test(
  "does not invent an alcohol recovery from unrelated drinking language",
  () => {
    const result =
      resolveConversationRecoveryV1({
        inputMessage:
          "Estoy bebiendo agua",
        pendingClarification:
          healthDiagnosisPending(),
        noRepeatDecision:
          BLOCKED_REPEAT,
      });

    assert.equal(
      result.status,
      "unresolved",
    );

    assert.equal(
      result.action,
      null,
    );
  },
);

test(
  "insufficient text cannot produce a recovery",
  () => {
    const result =
      resolveConversationRecoveryV1({
        inputMessage:
          "No sé",
        pendingClarification:
          healthDiagnosisPending(),
        noRepeatDecision:
          BLOCKED_REPEAT,
      });

    assert.equal(
      result.status,
      "unresolved",
    );

    assert.equal(
      result.action,
      null,
    );
  },
);

test(
  "ambiguous multi-domain text is not collapsed to one recovery path",
  () => {
    const result =
      resolveConversationRecoveryV1({
        inputMessage:
          "Es por alcohol y depresión",
        pendingClarification:
          healthDiagnosisPending(),
        noRepeatDecision:
          BLOCKED_REPEAT,
      });

    assert.equal(
      result.status,
      "ambiguous",
    );

    assert.equal(
      result.action,
      null,
    );

    assert.deepEqual(
      new Set(result.matches),
      new Set([
        "emotional_health",
        "addiction",
      ]),
    );
  },
);

test(
  "recovery requires an existing pending clarification",
  () => {
    const result =
      resolveConversationRecoveryV1({
        inputMessage:
          "Es por alcohol",
        pendingClarification:
          null,
        noRepeatDecision:
          BLOCKED_REPEAT,
      });

    assert.equal(
      result.status,
      "not_applicable",
    );

    assert.equal(
      result.action,
      null,
    );
  },
);

test(
  "does not replay the graph when an already resolved dimension caused the block",
  () => {
    const result =
      resolveConversationRecoveryV1({
        inputMessage:
          "Es por alcohol",
        pendingClarification:
          healthDiagnosisPending(),
        noRepeatDecision: {
          status:
            "block_repeat",
          reason:
            "dimension_already_resolved",
        },
      });

    assert.equal(
      result.status,
      "not_applicable",
    );

    assert.equal(
      result.reason,
      "unsupported_repeat_reason",
    );

    assert.equal(
      result.action,
      null,
    );
  },
);

test(
  "does not replay the graph when optional refinement is unavailable",
  () => {
    const result =
      resolveConversationRecoveryV1({
        inputMessage:
          "Es por alcohol",
        pendingClarification:
          healthDiagnosisPending(),
        noRepeatDecision: {
          status:
            "block_repeat",
          reason:
            "optional_refinement_unavailable",
        },
      });

    assert.equal(
      result.status,
      "not_applicable",
    );

    assert.equal(
      result.reason,
      "unsupported_repeat_reason",
    );

    assert.equal(
      result.action,
      null,
    );
  },
);
