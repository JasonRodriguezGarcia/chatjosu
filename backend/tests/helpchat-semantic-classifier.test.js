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
