import test from "node:test";
import assert from "node:assert/strict";

import {
  createEmptyConversationContextV1,
  normalizeConversationContextV1,
} from "../helpchat/conversation-context-v1.js";

import {
  cosineSimilarity,
  createHelpchatSemanticClassifier,
} from "../services/helpchat-semantic-classifier.js";

test(
  "normaliza Conversation Context V1",
  () => {
    const context =
      normalizeConversationContextV1({
        version: 999,
        subject: {
          relationship: " madre ",
        },
        activeNeeds: [
          " Alzheimer ",
          "Alzheimer",
        ],
        facts: [
          "vive sola",
        ],
        territory: {
          province: " Burgos ",
        },
      });

    assert.equal(
      context.version,
      1
    );

    assert.equal(
      context.subject.relationship,
      "madre"
    );

    assert.deepEqual(
      context.activeNeeds,
      ["Alzheimer"]
    );

    assert.deepEqual(
      context.facts,
      ["vive sola"]
    );

    assert.equal(
      context.territory.province,
      "Burgos"
    );
  }
);

test(
  "crea Context V1 vacío",
  () => {
    assert.deepEqual(
      createEmptyConversationContextV1(),
      {
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
      }
    );
  }
);

test(
  "cosineSimilarity distingue vectores",
  () => {
    assert.equal(
      cosineSimilarity(
        [1, 0],
        [1, 0]
      ),
      1
    );

    assert.equal(
      cosineSimilarity(
        [1, 0],
        [0, 1]
      ),
      0
    );
  }
);

test(
  "resolved cuando score y margin son suficientes",
  async () => {
    const vectors = new Map([
      ["proto-a", [1, 0]],
      ["proto-b", [0, 1]],
      ["Mensaje actual: consulta", [0.99, 0.01]],
    ]);

    const embeddingService = {
      model: "fake",
      async embed(input) {
        const values =
          Array.isArray(input)
            ? input
            : [input];

        return {
          vectors:
            values.map(
              (value) =>
                vectors.get(value)
            ),
        };
      },
    };

    const classifier =
      createHelpchatSemanticClassifier({
        embeddingService,
        minimumScore: 0.6,
        minimumMargin: 0.05,
        prototypes: [
          {
            tagId: 1,
            tag: "A",
            text: "proto-a",
          },
          {
            tagId: 2,
            tag: "B",
            text: "proto-b",
          },
        ],
      });

    const result =
      await classifier.classify({
        inputMessage: "consulta",
        conversationContext: null,
      });

    assert.equal(
      result.status,
      "resolved"
    );

    assert.equal(
      result.tag.descripcion,
      "A"
    );

    assert.equal(
      result.needsClarification,
      false
    );
  }
);

test(
  "needs_clarification cuando el margen es insuficiente",
  async () => {
    const embeddingService = {
      model: "fake",
      async embed(input) {
        if (Array.isArray(input)) {
          return {
            vectors: [
              [1, 0],
              [0.99, 0.01],
            ],
          };
        }

        return {
          vectors: [
            [1, 0],
          ],
        };
      },
    };

    const classifier =
      createHelpchatSemanticClassifier({
        embeddingService,
        minimumScore: 0.6,
        minimumMargin: 0.05,
        prototypes: [
          {
            tagId: 1,
            tag: "A",
            text: "x",
          },
          {
            tagId: 2,
            tag: "B",
            text: "y",
          },
        ],
      });

    const result =
      await classifier.classify({
        inputMessage: "ambiguo",
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
      result.needsClarification,
      true
    );

    assert.equal(
      result.context.version,
      1
    );
  }
);

test(
  "devuelve shortlist semántico ordenado y acotado",
  async () => {
    const embeddingService = {
      model: "test-embedding",

      async embed(input) {
        if (Array.isArray(input)) {
          return {
            vectors:
              input.map(
                (_, index) => [
                  index === 0
                    ? 1
                    : 0.9 -
                      index * 0.01,

                  index === 0
                    ? 0
                    : 0.1 +
                      index * 0.01,
                ]
              ),
          };
        }

        return {
          vectors: [
            [1, 0],
          ],
        };
      },
    };

    const classifier =
      createHelpchatSemanticClassifier({
        embeddingService,
        minimumScore: 0,
        minimumMargin: 0,

        prototypes: [
          {
            tagId: 1,
            tag: "UNO",
            text: "uno",
          },
          {
            tagId: 2,
            tag: "DOS",
            text: "dos",
          },
          {
            tagId: 3,
            tag: "TRES",
            text: "tres",
          },
          {
            tagId: 4,
            tag: "CUATRO",
            text: "cuatro",
          },
          {
            tagId: 5,
            tag: "CINCO",
            text: "cinco",
          },
          {
            tagId: 6,
            tag: "SEIS",
            text: "seis",
          },
        ],
      });

    const result =
      await classifier.classify({
        inputMessage:
          "mensaje de prueba",

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
            province: null,
            municipality: null,
          },

          resourcesShown: [],
        },
      });

    assert.equal(
      result.diagnostics
        .candidates.length,
      5
    );

    assert.deepEqual(
      result.diagnostics
        .candidates[0],
      result.diagnostics.top1
    );

    assert.deepEqual(
      result.diagnostics
        .candidates[1],
      result.diagnostics.top2
    );

    assert.equal(
      result.diagnostics
        .candidates.some(
          (candidate) =>
            candidate.tag ===
            "SEIS"
        ),
      false
    );

    for (
      const candidate
      of result.diagnostics
        .candidates
    ) {
      assert.deepEqual(
        Object.keys(candidate)
          .sort(),
        [
          "score",
          "tag",
          "tagId",
        ]
      );
    }
  }
);

test(
  "warmup can use a larger timeout without changing normal classification",
  async () => {
    const calls = [];

    const embeddingService = {
      model: "fake-embedding",

      async embed(
        input,
        options,
      ) {
        calls.push({
          input,
          options,
        });

        const count =
          Array.isArray(input)
            ? input.length
            : 1;

        return {
          vectors:
            Array.from(
              {
                length: count,
              },
              () => [
                1,
                0,
              ],
            ),
        };
      },
    };

    const classifier =
      createHelpchatSemanticClassifier({
        embeddingService,
        prototypes: [
          {
            tagId: 1,
            tag: "UNO",
            text: "uno",
          },
          {
            tagId: 2,
            tag: "DOS",
            text: "dos",
          },
        ],
      });

    await classifier.warmup({
      timeoutMs: 15000,
    });

    assert.equal(
      calls.length,
      1,
    );

    assert.deepEqual(
      calls[0].options,
      {
        timeoutMs: 15000,
      },
    );

    await classifier.classify({
      inputMessage: "uno",
      conversationContext: null,
    });

    assert.equal(
      calls.length,
      2,
    );

    assert.equal(
      calls[1].options,
      undefined,
    );
  },
);
