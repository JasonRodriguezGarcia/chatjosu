import test from "node:test";
import assert from "node:assert/strict";

import {
  createTesterCaptureRepositoryV1,
} from "../helpchat/tester-capture-repository-v1.js";

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
        createTesterCaptureRepositoryV1(),
      /pool/,
    );

    assert.throws(
      () =>
        createTesterCaptureRepositoryV1({
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
  "createSession crea o refresca una sesión",
  async () => {
    const calls = [];

    const repository =
      createTesterCaptureRepositoryV1({
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
                    session_id:
                      "session-1",
                    environment:
                      "testing",
                    build_revision:
                      "66ee194",
                    status:
                      "active",
                  },
                ],
              };
            },
          ),
      });

    const result =
      await repository.createSession({
        sessionId:
          "session-1",
        environment:
          "testing",
        buildRevision:
          "66ee194",
      });

    assert.equal(
      calls.length,
      1,
    );

    assert.match(
      calls[0].sql,
      /ON CONFLICT \(session_id\)/,
    );

    assert.deepEqual(
      calls[0].params,
      [
        "session-1",
        "testing",
        "66ee194",
      ],
    );

    assert.equal(
      result.session_id,
      "session-1",
    );
  },
);

test(
  "appendTurn devuelve created para un turno nuevo",
  async () => {
    const repository =
      createTesterCaptureRepositoryV1({
        pool:
          createPool(
            async () => ({
              rows: [
                {
                  turn_id:
                    "turn-1",
                  session_id:
                    "session-1",
                  sequence: 1,
                },
              ],
            }),
          ),
      });

    const result =
      await repository.appendTurn({
        sessionId:
          "session-1",
        turnId:
          "turn-1",
        sequence: 1,
        inputMessage:
          "Necesito ayuda",
        assistantMessage:
          "Cuéntame un poco más.",
        controlledReply:
          null,
        contextBefore:
          null,
        contextAfter: {
          version: 2,
        },
        runtimeMetadata: {
          status:
            "needs_clarification",
        },
      });

    assert.equal(
      result.status,
      "created",
    );

    assert.equal(
      result.turn.turn_id,
      "turn-1",
    );
  },
);

test(
  "retry idéntico de appendTurn es idempotente",
  async () => {
    let call = 0;

    const contextAfter = {
      version: 2,
      currentFocus:
        "person_1",
    };

    const metadata = {
      status:
        "needs_clarification",
    };

    const repository =
      createTesterCaptureRepositoryV1({
        pool:
          createPool(
            async () => {
              call += 1;

              if (call === 1) {
                return {
                  rows: [],
                };
              }

              return {
                rows: [
                  {
                    turn_id:
                      "turn-1",
                    session_id:
                      "session-1",
                    sequence: 1,
                    input_message:
                      "Necesito ayuda",
                    assistant_message:
                      "Cuéntame un poco más.",
                    controlled_reply:
                      null,
                    context_before:
                      null,
                    context_after:
                      contextAfter,
                    runtime_metadata:
                      metadata,
                  },
                ],
              };
            },
          ),
      });

    const result =
      await repository.appendTurn({
        sessionId:
          "session-1",
        turnId:
          "turn-1",
        sequence: 1,
        inputMessage:
          "Necesito ayuda",
        assistantMessage:
          "Cuéntame un poco más.",
        controlledReply:
          null,
        contextBefore:
          null,
        contextAfter,
        runtimeMetadata:
          metadata,
      });

    assert.equal(
      result.status,
      "duplicate",
    );

    assert.equal(
      call,
      2,
    );
  },
);

