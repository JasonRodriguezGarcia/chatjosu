import {
  normalizeConversationContextV1,
} from "../helpchat/conversation-context-v1.js";

import {
  resolveSemanticAnchors,
  isClearlyInsufficient,
} from "../helpchat/semantic-fast-gates.js";

import {
  buildClarification,
} from "../helpchat/clarification-policy-v1.js";

import {
  resolveControlledReplyV1,
} from "../helpchat/controlled-replies-v1.js";

import {
  getClarificationNodeV1,
  resolveClarificationChoiceV1,
} from "../helpchat/clarification-graph-v1.js";

import {
  resolveClarificationTextV1,
} from "../helpchat/clarification-text-resolver-v1.js";

const COGNITIVE_TAGS = new Set([
  "ALZHEIMER",
  "ENFERMEDAD NEUROLÓGICA PARCKINSON ALZHEIMER",
]);

const MENTAL_HEALTH_TAGS = new Set([
  "SALUD MENTAL",
  "SALUD MENTAL BIPOLAR",
  "SALUD MENTAL ANOREXIA BULIMIA NERVIOSA TRASTORNO ALIMENTARIO",
]);

function deriveClarificationDimension(
  diagnostics
) {
  const top1 =
    diagnostics?.top1?.tag || null;

  const top2 =
    diagnostics?.top2?.tag || null;

  if (
    (
      COGNITIVE_TAGS.has(top1) &&
      MENTAL_HEALTH_TAGS.has(top2)
    ) ||
    (
      MENTAL_HEALTH_TAGS.has(top1) &&
      COGNITIVE_TAGS.has(top2)
    )
  ) {
    return "symptom_domain";
  }

  return "need_type";
}

function resolvedResult({
  tag,
  context,
  provider,
  model,
  durationMs,
  diagnostics = null,
  clarificationTransition = null,
}) {
  return {
    status: "resolved",
    tag,
    context,

    needsClarification: false,
    clarificationQuestion: null,
    missingDimension: null,

    provider,
    model,
    durationMs,

    diagnostics,
    clarificationTransition,
  };
}

function clarificationResult({
  context,
  missingDimension,
  provider,
  model,
  durationMs,
  diagnostics = null,
  clarificationTransition = null,
}) {
  const clarification =
    buildClarification({
      missingDimension,
    });

  const clarificationNode =
    getClarificationNodeV1(
      clarification.missingDimension,
    );

  return {
    status: "needs_clarification",
    tag: null,
    context,

    needsClarification: true,
    clarificationQuestion:
      clarification.clarificationQuestion,

    missingDimension:
      clarification.missingDimension,

    quickReplies:
      clarification.quickReplies,

    clarificationState:
      clarificationNode
        ? {
            node:
              clarificationNode.id,
            mode:
              Array.isArray(
                clarificationNode.choices,
              ) &&
              clarificationNode.choices.length > 0
                ? "choice"
                : "free_text",
          }
        : null,

    provider,
    model,
    durationMs,

    diagnostics,
    clarificationTransition,
  };
}

