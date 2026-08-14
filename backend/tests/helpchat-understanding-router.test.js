import test from "node:test";
import assert from "node:assert/strict";

import {
  createHelpchatUnderstandingRouter,
  deriveClarificationDimension,
} from "../services/helpchat-understanding-router.js";

function fakeSemanticClassifier({
  status = "resolved",
  tag = {
    tag_id: 7,
    descripcion: "BIENESTAR SOCIAL",
  },
  diagnostics = {
    top1: {
      tag: "BIENESTAR SOCIAL",
      score: 0.8,
    },
    top2: {
      tag: "EXCLUSIÓN SOCIAL",
      score: 0.6,
    },
    margin: 0.2,
  },
} = {}) {
  return {
    async classify({
      conversationContext,
    }) {
      return {
        status,
        tag:
          status === "resolved"
            ? tag
            : null,

        context:
          conversationContext,

        needsClarification:
          status !== "resolved",

        provider: "embedding",
        model: "fake",

        diagnostics,
        durationMs: 10,
      };
    },
  };
}

test(
  "anchor explícito resuelve sin embedding",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;

            throw new Error(
              "No debería ejecutarse."
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Mi padre tiene Alzheimer",
        conversationContext: null,
      });

    assert.equal(
      result.status,
      "resolved"
    );

    assert.equal(
      result.tag.descripcion,
      "ALZHEIMER"
    );

    assert.equal(
      result.provider,
      "anchor"
    );

    assert.equal(
      semanticCalls,
      0
    );
  }
);

test(
  "petición insuficiente pregunta sin embedding",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;

            throw new Error(
              "No debería ejecutarse."
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Necesito ayuda para mi padre",
        conversationContext: null,
      });

    assert.equal(
      result.status,
      "needs_clarification"
    );

    assert.equal(
      result.tag,
      null
    );

    assert.equal(
      result.missingDimension,
      "need_type"
    );

    assert.equal(
      semanticCalls,
      0
    );
  }
);

test(
  "embedding claro produce resolved",
  async () => {
    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier:
          fakeSemanticClassifier(),
      });

    const result =
      await router.understand({
        inputMessage:
          "Necesito orientación social",
        conversationContext: null,
      });

    assert.equal(
      result.status,
      "resolved"
    );

    assert.equal(
      result.tag.descripcion,
      "BIENESTAR SOCIAL"
    );

    assert.equal(
      result.provider,
      "embedding"
    );
  }
);

test(
  "embedding ambiguo produce aclaración",
  async () => {
    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier:
          fakeSemanticClassifier({
            status:
              "needs_clarification",

            diagnostics: {
              top1: {
                tag: "ALZHEIMER",
                score: 0.61,
              },

              top2: {
                tag: "SALUD MENTAL",
                score: 0.60,
              },

              margin: 0.01,
            },
          }),
      });

    const result =
      await router.understand({
        inputMessage:
          "Mi tío está perdiendo la cabeza",
        conversationContext: null,
      });

    assert.equal(
      result.status,
      "needs_clarification"
    );

    assert.equal(
      result.tag,
      null
    );

    assert.equal(
      result.missingDimension,
      "symptom_domain"
    );

    assert.match(
      result.clarificationQuestion,
      /memoria|desorientación/i
    );
  }
);

test(
  "preserva Context V1 normalizado",
  async () => {
    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier:
          fakeSemanticClassifier(),
      });

    const result =
      await router.understand({
        inputMessage:
          "Necesito orientación social",

        conversationContext: {
          version: 999,

          subject: {
            relationship:
              " madre ",
          },

          activeNeeds: [
            " apoyo social ",
          ],
        },
      });

    assert.equal(
      result.context.version,
      1
    );

    assert.equal(
      result.context.subject.relationship,
      "madre"
    );

    assert.deepEqual(
      result.context.activeNeeds,
      ["apoyo social"]
    );
  }
);

