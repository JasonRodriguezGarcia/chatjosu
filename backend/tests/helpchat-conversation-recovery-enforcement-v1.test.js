import test from "node:test";
import assert from "node:assert/strict";

import {
  enforceConversationRecoveryV1,
} from "../helpchat/conversation-recovery-enforcement-v1.js";

function baseContext() {
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
    ],
    currentFocus: "self",
    currentGoal: null,
    pendingClarification: {
      node: "health_detail",
      personId: "self",
      mode: "free_text",
      dimension: "diagnosis_status",
    },
    territory: {
      province: null,
      municipality: null,
    },
    resourcesShown: [],
  };
}

function blockedUnderstanding() {
  return {
    status: "needs_clarification",
    tag: null,
    needsClarification: true,
    clarificationQuestion:
      "¿Os han indicado ya alguna enfermedad o diagnóstico?",
    provider:
      "health_statement_authority",
    model:
      "health-statement-authority-v1",
    context: null,
  };
}

function recoveredAlcohol() {
  return {
    status: "recovered",
    reason:
      "legal_graph_path_resolved",
    sourcePending: {
      node: "health_detail",
      personId: "self",
      mode: "free_text",
      dimension:
        "diagnosis_status",
    },
    path: [
      {
        nodeId: "need_type",
        choiceId: "addiction",
        actionType: "goto",
        targetNode:
          "addiction_detail",
      },
      {
        nodeId:
          "addiction_detail",
        choiceId: "alcohol",
        actionType:
          "resolve_need",
        targetNode: null,
      },
    ],
    action: {
      type: "resolve_need",
      resolvedNeeds: [
        {
          tag_id: 2,
          descripcion:
            "ALCOHOLISMO",
        },
      ],
    },
    matches: [],
  };
}

test(
  "enforces a recovered resolve_need through the canonical runtime transition",
  () => {
    const result =
      enforceConversationRecoveryV1({
        relationalContext:
          baseContext(),
        personId: "self",
        understanding:
          blockedUnderstanding(),
        recovery:
          recoveredAlcohol(),
      });

    assert.equal(
      result.status,
      "enforced",
    );

    assert.equal(
      result.context
        .pendingClarification,
      null,
    );

    assert.equal(
      result.understanding.status,
      "resolved",
    );

    assert.equal(
      result.understanding
        .needsClarification,
      false,
    );

    assert.deepEqual(
      result.understanding.tag,
      {
        tag_id: 2,
        descripcion:
          "ALCOHOLISMO",
      },
    );

    assert.deepEqual(
      result.understanding
        .resolvedNeeds,
      [
        {
          tag_id: 2,
          descripcion:
            "ALCOHOLISMO",
          source:
            "conversation_recovery",
        },
      ],
    );

    assert.equal(
      result.understanding.provider,
      "conversation_recovery",
    );

    assert.equal(
      result.understanding.model,
      "conversation-recovery-v1",
    );
  },
);

test(
  "does not persist the recovered need before normal runtime finalization",
  () => {
    const result =
      enforceConversationRecoveryV1({
        relationalContext:
          baseContext(),
        personId: "self",
        understanding:
          blockedUnderstanding(),
        recovery:
          recoveredAlcohol(),
      });

    const self =
      result.context.people.find(
        (person) =>
          person.id === "self",
      );

    assert.deepEqual(
      self.needs,
      [],
    );
  },
);

test(
  "does not enforce unresolved recovery",
  () => {
    const context =
      baseContext();

    const understanding =
      blockedUnderstanding();

    const result =
      enforceConversationRecoveryV1({
        relationalContext:
          context,
        personId: "self",
        understanding,
        recovery: {
          status: "unresolved",
          reason:
            "no_legal_choice",
          action: null,
        },
      });

    assert.equal(
      result.status,
      "not_enforced",
    );

    assert.deepEqual(
      result.context,
      context,
    );

    assert.deepEqual(
      result.understanding,
      understanding,
    );
  },
);

test(
  "does not enforce a recovered action without resolved needs",
  () => {
    const result =
      enforceConversationRecoveryV1({
        relationalContext:
          baseContext(),
        personId: "self",
        understanding:
          blockedUnderstanding(),
        recovery: {
          status: "recovered",
          reason:
            "legal_graph_path_resolved",
          sourcePending: {
            node:
              "health_detail",
          },
          action: {
            type:
              "resolve_need",
            resolvedNeeds: [],
          },
        },
      });

    assert.equal(
      result.status,
      "not_enforced",
    );

    assert.equal(
      result.reason,
      "invalid_recovery_action",
    );
  },
);

test(
  "does not enforce unsupported recovery action types",
  () => {
    const result =
      enforceConversationRecoveryV1({
        relationalContext:
          baseContext(),
        personId: "self",
        understanding:
          blockedUnderstanding(),
        recovery: {
          status: "recovered",
          reason:
            "legal_graph_path_resolved",
          sourcePending: {
            node:
              "health_detail",
          },
          action: {
            type: "goto",
            node:
              "addiction_detail",
          },
        },
      });

    assert.equal(
      result.status,
      "not_enforced",
    );

    assert.equal(
      result.reason,
      "unsupported_recovery_action",
    );
  },
);
