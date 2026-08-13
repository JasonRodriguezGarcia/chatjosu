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
  };
}

function clarificationResult({
  context,
  missingDimension,
  provider,
  model,
  durationMs,
  diagnostics = null,
}) {
  const clarification =
    buildClarification({
      missingDimension,
    });

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

    provider,
    model,
    durationMs,

    diagnostics,
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
  }) {
    const startedAt =
      performance.now();

    const context =
      normalizeConversationContextV1(
        conversationContext
      );

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
