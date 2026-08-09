import {
  HELPCHAT_SEMANTIC_PROTOTYPES,
} from "../helpchat/semantic-prototypes.js";

import {
  buildSemanticTurnInput,
  normalizeConversationContextV1,
} from "../helpchat/conversation-context-v1.js";

function cosineSimilarity(a, b) {
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length !== b.length ||
    a.length === 0
  ) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    const av = Number(a[index]) || 0;
    const bv = Number(b[index]) || 0;

    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (!normA || !normB) {
    return 0;
  }

  return dot / (
    Math.sqrt(normA) *
    Math.sqrt(normB)
  );
}

function topCandidates(
  vector,
  prototypeVectors
) {
  return prototypeVectors
    .map((entry) => ({
      tagId: entry.tagId,
      tag: entry.tag,
      score: cosineSimilarity(
        vector,
        entry.vector
      ),
    }))
    .sort(
      (a, b) => b.score - a.score
    );
}

export function createHelpchatSemanticClassifier({
  embeddingService,
  minimumScore = 0.62,
  minimumMargin = 0.05,
  prototypes =
    HELPCHAT_SEMANTIC_PROTOTYPES,
} = {}) {
  if (!embeddingService?.embed) {
    throw new Error(
      "embeddingService es obligatorio."
    );
  }

  let prototypePromise = null;

  async function loadPrototypeVectors() {
    if (!prototypePromise) {
      prototypePromise = (
        async () => {
          const result =
            await embeddingService.embed(
              prototypes.map(
                (entry) => entry.text
              )
            );

          if (
            result.vectors.length !==
            prototypes.length
          ) {
            throw new Error(
              "Número inesperado de embeddings de prototipos."
            );
          }

          return prototypes.map(
            (entry, index) => ({
              ...entry,
              vector:
                result.vectors[index],
            })
          );
        }
      )().catch((error) => {
        prototypePromise = null;
        throw error;
      });
    }

    return prototypePromise;
  }

  async function classify({
    inputMessage,
    conversationContext,
  }) {
    const startedAt =
      performance.now();

    const context =
      normalizeConversationContextV1(
        conversationContext
      );

    const semanticInput =
      buildSemanticTurnInput({
        inputMessage,
        conversationContext: context,
      });

    const [
      prototypeVectors,
      queryResult,
    ] = await Promise.all([
      loadPrototypeVectors(),
      embeddingService.embed(
        semanticInput
      ),
    ]);

    const queryVector =
      queryResult.vectors[0];

    const candidates =
      topCandidates(
        queryVector,
        prototypeVectors
      );

    const top1 =
      candidates[0] || null;

    const top2 =
      candidates[1] || null;

    const margin =
      top1 && top2
        ? top1.score - top2.score
        : 0;

    const resolved =
      Boolean(top1) &&
      top1.score >= minimumScore &&
      margin >= minimumMargin;

    return {
      status:
        resolved
          ? "resolved"
          : "needs_clarification",

      tag:
        resolved
          ? {
              tag_id: top1.tagId,
              descripcion: top1.tag,
            }
          : null,

      context,

      needsClarification:
        !resolved,

      clarificationQuestion:
        resolved
          ? null
          : (
              "¿Puedes contarme un poco más " +
              "sobre qué le ocurre o qué tipo " +
              "de ayuda necesitáis?"
            ),

      provider: "embedding",
      model: embeddingService.model,

      diagnostics: {
        top1,
        top2,
        margin,
        minimumScore,
        minimumMargin,
      },

      durationMs:
        Math.round(
          (
            performance.now() -
            startedAt
          ) * 10
        ) / 10,
    };
  }

  return {
    classify,
    warmup: loadPrototypeVectors,
  };
}

export {
  cosineSimilarity,
};
