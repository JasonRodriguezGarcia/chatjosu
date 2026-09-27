import {
  applyClarificationTransitionV2,
} from "./conversation-runtime-v2.js";

function unchanged({
  relationalContext,
  understanding,
  reason,
}) {
  return {
    status:
      "not_enforced",
    reason,
    context:
      structuredClone(
        relationalContext,
      ),
    understanding:
      structuredClone(
        understanding,
      ),
  };
}

export function enforceConversationRecoveryV1({
  relationalContext,
  personId = null,
  understanding,
  recovery,
} = {}) {
  if (
    recovery?.status !==
      "recovered" ||
    !recovery?.action
  ) {
    return unchanged({
      relationalContext,
      understanding,
      reason:
        "recovery_not_resolved",
    });
  }

  if (
    recovery.action.type !==
      "resolve_need"
  ) {
    return unchanged({
      relationalContext,
      understanding,
      reason:
        "unsupported_recovery_action",
    });
  }

  const recoveredNeeds =
    Array.isArray(
      recovery.action
        .resolvedNeeds,
    )
      ? recovery.action
          .resolvedNeeds
          .filter(
            (need) =>
              Number.isFinite(
                Number(
                  need?.tag_id,
                ),
              ) &&
              typeof need?.descripcion ===
                "string" &&
              need.descripcion.trim(),
          )
          .map(
            (need) => ({
              tag_id:
                Number(
                  need.tag_id,
                ),
              descripcion:
                need.descripcion.trim(),
              source:
                "conversation_recovery",
            }),
          )
      : [];

  if (
    recoveredNeeds.length === 0
  ) {
    return unchanged({
      relationalContext,
      understanding,
      reason:
        "invalid_recovery_action",
    });
  }

  const primary =
    recoveredNeeds[0];

  const context =
    applyClarificationTransitionV2({
      relationalContext,
      personId,
      sourceNode:
        recovery.sourcePending
          ?.node ||
        null,
      action:
        recovery.action,
    });

  return {
    status: "enforced",
    reason:
      "recovered_need_promoted",
    context,
    understanding: {
      ...structuredClone(
        understanding,
      ),

      status: "resolved",

      tag: {
        tag_id:
          primary.tag_id,
        descripcion:
          primary.descripcion,
      },

      resolvedNeeds:
        recoveredNeeds,

      needsClarification:
        false,

      clarificationQuestion:
        null,

      quickReplies: [],

      clarificationTransition:
        null,

      clarificationState:
        null,

      provider:
        "conversation_recovery",

      model:
        "conversation-recovery-v1",

      diagnostics: {
        conversationRecovery: {
          reason:
            recovery.reason ||
            null,
          path:
            structuredClone(
              recovery.path ||
              [],
            ),
        },
      },
    },
  };
}
