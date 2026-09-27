import pool from "../db-pg.js";

import {
  createTesterFeedbackAnalysisRepositoryV1,
} from "../helpchat/tester-feedback-analysis-repository-v1.js";

import {
  createTesterFeedbackAnalysisWorkerV1,
} from "../helpchat/tester-feedback-analysis-worker-v1.js";

import {
  createHelpchatFeedbackAnalystLlmService,
} from "../services/helpchat-feedback-analyst-llm-service.js";

function positiveInteger(
  value,
  fallback,
) {
  const parsed =
    Number.parseInt(
      String(value ?? ""),
      10,
    );

  return (
    Number.isInteger(parsed) &&
    parsed > 0
  )
    ? parsed
    : fallback;
}

function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms,
      ),
  );
}

const schemaName =
  process.env.SCHEMA_NAME?.trim() ||
  "copilot_ong";

const baseUrl =
  process.env
    .HELPCHAT_FEEDBACK_ANALYST_BASE_URL
    ?.trim() ||
  process.env
    .HELPCHAT_EMBEDDING_BASE_URL
    ?.trim() ||
  "http://127.0.0.1:11434";

const model =
  process.env
    .HELPCHAT_FEEDBACK_ANALYST_MODEL
    ?.trim() ||
  process.env
    .HELPCHAT_LOCAL_LLM_MODEL
    ?.trim() ||
  "qwen3:8b";

const timeoutMs =
  positiveInteger(
    process.env
      .HELPCHAT_FEEDBACK_ANALYST_TIMEOUT_MS,
    120000,
  );

const numPredict =
  positiveInteger(
    process.env
      .HELPCHAT_FEEDBACK_ANALYST_NUM_PREDICT,
    2048,
  );

const keepAlive =
  process.env
    .HELPCHAT_FEEDBACK_ANALYST_KEEP_ALIVE
    ?.trim() ||
  process.env
    .HELPCHAT_LOCAL_LLM_KEEP_ALIVE
    ?.trim() ||
  "30m";

const idlePollMs =
  positiveInteger(
    process.env
      .HELPCHAT_FEEDBACK_ANALYST_POLL_MS,
    5000,
  );

const staleAfterSeconds =
  positiveInteger(
    process.env
      .HELPCHAT_FEEDBACK_ANALYST_STALE_SECONDS,
    300,
  );

const maxAttempts =
  positiveInteger(
    process.env
      .HELPCHAT_FEEDBACK_ANALYST_MAX_ATTEMPTS,
    3,
  );

const exitWhenIdle =
  process.env
    .HELPCHAT_FEEDBACK_ANALYST_EXIT_WHEN_IDLE ===
  "1";

const repository =
  createTesterFeedbackAnalysisRepositoryV1({
    pool,
    schemaName,
  });

const analystLlmService =
  createHelpchatFeedbackAnalystLlmService({
    baseUrl,
    model,
    timeoutMs,
    numPredict,
    keepAlive,
  });

const worker =
  createTesterFeedbackAnalysisWorkerV1({
    repository,
    analystLlmService,
    maxAttempts,
  });

let stopping =
  false;

function requestStop(signal) {
  console.log(
    `Feedback Analyst recibió ${signal}.`
  );

  stopping =
    true;
}

process.on(
  "SIGTERM",
  () =>
    requestStop(
      "SIGTERM",
    ),
);

process.on(
  "SIGINT",
  () =>
    requestStop(
      "SIGINT",
    ),
);

console.log(
  "Feedback Analyst worker iniciado.",
  {
    schemaName,
    model,
    idlePollMs,
    staleAfterSeconds,
    maxAttempts,
    exitWhenIdle,
  },
);

try {
  while (!stopping) {
    try {
      const requeued =
        await repository
          .requeueStale({
            staleAfterSeconds,
          });

      if (
        requeued.length > 0
      ) {
        console.warn(
          "Feedback Analyst recuperó trabajos atascados.",
          {
            feedbackIds:
              requeued.map(
                (row) =>
                  Number(
                    row.feedback_id,
                  ),
              ),
          },
        );
      }

      const result =
        await worker
          .processNext();

      if (
        result.status ===
        "idle"
      ) {
        if (exitWhenIdle) {
          console.log(
            "Feedback Analyst cola vacía."
          );

          break;
        }

        await sleep(
          idlePollMs,
        );

        continue;
      }

      console.log(
        "Feedback Analyst trabajo terminado.",
        {
          feedbackId:
            result.feedbackId,
          status:
            result.status,
          error:
            result.error ||
            null,
        },
      );
    } catch (error) {
      console.error(
        "Feedback Analyst worker error.",
        {
          code:
            error?.code ||
            null,
          message:
            error?.message ||
            String(error),
        },
      );

      await sleep(
        idlePollMs,
      );
    }
  }
} finally {
  await pool.end();

  console.log(
    "Feedback Analyst worker detenido."
  );
}
