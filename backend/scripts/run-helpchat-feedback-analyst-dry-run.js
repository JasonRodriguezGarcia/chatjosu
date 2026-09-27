import pool from "../db-pg.js";

import {
  createTesterFeedbackAnalysisRepositoryV1,
} from "../helpchat/tester-feedback-analysis-repository-v1.js";

import {
  buildTesterFeedbackAnalysisV1,
} from "../helpchat/tester-feedback-analysis-v1.js";

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

function feedbackIdFromArgv() {
  const direct =
    process.argv
      .slice(2)
      .find(
        (value) =>
          /^\d+$/.test(value),
      );

  if (!direct) {
    throw new Error(
      "Uso: node scripts/run-helpchat-feedback-analyst-dry-run.js <feedback_id>",
    );
  }

  return Number(
    direct,
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

const feedbackId =
  feedbackIdFromArgv();

const repository =
  createTesterFeedbackAnalysisRepositoryV1({
    pool,
    schemaName,
  });

const analyst =
  createHelpchatFeedbackAnalystLlmService({
    baseUrl,
    model,
    timeoutMs,
    numPredict,
    keepAlive,
  });

try {
  console.log(
    "===== FEEDBACK ANALYST DRY RUN =====",
  );

  console.log({
    feedbackId,
    schemaName,
    baseUrl,
    model,
    timeoutMs,
    numPredict,
    keepAlive,
  });

  const snapshot =
    await repository
      .loadFeedbackSnapshot(
        feedbackId,
      );

  if (!snapshot) {
    throw new Error(
      `Feedback ${feedbackId} no encontrado.`,
    );
  }

  console.log(
    "\n===== SNAPSHOT =====",
  );

  console.log(
    JSON.stringify(
      snapshot,
      null,
      2,
    ),
  );

  console.log(
    "\n===== CALLING ANALYST =====",
  );

  const llmResult =
    await analyst.analyze({
      snapshot,
    });

  console.log(
    "\n===== RAW ANALYST OUTPUT =====",
  );

  console.log(
    JSON.stringify(
      llmResult.analysis,
      null,
      2,
    ),
  );

  let normalized;

  try {
    normalized =
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
  } catch (error) {
    console.error(
      "\n===== CONTRACT VALIDATION FAILED =====",
    );

    console.error(
      error,
    );

    process.exitCode =
      2;

    throw error;
  }

  console.log(
    "\n===== NORMALIZED ANALYSIS =====",
  );

  console.log(
    JSON.stringify(
      normalized,
      null,
      2,
    ),
  );

  console.log(
    "\n===== METRICS =====",
  );

  console.log({
    provider:
      llmResult.provider,
    model:
      llmResult.model,
    durationMs:
      llmResult.durationMs,
    inputChars:
      llmResult.inputChars,
  });

  console.log(
    "\nDRY_RUN_ONLY=YES",
  );

  console.log(
    "DATABASE_ANALYSIS_UPDATED=NO",
  );
} finally {
  await pool.end();
}
