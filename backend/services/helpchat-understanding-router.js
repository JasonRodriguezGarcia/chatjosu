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

import {
  getOpenClarificationPolicyV1,
} from "../helpchat/open-clarification-policy-v1.js";

import {
  resolveOpenClarificationReentryV1,
} from "../helpchat/open-clarification-reentry-v1.js";

import {
  assessHealthStatementAuthorityV1,
} from "../helpchat/health-statement-authority-v1.js";

import {
  interpretHealthClarificationAnswerV1,
} from "../helpchat/health-clarification-answer-v1.js";

import {
  buildOpenClarificationCandidatesV1,
} from "../helpchat/open-clarification-candidates-v1.js";

import {
  buildOpenClarificationTaskContext,
} from "../helpchat/task-context-v1.js";


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
  localLlmService = null,
} = {}) {
  if (!semanticClassifier?.classify) {
    throw new Error(
      "semanticClassifier es obligatorio."
    );
  }

  async function understand({
    inputMessage,
    conversationContext,
    relationalContext = null,
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

    const openNodeId =
      typeof pendingClarification?.node ===
        "string" &&
      pendingClarification.mode ===
        "free_text"
        ? pendingClarification.node
        : null;

    const openPolicy =
      openNodeId
        ? getOpenClarificationPolicyV1(
            openNodeId,
          )
        : null;

    if (openPolicy) {
      const openCandidates =
        buildOpenClarificationCandidatesV1(
          openNodeId,
        );

      const allowedTagIds =
        openCandidates.map(
          (candidate) =>
            candidate.tagId,
        );

      if (
        openPolicy.canResolveDirectly !==
          true ||
        allowedTagIds.length === 0
      ) {
        const reentry =
          resolveOpenClarificationReentryV1({
            nodeId:
              openNodeId,
            inputMessage,
          });

        if (
          reentry.status ===
            "resolved" &&
          reentry.targetNode
        ) {
          return clarificationResult({
            context,
            missingDimension:
              reentry.targetNode,
            provider:
              "open_clarification_reentry",
            model:
              "open-clarification-reentry-v1",
            durationMs:
              Math.round(
                (
                  performance.now() -
                    startedAt
                ) * 10
              ) / 10,
            diagnostics: {
              bounded: true,
              sourceNode:
                openNodeId,
              targetNode:
                reentry.targetNode,
              reason:
                "branch_reentry",
            },
            clarificationTransition: {
              sourceNode:
                openNodeId,
              action: {
                type:
                  "goto",
                node:
                  reentry.targetNode,
              },
            },
          });
        }

        return clarificationResult({
          context,
          missingDimension:
            openNodeId,
          provider:
            "open_clarification_policy",
          model:
            "open-clarification-policy-v1",
          durationMs:
            Math.round(
              (
                performance.now() -
                  startedAt
              ) * 10
            ) / 10,
          diagnostics: {
            bounded: true,
            allowedTagIds: [],
            reason:
              "no_operational_catalog",
          },
        });
      }

      if (
        openNodeId ===
          "health_detail"
      ) {
        const diagnosisAnswer =
          interpretHealthClarificationAnswerV1({
            dimension:
              "diagnosis_status",
            inputMessage,
          });

        const canResolveDiagnosisStatus =
          pendingClarification
            ?.dimension ===
            "diagnosis_status" ||
          (
            !pendingClarification
              ?.dimension &&
            pendingClarification
              ?.node ===
              "health_detail"
          );

        if (
          canResolveDiagnosisStatus &&
          diagnosisAnswer.status ===
            "resolved"
        ) {
          return clarificationResult({
            context,
            missingDimension:
              "goal",
            provider:
              "conversation_policy",
            model:
              "conversation-policy-v1",
            durationMs:
              Math.round(
                (
                  performance.now() -
                    startedAt
                ) * 10
              ) / 10,
            diagnostics: {
              bounded: true,
              reason:
                "diagnosis_status_resolved",
              resolvedDimension: {
                dimension:
                  diagnosisAnswer
                    .dimension,
                value:
                  diagnosisAnswer
                    .value,
              },
            },
            clarificationTransition: {
              sourceNode:
                openNodeId,
              action: {
                type:
                  "resolve_dimension",
                dimension:
                  diagnosisAnswer
                    .dimension,
                value:
                  diagnosisAnswer
                    .value,
              },
            },
          });
        }

        const healthAuthority =
          assessHealthStatementAuthorityV1(
            inputMessage
          );

        if (
          healthAuthority.status !==
            "explicit_condition"
        ) {
          return {
            ...clarificationResult({
              context,
              missingDimension:
                "health_detail",
              provider:
                "health_statement_authority",
              model:
                "health-statement-authority-v1",
              durationMs:
                Math.round(
                  (
                    performance.now() -
                      startedAt
                  ) * 10
                ) / 10,
              diagnostics: {
                bounded: true,
                healthAuthority:
                  healthAuthority.status,
                reason:
                  "condition_not_declared",
              },
            }),
            clarificationQuestion:
              "¿Os han indicado ya alguna enfermedad o diagnóstico, o de momento estáis observando estos síntomas?",
            clarificationState: {
              node:
                "health_detail",
              mode:
                "free_text",
              dimension:
                "diagnosis_status",
            },
          };
        }
      }

      if (
        openNodeId ===
          "mental_behavior_detail"
      ) {
        const behaviorDetailInsufficient =
          isClearlyInsufficient(
            inputMessage
          );

        const pendingPersonId =
          typeof pendingClarification
            ?.personId === "string"
            ? pendingClarification
                .personId
            : null;

        const pendingPerson =
          pendingPersonId &&
          Array.isArray(
            relationalContext?.people
          )
            ? relationalContext.people.find(
                (person) =>
                  person?.id ===
                  pendingPersonId
              ) || null
            : null;

        const hasBroadMentalHealthNeed =
          Array.isArray(
            pendingPerson?.needs
          ) &&
          pendingPerson.needs.includes(
            "SALUD MENTAL"
          );

        if (
          !behaviorDetailInsufficient ||
          hasBroadMentalHealthNeed
        ) {
          return resolvedResult({
            tag: {
              tag_id: 31,
              descripcion:
                "SALUD MENTAL",
            },
            context,
            provider:
              "conversation_policy",
            model:
              "conversation-policy-v1",
            durationMs:
              Math.round(
                (
                  performance.now() -
                    startedAt
                ) * 10
              ) / 10,
            diagnostics: {
              bounded: true,
              reason:
                behaviorDetailInsufficient
                  ? "optional_detail_unavailable"
                  : "behavior_detail_material_answer",
            },
            clarificationTransition: {
              sourceNode:
                openNodeId,
              action: {
                type:
                  "resolve_need",
                resolvedNeeds: [
                  {
                    tag_id: 31,
                    descripcion:
                      "SALUD MENTAL",
                  },
                ],
              },
            },
          });
        }
      }

      const semantic =
        await semanticClassifier.classify({
          inputMessage,
          conversationContext:
            context,
          allowedTagIds,
        });

      const totalDurationMs =
        Math.round(
          (
            performance.now() -
              startedAt
          ) * 10
        ) / 10;

      if (
        semantic.status ===
          "resolved" &&
        semantic.tag
      ) {
        return resolvedResult({
          tag:
            semantic.tag,
          context:
            semantic.context,
          provider:
            semantic.provider,
          model:
            semantic.model,
          durationMs:
            totalDurationMs,
          diagnostics:
            semantic.diagnostics,
          clarificationTransition: {
            sourceNode:
              openNodeId,
            action: {
              type:
                "resolve_need",
              resolvedNeeds: [
                {
                  tag_id:
                    semantic.tag
                      .tag_id,
                  descripcion:
                    semantic.tag
                      .descripcion,
                },
              ],
            },
          },
        });
      }

      const semanticShortlist =
        Array.isArray(
          semantic.diagnostics
            ?.candidates,
        )
          ? semantic.diagnostics
              .candidates
              .slice(0, 4)
          : [];

      if (
        localLlmService?.classify &&
        semanticShortlist.length > 0
      ) {
        const taskContext =
          buildOpenClarificationTaskContext({
            nodeId:
              openNodeId,
            inputMessage,
            relationalContext,
            candidates:
              semanticShortlist,
          });

        let localLlm;

        try {
          localLlm =
            await localLlmService.classify({
              taskContext,
              candidates:
                semanticShortlist,
            });
        } catch (localLlmError) {
          return clarificationResult({
            context:
              semantic.context,
            missingDimension:
              openNodeId,
            provider:
              "local_llm_error",
            model:
              localLlmService.model ||
              null,
            durationMs:
              Math.round(
                (
                  performance.now() -
                    startedAt
                ) * 10
              ) / 10,
            diagnostics: {
              semantic:
                semantic.diagnostics,
              localLlm: {
                status:
                  "error",
                code:
                  localLlmError?.code ||
                  "LOCAL_LLM_ERROR",
              },
            },
          });
        }

        if (
          localLlm.status ===
            "resolved" &&
          localLlm.tag
        ) {
          return resolvedResult({
            tag:
              localLlm.tag,
            context:
              semantic.context,
            provider:
              localLlm.provider,
            model:
              localLlm.model,
            durationMs:
              Math.round(
                (
                  performance.now() -
                    startedAt
                ) * 10
              ) / 10,
            diagnostics: {
              semantic:
                semantic.diagnostics,
              localLlm: {
                status:
                  localLlm.status,
                durationMs:
                  localLlm.durationMs,
              },
            },
            clarificationTransition: {
              sourceNode:
                openNodeId,
              action: {
                type:
                  "resolve_need",
                resolvedNeeds: [
                  {
                    tag_id:
                      localLlm.tag
                        .tag_id,
                    descripcion:
                      localLlm.tag
                        .descripcion,
                  },
                ],
              },
            },
          });
        }

        return clarificationResult({
          context:
            semantic.context,
          missingDimension:
            openNodeId,
          provider:
            localLlm.provider ||
            "ollama",
          model:
            localLlm.model ||
            localLlmService.model ||
            null,
          durationMs:
            Math.round(
              (
                performance.now() -
                  startedAt
              ) * 10
            ) / 10,
          diagnostics: {
            semantic:
              semantic.diagnostics,
            localLlm: {
              status:
                "needs_clarification",
              durationMs:
                localLlm.durationMs,
            },
          },
        });
      }

      return clarificationResult({
        context:
          semantic.context,
        missingDimension:
          openNodeId,
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