test(
  "mismo turnId con snapshot diferente produce conflicto",
  async () => {
    let call = 0;

    const repository =
      createTesterCaptureRepositoryV1({
        pool:
          createPool(
            async () => {
              call += 1;

              if (call === 1) {
                return {
                  rows: [],
                };
              }

              return {
                rows: [
                  {
                    turn_id:
                      "turn-1",
                    session_id:
                      "session-1",
                    sequence: 1,
                    input_message:
                      "Necesito ayuda",
                    assistant_message:
                      "Cuéntame un poco más.",
                    controlled_reply:
                      null,
                    context_before:
                      null,
                    context_after: {
                      version: 2,
                      currentFocus:
                        "self",
                    },
                    runtime_metadata:
                      null,
                  },
                ],
              };
            },
          ),
      });

    await assert.rejects(
      () =>
        repository.appendTurn({
          sessionId:
            "session-1",
          turnId:
            "turn-1",
          sequence: 1,
          inputMessage:
            "Necesito ayuda",
          assistantMessage:
            "Cuéntame un poco más.",
          contextAfter: {
            version: 2,
            currentFocus:
              "person_1",
          },
        }),
      /TURN_ID_CONFLICT/,
    );
  },
);

test(
  "createFeedback acepta snapshot y anchors de la misma sesión",
  async () => {
    let call = 0;

    const repository =
      createTesterCaptureRepositoryV1({
        pool:
          createPool(
            async (
              sql,
              params,
            ) => {
              call += 1;

              if (call === 1) {
                assert.match(
                  sql,
                  /turn_id = ANY/,
                );

                assert.deepEqual(
                  params,
                  [
                    "session-1",
                    [
                      "turn-7",
                      "turn-4",
                    ],
                  ],
                );

                return {
                  rows: [
                    {
                      turn_id:
                        "turn-7",
                    },
                    {
                      turn_id:
                        "turn-4",
                    },
                  ],
                };
              }

              return {
                rows: [
                  {
                    feedback_id: 9,
                    session_id:
                      "session-1",
                    snapshot_through_turn_id:
                      "turn-7",
                    review_status:
                      "pending",
                  },
                ],
              };
            },
          ),
      });

    const result =
      await repository.createFeedback({
        sessionId:
          "session-1",
        snapshotThroughTurnId:
          "turn-7",
        anchorTurnIds: [
          "turn-4",
        ],
        category:
          "wrong_person",
        reasonText:
          "Ha cambiado de persona.",
        expectedText:
          "Esperaba que siguiese hablando de mi hermano.",
        reasonSource:
          "speech",
      });

    assert.equal(
      result.feedback_id,
      9,
    );

    assert.equal(
      result.review_status,
      "pending",
    );
  },
);

test(
  "createFeedback rechaza snapshot inexistente",
  async () => {
    const repository =
      createTesterCaptureRepositoryV1({
        pool:
          createPool(
            async () => ({
              rows: [],
            }),
          ),
      });

    await assert.rejects(
      () =>
        repository.createFeedback({
          sessionId:
            "session-1",
          snapshotThroughTurnId:
            "turn-99",
          reasonText:
            "Algo falla.",
          category:
            "other",
          reasonSource:
            "text",
        }),
      (error) => {
        assert.equal(
          error.message,
          "UNKNOWN_FEEDBACK_TURN",
        );

        assert.deepEqual(
          error.turnIds,
          [
            "turn-99",
          ],
        );

        return true;
      },
    );
  },
);

test(
  "createFeedback rechaza un anchor que no pertenece a la sesión",
  async () => {
    const repository =
      createTesterCaptureRepositoryV1({
        pool:
          createPool(
            async () => ({
              rows: [
                {
                  turn_id:
                    "turn-7",
                },
              ],
            }),
          ),
      });

    await assert.rejects(
      () =>
        repository.createFeedback({
          sessionId:
            "session-1",
          snapshotThroughTurnId:
            "turn-7",
          anchorTurnIds: [
            "turn-other-session",
          ],
          reasonText:
            "El problema empezó antes.",
          category:
            "conversation_context",
          reasonSource:
            "text",
        }),
      (error) => {
        assert.equal(
          error.message,
          "UNKNOWN_FEEDBACK_TURN",
        );

        assert.deepEqual(
          error.turnIds,
          [
            "turn-other-session",
          ],
        );

        return true;
      },
    );
  },
);