test(
  "detecta dimensión cognitiva frente a salud mental",
  () => {
    assert.equal(
      deriveClarificationDimension({
        top1: {
          tag: "ALZHEIMER",
        },

        top2: {
          tag: "SALUD MENTAL",
        },
      }),
      "symptom_domain"
    );
  }
);

test(
  "varios anchors explícitos resuelven sin embedding",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;

            throw new Error(
              "No debería ejecutarse."
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "soy alcohólico y tengo depresión",
        conversationContext: null,
      });

    assert.equal(
      result.status,
      "resolved"
    );

    assert.equal(
      result.tag.descripcion,
      "ALCOHOLISMO"
    );

    assert.deepEqual(
      result.resolvedNeeds.map(
        (need) =>
          need.descripcion
      ),
      [
        "ALCOHOLISMO",
        "SALUD MENTAL",
      ]
    );

    assert.equal(
      result.provider,
      "anchor"
    );

    assert.equal(
      semanticCalls,
      0
    );
  }
);

test(
  "regresión exacta multi-need conserva alcohol trabajo y sueño sin semántica",
  async () => {
    const inputMessage =
      "no sé qué hacer con mi vida he perdido el trabajo.\n" +
      "tengo problemas de alcohol y no puedo dormir por las noches";

    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;

            throw new Error(
              "SEMANTIC_SHOULD_NOT_RUN"
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage,
        conversationContext: null,
      });

    assert.equal(
      result.status,
      "resolved"
    );

    assert.equal(
      result.tag?.descripcion,
      "ALCOHOLISMO"
    );

    assert.deepEqual(
      new Set(
        result.resolvedNeeds?.map(
          (need) =>
            need.descripcion
        )
      ),
      new Set([
        "ALCOHOLISMO",
        "SALUD MENTAL",
        "INSERCIÓN LABORAL",
      ])
    );

    assert.equal(
      result.provider,
      "anchor"
    );

    assert.equal(
      semanticCalls,
      0
    );
  }
);

test(
  "los starters genéricos piden aclaración sin usar embedding",
  async () => {
    let embeddingCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            embeddingCalls += 1;

            throw new Error(
              "embedding no debería ejecutarse",
            );
          },
        },
      });

    for (
      const inputMessage of [
        "Busco orientación social",
        "Necesito apoyo relacionado con una enfermedad",
      ]
    ) {
      const result =
        await router.understand({
          inputMessage,

          conversationContext: {
            version: 1,
            subject: {
              relationship: null,
            },
            activeNeeds: [],
            currentGoal: null,
            facts: [],
            constraints: [],
            territory: {
              province: "Gipuzkoa",
              municipality: null,
            },
            resourcesShown: [],
          },
        });

      assert.equal(
        result.status,
        "needs_clarification",
      );

      assert.equal(
        result.needsClarification,
        true,
      );

      assert.equal(
        result.provider,
        "rule",
      );

      assert.equal(
        result.model,
        "semantic-fast-gates-v1",
      );

      assert.equal(
        result.tag,
        null,
      );
    }

    assert.equal(
      embeddingCalls,
      0,
    );
  },
);

test(
  "una aclaración need_type expone quick replies sin llamar al embedding",
  async () => {
    let embeddingCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            embeddingCalls += 1;

            throw new Error(
              "embedding no debería ejecutarse",
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Busco orientación social",

        conversationContext: {
          version: 1,
          subject: {
            relationship: null,
          },
          activeNeeds: [],
          currentGoal: null,
          facts: [],
          constraints: [],
          territory: {
            province:
              "Gipuzkoa",
            municipality:
              null,
          },
          resourcesShown: [],
        },
      });

    assert.equal(
      result.status,
      "needs_clarification"
    );

    assert.equal(
      result.missingDimension,
      "need_type"
    );

    assert.deepEqual(
      result.quickReplies.map(
        (reply) =>
          reply.label
      ),
      [
        "Empleo",
        "Salud o enfermedad",
        "Salud emocional",
        "Alcohol u otras adicciones",
        "Otra situación",
      ]
    );

    assert.equal(
      embeddingCalls,
      0
    );
  }
);

