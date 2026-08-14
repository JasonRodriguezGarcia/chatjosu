import test from "node:test";
import assert from "node:assert/strict";

import {
  createTesterFeedbackAnalysisWorkerV1,
} from "../helpchat/tester-feedback-analysis-worker-v1.js";

function validAnalysis() {
  return {
    status:
      "analyzed",
    category:
      "repeated_question",
    confidence:
      0.95,
    summary:
      "Existe un bucle.",
    suspectedInvariants: [
      "conversation_must_progress",
    ],
    suspectedComponents: [
      "health-statement-authority-v1",
    ],
    evidenceTurnIds: [
      "turn-4",
    ],
    observedSoftwareBehavior:
      "Repite la pregunta.",
    expectedSoftwareBehavior:
      "Debe avanzar.",
    additionalFindings: [],
    regressionCandidate: {
      recommended: true,
      fixtureType:
        "multi_turn",
    },
    solutionProposal: {
      summary:
        "Corregir transición.",
      filesLikelyAffected: [],
      risks: [],
    },
  };
}

test(
  "devuelve idle cuando no hay feedback pendiente",
  async () => {
    const worker =
      createTesterFeedbackAnalysisWorkerV1({
        repository: {
          async claimNext() {
            return null;
          },
          loadFeedbackSnapshot() {},
          complete() {},
          releaseForRetry() {},
          fail() {},
        },
        analystLlmService: {
          analyze() {},
        },
      });

    assert.deepEqual(
      await worker.processNext(),
      {
        status:
          "idle",
      },
    );
  },
);

test(
  "analiza y persiste un feedback correctamente",
  async () => {
    let completed =
      null;

    const worker =
      createTesterFeedbackAnalysisWorkerV1({
        repository: {
          async claimNext() {
            return {
              feedback_id: 6,
              attempts: 1,
            };
          },

          async loadFeedbackSnapshot() {
            return {
              feedback: {
                feedback_id: 6,
              },
              turns: [],
            };
          },

          async complete(
            payload,
          ) {
            completed =
              payload;

            return {
              feedback_id: 6,
              status:
                payload.status,
            };
          },

          releaseForRetry() {
            throw new Error(
              "unexpected retry"
            );
          },

          fail() {
            throw new Error(
              "unexpected fail"
            );
          },
        },

        analystLlmService: {
          async analyze() {
            return {
              analysis:
                validAnalysis(),
              provider:
                "ollama",
              model:
                "qwen3:8b",
              durationMs:
                9000,
            };
          },
        },
      });

    const result =
      await worker.processNext();

    assert.equal(
      result.status,
      "analyzed",
    );

    assert.equal(
      completed.feedbackId,
      6,
    );

    assert.equal(
      completed.provider,
      "ollama",
    );

    assert.equal(
      completed.analysis
        .category,
      "repeated_question",
    );
  },
);

test(
  "fallo técnico reintenta antes del máximo",
  async () => {
    let retry =
      null;

    const worker =
      createTesterFeedbackAnalysisWorkerV1({
        repository: {
          async claimNext() {
            return {
              feedback_id: 6,
              attempts: 1,
            };
          },

          async loadFeedbackSnapshot() {
            return {
              feedback: {},
              turns: [],
            };
          },

          complete() {},

          async releaseForRetry(
            payload,
          ) {
            retry =
              payload;
          },

          fail() {
            throw new Error(
              "unexpected fail"
            );
          },
        },

        analystLlmService: {
          async analyze() {
            const error =
              new Error(
                "timeout"
              );

            error.code =
              "FEEDBACK_ANALYST_TIMEOUT";

            throw error;
          },
        },
      });

    const result =
      await worker.processNext();

    assert.equal(
      result.status,
      "retry",
    );

    assert.equal(
      retry.errorMessage,
      "FEEDBACK_ANALYST_TIMEOUT",
    );

    assert.equal(
      retry.retryDelaySeconds,
      15,
    );
  },
);

test(
  "fallo terminal después del máximo de intentos",
  async () => {
    let failed =
      null;

    const worker =
      createTesterFeedbackAnalysisWorkerV1({
        maxAttempts: 3,

        repository: {
          async claimNext() {
            return {
              feedback_id: 6,
              attempts: 3,
            };
          },

          async loadFeedbackSnapshot() {
            return {
              feedback: {},
              turns: [],
            };
          },

          complete() {},
          releaseForRetry() {},

          async fail(
            payload,
          ) {
            failed =
              payload;
          },
        },

        analystLlmService: {
          async analyze() {
            throw new Error(
              "LLM unavailable"
            );
          },
        },
      });

    const result =
      await worker.processNext();

    assert.equal(
      result.status,
      "failed",
    );

    assert.equal(
      failed.feedbackId,
      6,
    );
  },
);
