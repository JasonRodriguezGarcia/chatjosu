import test from "node:test";
import assert from "node:assert/strict";

import {
  createTesterFeedbackAnalysisRepositoryV1,
} from "../helpchat/tester-feedback-analysis-repository-v1.js";

function createPool(handler) {
  return {
    async query(sql, params) {
      return handler(
        String(sql),
        params,
      );
    },
  };
}

test(
  "rechaza pool ausente y schema inseguro",
  () => {
    assert.throws(
      () =>
        createTesterFeedbackAnalysisRepositoryV1(),
      /pool/,
    );

    assert.throws(
      () =>
        createTesterFeedbackAnalysisRepositoryV1({
          pool: {
            query() {},
          },
          schemaName:
            "copilot_ong; DROP TABLE x",
        }),
      /schemaName/,
    );
  },
);

test(
  "claimNext reclama atómicamente un feedback pendiente",
  async () => {
    let seenSql = "";

    const repository =
      createTesterFeedbackAnalysisRepositoryV1({
        pool:
          createPool(
            async (sql) => {
              seenSql = sql;

              return {
                rows: [
                  {
                    feedback_id: 6,
                    status:
                      "analyzing",
                    attempts: 1,
                  },
                ],
              };
            },
          ),
      });

    const result =
      await repository.claimNext();

    assert.equal(
      result.feedback_id,
      6,
    );

    assert.equal(
      result.status,
      "analyzing",
    );

    assert.match(
      seenSql,
      /FOR UPDATE SKIP LOCKED/,
    );

    assert.match(
      seenSql,
      /attempts = analysis\.attempts \+ 1/,
    );
  },
);

test(
  "claimNext devuelve null si no hay trabajo",
  async () => {
    const repository =
      createTesterFeedbackAnalysisRepositoryV1({
        pool:
          createPool(
            async () => ({
              rows: [],
            }),
          ),
      });

    assert.equal(
      await repository.claimNext(),
      null,
    );
  },
);

test(
  "loadFeedbackSnapshot reconstruye solo hasta snapshotThroughTurnId",
  async () => {
    let call = 0;

    const repository =
      createTesterFeedbackAnalysisRepositoryV1({
        pool:
          createPool(
            async (
              sql,
              params,
            ) => {
              call += 1;

              if (call === 1) {
                assert.deepEqual(
                  params,
                  [6],
                );

                return {
                  rows: [
                    {
                      feedback_id: 6,
                      session_id:
                        "session-1",
                      snapshot_through_turn_id:
                        "turn-4",
                      category:
                        "other",
                      reason_text:
                        "Ha repetido la pregunta.",
                    },
                  ],
                };
              }

              assert.match(
                sql,
                /t\.sequence <= snapshot\.sequence/,
              );

              assert.deepEqual(
                params,
                [
                  "session-1",
                  "turn-4",
                ],
              );

              return {
                rows: [
                  {
                    turn_id:
                      "turn-1",
                    sequence: 1,
                  },
                  {
                    turn_id:
                      "turn-4",
                    sequence: 4,
                  },
                ],
              };
            },
          ),
      });

    const result =
      await repository
        .loadFeedbackSnapshot(6);

    assert.equal(
      result.feedback.feedback_id,
      6,
    );

    assert.equal(
      result.turns.length,
      2,
    );
  },
);

test(
  "complete persiste análisis únicamente desde analyzing",
  async () => {
    const calls = [];

    const repository =
      createTesterFeedbackAnalysisRepositoryV1({
        pool:
          createPool(
            async (
              sql,
              params,
            ) => {
              calls.push({
                sql,
                params,
              });

              return {
                rows: [
                  {
                    feedback_id: 6,
                    status:
                      "analyzed",
                    analysis:
                      params[4],
                  },
                ],
              };
            },
          ),
      });

    const result =
      await repository.complete({
        feedbackId: 6,
        provider:
          "local",
        model:
          "qwen3:8b",
        analysis: {
          version: 1,
          category:
            "repeated_question",
        },
      });

    assert.equal(
      result.status,
      "analyzed",
    );

    assert.match(
      calls[0].sql,
      /status = 'analyzing'/,
    );

    assert.equal(
      calls[0].params[0],
      6,
    );
  },
);

test(
  "releaseForRetry devuelve el trabajo a pending",
  async () => {
    const repository =
      createTesterFeedbackAnalysisRepositoryV1({
        pool:
          createPool(
            async (
              sql,
              params,
            ) => {
              assert.match(
                sql,
                /status = 'pending'/,
              );

              assert.deepEqual(
                params,
                [
                  6,
                  30,
                  "OLLAMA_TIMEOUT",
                ],
              );

              return {
                rows: [
                  {
                    feedback_id: 6,
                    status:
                      "pending",
                  },
                ],
              };
            },
          ),
      });

    const result =
      await repository
        .releaseForRetry({
          feedbackId: 6,
          errorMessage:
            "OLLAMA_TIMEOUT",
        });

    assert.equal(
      result.status,
      "pending",
    );
  },
);

test(
  "fail marca como fallo técnico terminal",
  async () => {
    const repository =
      createTesterFeedbackAnalysisRepositoryV1({
        pool:
          createPool(
            async (
              sql,
              params,
            ) => {
              assert.match(
                sql,
                /status = 'failed'/,
              );

              assert.deepEqual(
                params,
                [
                  6,
                  "LLM_UNAVAILABLE",
                ],
              );

              return {
                rows: [
                  {
                    feedback_id: 6,
                    status:
                      "failed",
                  },
                ],
              };
            },
          ),
      });

    const result =
      await repository.fail({
        feedbackId: 6,
        errorMessage:
          "LLM_UNAVAILABLE",
      });

    assert.equal(
      result.status,
      "failed",
    );
  },
);

test(
  "requeueStale recupera trabajos analyzing abandonados",
  async () => {
    const repository =
      createTesterFeedbackAnalysisRepositoryV1({
        pool:
          createPool(
            async (
              sql,
              params,
            ) => {
              assert.match(
                sql,
                /status = 'analyzing'/,
              );

              assert.match(
                sql,
                /STALE_ANALYSIS_LEASE/,
              );

              assert.deepEqual(
                params,
                [300],
              );

              return {
                rows: [
                  {
                    feedback_id: 9,
                    status:
                      "pending",
                    attempts: 1,
                  },
                ],
              };
            },
          ),
      });

    const result =
      await repository
        .requeueStale();

    assert.equal(
      result.length,
      1,
    );

    assert.equal(
      result[0].status,
      "pending",
    );
  },
);