test(
  "controlled employment resuelve sin embedding",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;
            throw new Error(
              "semantic classifier no debería ejecutarse",
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Necesito orientación sobre empleo",
        conversationContext: null,
        controlledReply: {
          type: "need_domain",
          value: "employment",
        },
      });

    assert.equal(
      result.status,
      "resolved",
    );

    assert.equal(
      result.tag.descripcion,
      "INSERCIÓN LABORAL",
    );

    assert.equal(
      result.provider,
      "controlled_reply",
    );

    assert.equal(
      result.model,
      "controlled-replies-v1",
    );

    assert.equal(
      semanticCalls,
      0,
    );
  },
);

test(
  "controlled health pide detalle sin embedding",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;
            throw new Error(
              "semantic classifier no debería ejecutarse",
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Necesito orientación sobre salud o una enfermedad",
        conversationContext: null,
        controlledReply: {
          type: "need_domain",
          value: "health",
        },
      });

    assert.equal(
      result.status,
      "needs_clarification",
    );

    assert.equal(
      result.missingDimension,
      "health_detail",
    );

    assert.match(
      result.clarificationQuestion,
      /enfermedad|problema de salud/i,
    );

    assert.equal(
      result.provider,
      "controlled_reply",
    );

    assert.equal(
      semanticCalls,
      0,
    );
  },
);

test(
  "controlled reply desconocida no puede forzar resolución",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;

            return {
              status:
                "needs_clarification",
              tag: null,
              context: {
                version: 1,
                subject: {
                  relationship: null,
                },
                activeNeeds: [],
                currentGoal: null,
                facts: [],
                constraints: [],
                territory: {
                  province: null,
                  municipality: null,
                },
                resourcesShown: [],
              },
              needsClarification:
                true,
              provider:
                "embedding",
              model:
                "fake-embedding",
              diagnostics: {
                top1: null,
                top2: null,
              },
            };
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "una frase libre no controlada",
        conversationContext: null,
        controlledReply: {
          type: "need_domain",
          value: "invented",
        },
      });

    assert.equal(
      semanticCalls,
      1,
    );

    assert.equal(
      result.status,
      "needs_clarification",
    );

    assert.equal(
      result.provider,
      "embedding",
    );
  },
);

test(
  "clarification graph avanza de need_type a salud emocional sin embedding",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;
            throw new Error(
              "semantic classifier no debería ejecutarse",
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Necesito orientación sobre salud emocional",
        conversationContext: null,
        controlledReply: {
          type:
            "clarification_choice",
          node:
            "need_type",
          choice:
            "emotional_health",
        },
      });

    assert.equal(
      result.status,
      "needs_clarification",
    );

    assert.equal(
      result.missingDimension,
      "mental_health_detail",
    );

    assert.equal(
      result.provider,
      "clarification_graph",
    );

    assert.deepEqual(
      result.quickReplies.map(
        (reply) =>
          reply.label,
      ),
      [
        "Ánimo o ansiedad",
        "Sueño",
        "Cambios de conducta",
        "Otra situación",
      ],
    );

    assert.equal(
      semanticCalls,
      0,
    );
  },
);

test(
  "clarification graph resuelve sueño dentro de salud emocional sin embedding",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;
            throw new Error(
              "semantic classifier no debería ejecutarse",
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Lo que más preocupa es el sueño",
        conversationContext: null,
        controlledReply: {
          type:
            "clarification_choice",
          node:
            "mental_health_detail",
          choice:
            "sleep",
        },
      });

    assert.equal(
      result.status,
      "resolved",
    );

    assert.equal(
      result.tag.descripcion,
      "SALUD MENTAL",
    );

    assert.equal(
      result.provider,
      "clarification_graph",
    );

    assert.deepEqual(
      result.resolvedNeeds,
      [
        {
          tag_id: 31,
          descripcion:
            "SALUD MENTAL",
          source:
            "clarification_graph",
        },
      ],
    );

    assert.equal(
      semanticCalls,
      0,
    );
  },
);