export function createHelpchatUnderstandingRouter({
  semanticClassifier,
} = {}) {
  if (!semanticClassifier?.classify) {
    throw new Error(
      "semanticClassifier es obligatorio."
    );
  }

  async function understand({
    inputMessage,
    conversationContext,
    controlledReply = null,
    pendingClarification = null,
  }) {
    const startedAt =
      performance.now();

    const context =
      normalizeConversationContextV1(
        conversationContext
      );

    let graphNode =
      controlledReply?.type ===
        "clarification_choice" &&
      typeof controlledReply?.node ===
        "string"
        ? controlledReply.node.trim()
        : null;

    let graphChoice =
      controlledReply?.type ===
        "clarification_choice" &&
      typeof controlledReply?.choice ===
        "string"
        ? controlledReply.choice.trim()
        : null;

    let graphInputProvider =
      graphNode &&
      graphChoice
        ? "clarification_graph"
        : null;

    if (
      !graphNode &&
      !graphChoice &&
      typeof pendingClarification?.node ===
        "string" &&
      pendingClarification.mode ===
        "choice"
    ) {
      const textResolution =
        resolveClarificationTextV1({
          nodeId:
            pendingClarification.node,
          inputMessage,
        });

      if (
        textResolution.status ===
          "resolved"
      ) {
        graphNode =
          textResolution.nodeId;

        graphChoice =
          textResolution.choiceId;

        graphInputProvider =
          "clarification_text";
      }
    }

    const graphTransition =
      graphNode &&
      graphChoice
        ? resolveClarificationChoiceV1({
            nodeId:
              graphNode,
            choiceId:
              graphChoice,
          })
        : null;

    if (
      graphTransition?.status ===
        "resolved"
    ) {
      const action =
        graphTransition.action;

      const durationMs =
        Math.round(
          (
            performance.now() -
            startedAt
          ) * 10
        ) / 10;

      if (
        action?.type ===
          "resolve_need"
      ) {
        const resolvedNeeds =
          Array.isArray(
            action.resolvedNeeds,
          )
            ? action.resolvedNeeds.map(
                (need) => ({
                  ...need,
                  source:
                    "clarification_graph",
                }),
              )
            : [];

        const primary =
          resolvedNeeds[0];

        if (primary) {
          return {
            ...resolvedResult({
              tag: {
                tag_id:
                  primary.tag_id,
                descripcion:
                  primary.descripcion,
              },
              context,
              provider:
                graphInputProvider ||
                "clarification_graph",
              model:
                graphInputProvider ===
                  "clarification_text"
                  ? "clarification-text-rules-v1"
                  : "clarification-graph-v1",
              durationMs,
              clarificationTransition: {
                sourceNode:
                  graphNode,
                action:
                  structuredClone(
                    action,
                  ),
              },
            }),
            resolvedNeeds,
          };
        }
      }

      if (
        action?.type === "goto" &&
        typeof action.node ===
          "string"
      ) {
        return clarificationResult({
          context,
          missingDimension:
            action.node,
          provider:
            graphInputProvider ||
            "clarification_graph",
          model:
            graphInputProvider ===
              "clarification_text"
              ? "clarification-text-rules-v1"
              : "clarification-graph-v1",
          durationMs,
          clarificationTransition: {
            sourceNode:
              graphNode,
            action:
              structuredClone(
                action,
              ),
          },
        });
      }

      if (
        action?.type ===
          "free_text"
      ) {
        return clarificationResult({
          context,
          missingDimension:
            "free_text",
          provider:
            graphInputProvider ||
            "clarification_graph",
          model:
            graphInputProvider ===
              "clarification_text"
              ? "clarification-text-rules-v1"
              : "clarification-graph-v1",
          durationMs,
          clarificationTransition: {
            sourceNode:
              graphNode,
            action:
              structuredClone(
                action,
              ),
          },
        });
      }
    }

    const controlledValue =
      controlledReply?.type ===
        "need_domain" &&
      typeof controlledReply?.value ===
        "string"
        ? controlledReply.value.trim()
        : null;

    const controlled =
      controlledValue
        ? resolveControlledReplyV1(
            controlledValue
          )
        : null;

    if (
      controlled?.type ===
        "resolved_need"
    ) {
      const resolvedNeeds =
        controlled.resolvedNeeds;

      const primary =
        resolvedNeeds[0];

      return {
        ...resolvedResult({
          tag: {
            tag_id:
              primary.tag_id,
            descripcion:
              primary.descripcion,
          },
          context,
          provider:
            "controlled_reply",
          model:
            "controlled-replies-v1",
          durationMs:
            Math.round(
              (
                performance.now() -
                startedAt
              ) * 10
            ) / 10,
        }),
        resolvedNeeds,
      };
    }

    if (
      controlled?.type ===
        "clarification"
    ) {
      return clarificationResult({
        context,
        missingDimension:
          controlled.missingDimension,
        provider:
          "controlled_reply",
        model:
          "controlled-replies-v1",
        durationMs:
          Math.round(
            (
              performance.now() -
                startedAt
            ) * 10
          ) / 10,
      });
    }

    if (
      controlled?.type ===
        "free_text"
    ) {
      return clarificationResult({
        context,
        missingDimension:
          "free_text",
        provider:
          "controlled_reply",
        model:
          "controlled-replies-v1",
        durationMs:
          Math.round(
            (
              performance.now() -
                startedAt
            ) * 10
          ) / 10,
      });
    }

    const anchors =
      resolveSemanticAnchors(
        inputMessage
      );

    if (anchors.length > 0) {
      const primary =
        anchors[0];

      return {
        ...resolvedResult({
          tag: primary,
          context,
          provider: "anchor",
          model: "semantic-fast-gates-v1",
          durationMs:
            Math.round(
              (
                performance.now() -
                startedAt
              ) * 10
            ) / 10,
        }),

        resolvedNeeds:
          anchors.map(
            (tag) => ({
              ...tag,
              source: "anchor",
            })
          ),
      };
    }

    if (
      isClearlyInsufficient(
        inputMessage,
        context
      )
    ) {
      return clarificationResult({
        context,
        missingDimension:
          "need_type",
        provider: "rule",
        model: "semantic-fast-gates-v1",
        durationMs:
          Math.round(
            (
              performance.now() -
              startedAt
            ) * 10
          ) / 10,
      });
    }

    const semantic =
      await semanticClassifier.classify({
        inputMessage,
        conversationContext: context,
      });

    const totalDurationMs =
      Math.round(
        (
          performance.now() -
          startedAt
        ) * 10
      ) / 10;

    if (
      semantic.status === "resolved" &&
      semantic.tag
    ) {
      return resolvedResult({
        tag: semantic.tag,
        context: semantic.context,
        provider:
          semantic.provider,
        model:
          semantic.model,
        durationMs:
          totalDurationMs,
        diagnostics:
          semantic.diagnostics,
      });
    }

    const missingDimension =
      deriveClarificationDimension(
        semantic.diagnostics
      );

    return clarificationResult({
      context: semantic.context,
      missingDimension,
      provider:
        semantic.provider,
      model:
        semantic.model,
      durationMs:
        totalDurationMs,
      diagnostics:
        semantic.diagnostics,
    });
  }

  return {
    understand,
  };
}

export {
  deriveClarificationDimension,
};
