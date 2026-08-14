import {
  buildTesterFeedbackAnalysisV1,
} from "./tester-feedback-analysis-v1.js";

const TERMINAL_ANALYSIS_STATUSES =
  new Set([
    "analyzed",
    "insufficient_evidence",
    "invalid_scope",
  ]);

function retryDelaySeconds(
  attempts,
) {
  return Math.min(
    300,
    15 * (2 ** Math.max(
      0,
      attempts - 1,
    )),
  );
}

export function createTesterFeedbackAnalysisWorkerV1({
  repository,
  analystLlmService,
  maxAttempts = 3,
} = {}) {
  if (
    !repository ||
    typeof repository.claimNext !==
      "function" ||
    typeof repository.loadFeedbackSnapshot !==
      "function" ||
    typeof repository.complete !==
      "function" ||
    typeof repository.releaseForRetry !==
      "function" ||
    typeof repository.fail !==
      "function"
  ) {
    throw new Error(
      "repository no válido."
    );
  }

  if (
    !analystLlmService ||
    typeof analystLlmService.analyze !==
      "function"
  ) {
    throw new Error(
      "analystLlmService no válido."
    );
  }

  async function processNext() {
    const job =
      await repository
        .claimNext();

    if (!job) {
      return {
        status:
          "idle",
      };
    }

    const feedbackId =
      Number(
        job.feedback_id,
      );

    try {
      const snapshot =
        await repository
          .loadFeedbackSnapshot(
            feedbackId,
          );

      if (!snapshot) {
        await repository.fail({
          feedbackId,
          errorMessage:
            "FEEDBACK_SNAPSHOT_NOT_FOUND",
        });

        return {
          status:
            "failed",
          feedbackId,
          error:
            "FEEDBACK_SNAPSHOT_NOT_FOUND",
        };
      }

      const llmResult =
        await analystLlmService
          .analyze({
            snapshot,
          });

      const normalized =
        buildTesterFeedbackAnalysisV1({
          ...llmResult.analysis,

          model: {
            provider:
              llmResult.provider,
            name:
              llmResult.model,
            latencyMs:
              llmResult.durationMs,
          },
        });

      if (
        !TERMINAL_ANALYSIS_STATUSES.has(
          normalized.status,
        )
      ) {
        const error =
          new Error(
            "ANALYST_INVALID_TERMINAL_STATUS"
          );

        error.code =
          "ANALYST_INVALID_TERMINAL_STATUS";

        throw error;
      }

      const persisted =
        await repository.complete({
          feedbackId,
          status:
            normalized.status,
          provider:
            llmResult.provider,
          model:
            llmResult.model,
          analysis:
            normalized,
        });

      if (!persisted) {
        throw new Error(
          "ANALYST_JOB_STATE_CONFLICT"
        );
      }

      return {
        status:
          normalized.status,
        feedbackId,
        analysis:
          normalized,
      };
    } catch (error) {
      const attempts =
        Number(
          job.attempts,
        ) || 1;

      const errorMessage =
        error?.code ||
        error?.message ||
        "FEEDBACK_ANALYST_UNKNOWN_ERROR";

      if (
        attempts >=
        maxAttempts
      ) {
        await repository.fail({
          feedbackId,
          errorMessage,
        });

        return {
          status:
            "failed",
          feedbackId,
          error:
            errorMessage,
        };
      }

      await repository
        .releaseForRetry({
          feedbackId,
          errorMessage,
          retryDelaySeconds:
            retryDelaySeconds(
              attempts,
            ),
        });

      return {
        status:
          "retry",
        feedbackId,
        error:
          errorMessage,
      };
    }
  }

  return {
    processNext,
  };
}