test(
  "clarification graph lleva cambios de conducta a una pregunta más específica",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;
            throw new Error(
              "semantic classifier no debería ejecutarse",
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Lo que más preocupa son los cambios de conducta",
        conversationContext: null,
        controlledReply: {
          type:
            "clarification_choice",
          node:
            "mental_health_detail",
          choice:
            "behavior_changes",
        },
      });

    assert.equal(
      result.status,
      "needs_clarification",
    );

    assert.equal(
      result.missingDimension,
      "mental_behavior_detail",
    );

    assert.match(
      result.clarificationQuestion,
      /cambios de conducta/i,
    );

    assert.equal(
      semanticCalls,
      0,
    );
  },
);

test(
  "una choice no puede reutilizarse en otro nodo para forzar resolución",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify({
            conversationContext,
          }) {
            semanticCalls += 1;

            return {
              status:
                "needs_clarification",
              tag: null,
              context:
                conversationContext,
              provider:
                "embedding",
              model:
                "fake-embedding",
              diagnostics: {
                top1: null,
                top2: null,
              },
            };
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Sueño",
        conversationContext: null,
        controlledReply: {
          type:
            "clarification_choice",
          node:
            "need_type",
          choice:
            "sleep",
        },
      });

    assert.equal(
      semanticCalls,
      1,
    );

    assert.equal(
      result.status,
      "needs_clarification",
    );

    assert.notEqual(
      result.provider,
      "clarification_graph",
    );
  },
);

test(
  "clarification graph exposes its canonical transition metadata",
  async () => {
    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            throw new Error(
              "semantic classifier no debería ejecutarse",
            );
          },
        },
      });

    const next =
      await router.understand({
        inputMessage:
          "Necesito orientación sobre salud emocional",
        conversationContext: null,
        controlledReply: {
          type:
            "clarification_choice",
          node:
            "need_type",
          choice:
            "emotional_health",
        },
      });

    assert.deepEqual(
      next.clarificationTransition,
      {
        sourceNode:
          "need_type",
        action: {
          type: "goto",
          node:
            "mental_health_detail",
        },
      },
    );

    const resolved =
      await router.understand({
        inputMessage:
          "Lo que más preocupa es el sueño",
        conversationContext: null,
        controlledReply: {
          type:
            "clarification_choice",
          node:
            "mental_health_detail",
          choice:
            "sleep",
        },
      });

    assert.equal(
      resolved
        .clarificationTransition
        .sourceNode,
      "mental_health_detail",
    );

    assert.equal(
      resolved
        .clarificationTransition
        .action
        .type,
      "resolve_need",
    );
  },
);

test(
  "a graph-backed clarification exposes pending clarification state",
  async () => {
    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            throw new Error(
              "embedding no debería ejecutarse para este starter",
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Necesito ayuda para un familiar",
        conversationContext: null,
      });

    assert.equal(
      result.status,
      "needs_clarification",
    );

    assert.deepEqual(
      result.clarificationState,
      {
        node: "need_type",
        mode: "choice",
      },
    );
  },
);

test(
  "free text can resolve a pending need_type choice without embedding",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;

            throw new Error(
              "embedding no debería ejecutarse",
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Es por su salud emocional",
        conversationContext: null,
        pendingClarification: {
          node: "need_type",
          personId: "person_1",
          mode: "choice",
        },
      });

    assert.equal(
      semanticCalls,
      0,
    );

    assert.equal(
      result.status,
      "needs_clarification",
    );

    assert.equal(
      result.provider,
      "clarification_text",
    );

    assert.deepEqual(
      result.clarificationTransition,
      {
        sourceNode:
          "need_type",
        action: {
          type: "goto",
          node:
            "mental_health_detail",
        },
      },
    );
  },
);

