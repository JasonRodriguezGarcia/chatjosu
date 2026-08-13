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
        "Vivienda",
        "Empleo",
        "Salud",
        "Cuidados",
        "Otra situación",
      ]
    );

    assert.equal(
      embeddingCalls,
      0
    );
  }
);
