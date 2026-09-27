import {
  CLARIFICATION_ACTION_TYPES_V1,
  resolveClarificationChoiceV1,
} from "./clarification-graph-v1.js";

import {
  resolveClarificationTextV1,
} from "./clarification-text-resolver-v1.js";

const ROOT_NODE_ID =
  "need_type";

const MAX_GRAPH_HOPS =
  6;

function baseResult({
  status,
  reason,
  sourcePending,
  path = [],
  action = null,
  matches = [],
}) {
  return {
    status,
    reason,
    sourcePending:
      sourcePending
        ? structuredClone(
            sourcePending,
          )
        : null,
    path:
      structuredClone(path),
    action:
      action
        ? structuredClone(action)
        : null,
    matches: [
      ...matches,
    ],
  };
}

export function resolveConversationRecoveryV1({
  inputMessage,
  pendingClarification,
  noRepeatDecision,
} = {}) {
  if (
    noRepeatDecision?.status !==
      "block_repeat"
  ) {
    return baseResult({
      status:
        "not_applicable",
      reason:
        "repeat_not_blocked",
      sourcePending:
        pendingClarification,
    });
  }

  if (
    noRepeatDecision?.reason !==
      "informative_answer_did_not_advance"
  ) {
    return baseResult({
      status:
        "not_applicable",
      reason:
        "unsupported_repeat_reason",
      sourcePending:
        pendingClarification,
    });
  }

  if (
    !pendingClarification?.node
  ) {
    return baseResult({
      status:
        "not_applicable",
      reason:
        "no_pending_clarification",
      sourcePending: null,
    });
  }

  let nodeId =
    ROOT_NODE_ID;

  const visited =
    new Set();

  const path = [];

  for (
    let hop = 0;
    hop < MAX_GRAPH_HOPS;
    hop += 1
  ) {
    if (visited.has(nodeId)) {
      return baseResult({
        status:
          "unresolved",
        reason:
          "graph_cycle",
        sourcePending:
          pendingClarification,
        path,
      });
    }

    visited.add(nodeId);

    const textResolution =
      resolveClarificationTextV1({
        nodeId,
        inputMessage,
      });

    if (
      textResolution.status ===
        "ambiguous"
    ) {
      return baseResult({
        status:
          "ambiguous",
        reason:
          "multiple_legal_choices",
        sourcePending:
          pendingClarification,
        path,
        matches:
          textResolution.matches,
      });
    }

    if (
      textResolution.status !==
        "resolved" ||
      !textResolution.choiceId
    ) {
      return baseResult({
        status:
          "unresolved",
        reason:
          "no_legal_choice",
        sourcePending:
          pendingClarification,
        path,
      });
    }

    const graphResolution =
      resolveClarificationChoiceV1({
        nodeId,
        choiceId:
          textResolution.choiceId,
      });

    if (
      graphResolution.status !==
        "resolved" ||
      !graphResolution.action
    ) {
      return baseResult({
        status:
          "unresolved",
        reason:
          "invalid_graph_transition",
        sourcePending:
          pendingClarification,
        path,
      });
    }

    const action =
      graphResolution.action;

    const targetNode =
      action.type ===
        CLARIFICATION_ACTION_TYPES_V1
          .GOTO
        ? action.node || null
        : null;

    path.push({
      nodeId,
      choiceId:
        textResolution.choiceId,
      actionType:
        action.type,
      targetNode,
    });

    if (
      action.type ===
        CLARIFICATION_ACTION_TYPES_V1
          .RESOLVE_NEED
    ) {
      return baseResult({
        status:
          "recovered",
        reason:
          "legal_graph_path_resolved",
        sourcePending:
          pendingClarification,
        path,
        action,
      });
    }

    if (
      action.type !==
        CLARIFICATION_ACTION_TYPES_V1
          .GOTO ||
      !targetNode
    ) {
      return baseResult({
        status:
          "unresolved",
        reason:
          "non_resolving_terminal_action",
        sourcePending:
          pendingClarification,
        path,
      });
    }

    nodeId =
      targetNode;
  }

  return baseResult({
    status:
      "unresolved",
    reason:
      "graph_hop_limit",
    sourcePending:
      pendingClarification,
    path,
  });
}