test(
  "free text can advance a pending emotional-health clarification",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;

            throw new Error(
              "embedding no debería ejecutarse",
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Ha cambiado mucho su comportamiento",
        conversationContext: null,
        pendingClarification: {
          node:
            "mental_health_detail",
          personId:
            "person_1",
          mode:
            "choice",
        },
      });

    assert.equal(
      semanticCalls,
      0,
    );

    assert.equal(
      result.status,
      "needs_clarification",
    );

    assert.equal(
      result.provider,
      "clarification_text",
    );

    assert.deepEqual(
      result.clarificationTransition,
      {
        sourceNode:
          "mental_health_detail",
        action: {
          type: "goto",
          node:
            "mental_behavior_detail",
        },
      },
    );
  },
);

test(
  "ambiguous pending text is not forced into a graph choice",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify({
            conversationContext,
          }) {
            semanticCalls += 1;

            return {
              status:
                "needs_clarification",
              tag: null,
              context:
                conversationContext,
              provider:
                "embedding",
              model:
                "fake",
              diagnostics: {
                top1: null,
                top2: null,
              },
            };
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Tiene ansiedad y tampoco consigue dormir",
        conversationContext: null,
        pendingClarification: {
          node:
            "mental_health_detail",
          personId:
            "person_1",
          mode:
            "choice",
        },
      });

    assert.equal(
      semanticCalls,
      1,
    );

    assert.notEqual(
      result.provider,
      "clarification_text",
    );
  },
);

test(
  "choice-less graph nodes expose free-text pending mode",
  async () => {
    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            throw new Error(
              "embedding no debería ejecutarse",
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Lo que más preocupa son los cambios de conducta",
        conversationContext: null,
        controlledReply: {
          type: "clarification_choice",
          node:
            "mental_health_detail",
          choice:
            "behavior_changes",
        },
      });

    assert.equal(
      result.status,
      "needs_clarification",
    );

    assert.deepEqual(
      result.clarificationState,
      {
        node:
          "mental_behavior_detail",
        mode:
          "free_text",
      },
    );
  },
);

test(
  "free text in pending addiction_detail advances inside the addiction branch",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;

            throw new Error(
              "global embedding should not run",
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "con otra conducta",
        conversationContext:
          null,
        pendingClarification: {
          node:
            "addiction_detail",
          personId:
            "self",
          mode:
            "choice",
        },
      });

    assert.equal(
      semanticCalls,
      0,
    );

    assert.equal(
      result.status,
      "needs_clarification",
    );

    assert.equal(
      result.provider,
      "clarification_text",
    );

    assert.equal(
      result.missingDimension,
      "addiction_behavior_detail",
    );

    assert.equal(
      result.clarificationState.node,
      "addiction_behavior_detail",
    );

    assert.equal(
      result.clarificationState.mode,
      "free_text",
    );

    assert.equal(
      result.clarificationTransition
        .action.type,
      "goto",
    );

    assert.equal(
      result.clarificationTransition
        .action.node,
      "addiction_behavior_detail",
    );
  },
);

test(
  "pending health_detail uses only its bounded semantic catalog",
  async () => {
    let semanticCalls = 0;
    let receivedAllowedTagIds = null;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify({
            conversationContext,
            allowedTagIds,
          }) {
            semanticCalls += 1;
            receivedAllowedTagIds =
              allowedTagIds;

            return {
              status:
                "resolved",
              tag: {
                tag_id: 13,
                descripcion:
                  "DIABETES",
              },
              context:
                conversationContext,
              needsClarification:
                false,
              provider:
                "embedding",
              model:
                "fake",
              diagnostics: {
                top1: {
                  tagId: 13,
                  tag:
                    "DIABETES",
                  score: 0.9,
                },
                top2: null,
                candidates: [
                  {
                    tagId: 13,
                    tag:
                      "DIABETES",
                    score: 0.9,
                  },
                ],
              },
            };
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Le han diagnosticado diabetes",
        conversationContext:
          null,
        pendingClarification: {
          node:
            "health_detail",
          personId:
            "self",
          mode:
            "free_text",
        },
      });

    assert.equal(
      semanticCalls,
      1,
    );

    assert.ok(
      receivedAllowedTagIds
        .includes(13),
    );

    assert.equal(
      receivedAllowedTagIds
        .includes(25),
      false,
    );

    assert.equal(
      receivedAllowedTagIds
        .includes(2),
      false,
    );

    assert.equal(
      result.status,
      "resolved",
    );

    assert.equal(
      result.tag.descripcion,
      "DIABETES",
    );

    assert.deepEqual(
      result.clarificationTransition,
      {
        sourceNode:
          "health_detail",
        action: {
          type:
            "resolve_need",
          resolvedNeeds: [
            {
              tag_id: 13,
              descripcion:
                "DIABETES",
            },
          ],
        },
      },
    );
  },
);

