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
    maxAttempts: 3,
  });

try {
  const requeued =
    await repository.requeueStale({
      staleAfterSeconds: 300,
    });

  console.log(
    "STALE_REQUEUED=",
    requeued.length,
  );

  const result =
    await worker.processNext();

  console.log(
    "===== WORKER RESULT =====",
  );

  console.log(
    JSON.stringify(
      result,
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