test(
  "pending health_detail cannot escape to a global alcohol anchor",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify({
            conversationContext,
            allowedTagIds,
          }) {
            semanticCalls += 1;

            assert.equal(
              allowedTagIds
                .includes(2),
              false,
            );

            return {
              status:
                "needs_clarification",
              tag: null,
              context:
                conversationContext,
              needsClarification:
                true,
              provider:
                "embedding",
              model:
                "fake",
              diagnostics: {
                top1: null,
                top2: null,
                candidates: [],
              },
            };
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Es por alcohol",
        conversationContext:
          null,
        pendingClarification: {
          node:
            "health_detail",
          personId:
            "self",
          mode:
            "free_text",
        },
      });

    assert.equal(
      semanticCalls,
      1,
    );

    assert.equal(
      result.status,
      "needs_clarification",
    );

    assert.equal(
      result.tag,
      null,
    );

    assert.equal(
      result.missingDimension,
      "health_detail",
    );

    assert.notEqual(
      result.provider,
      "anchor",
    );
  },
);

test(
  "pending behavioral addiction with no catalog does not call semantic classification",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;

            throw new Error(
              "semantic classification should not run",
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "No puede dejar las apuestas online",
        conversationContext:
          null,
        pendingClarification: {
          node:
            "addiction_behavior_detail",
          personId:
            "person_1",
          mode:
            "free_text",
        },
      });

    assert.equal(
      semanticCalls,
      0,
    );

    assert.equal(
      result.status,
      "needs_clarification",
    );

    assert.equal(
      result.tag,
      null,
    );

    assert.equal(
      result.provider,
      "open_clarification_policy",
    );

    assert.equal(
      result.missingDimension,
      "addiction_behavior_detail",
    );

    assert.equal(
      result.diagnostics.reason,
      "no_operational_catalog",
    );

    assert.deepEqual(
      result.diagnostics
        .allowedTagIds,
      [],
    );
  },
);

test(
  "pending substance addiction with no catalog cannot fall through to alcohol",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;

            throw new Error(
              "semantic classification should not run",
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Consume cocaína",
        conversationContext:
          null,
        pendingClarification: {
          node:
            "addiction_substance_detail",
          personId:
            "self",
          mode:
            "free_text",
        },
      });

    assert.equal(
      semanticCalls,
      0,
    );

    assert.equal(
      result.status,
      "needs_clarification",
    );

    assert.equal(
      result.tag,
      null,
    );

    assert.equal(
      result.provider,
      "open_clarification_policy",
    );

    assert.equal(
      result.missingDimension,
      "addiction_substance_detail",
    );

    assert.equal(
      result.diagnostics.reason,
      "no_operational_catalog",
    );
  },
);

test(
  "necesito orientación pide need_type sin embedding",
  async () => {
    let semanticCalls = 0;

    const router =
      createHelpchatUnderstandingRouter({
        semanticClassifier: {
          async classify() {
            semanticCalls += 1;

            throw new Error(
              "embedding no debería ejecutarse",
            );
          },
        },
      });

    const result =
      await router.understand({
        inputMessage:
          "Necesito orientación",
        conversationContext:
          null,
      });

    assert.equal(
      semanticCalls,
      0,
    );

    assert.equal(
      result.status,
      "needs_clarification",
    );

    assert.equal(
      result.tag,
      null,
    );

    assert.equal(
      result.provider,
      "rule",
    );

    assert.equal(
      result.missingDimension,
      "need_type",
    );
  },
);
