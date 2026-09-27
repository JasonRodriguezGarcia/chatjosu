import test from "node:test";
import assert from "node:assert/strict";

import {
  createTesterCaptureServiceV1,
} from "../helpchat/tester-capture-service-v1.js";

function createRepository({
  createSession,
  appendTurn,
  createFeedback,
} = {}) {
  return {
    createSession:
      createSession ||
      (async () => ({
        session_id:
          "session-1",
        environment:
          "testing",
        build_revision:
          "build-1",
      })),

    appendTurn:
      appendTurn ||
      (async () => ({
        status:
          "created",
        turn: {
          turn_id:
            "turn-1",
        },
      })),

    createFeedback:
      createFeedback ||
      (async () => ({
        feedback_id: 1,
        review_status:
          "pending",
      })),
  };
}

test(
  "rechaza repository incompleto",
  () => {
    assert.throws(
      () =>
        createTesterCaptureServiceV1({
          repository: {},
        }),
      /repository/,
    );
  },
);

test(
  "createSession normaliza y persiste contrato",
  async () => {
    let received = null;

    const service =
      createTesterCaptureServiceV1({
        repository:
          createRepository({
            createSession:
              async (payload) => {
                received =
                  payload;

                return {
                  session_id:
                    payload.sessionId,
                  environment:
                    payload.environment,
                  build_revision:
                    payload.buildRevision,
                };
              },
          }),
      });

    const result =
      await service.createSession({
        sessionId:
          " session-1 ",
        environment:
          "testing",
        buildRevision:
          " abc123 ",
      });

    assert.deepEqual(
      received,
      {
        sessionId:
          "session-1",
        environment:
          "testing",
        buildRevision:
          "abc123",
      },
    );

    assert.equal(
      result.sessionId,
      "session-1",
    );
  },
);

test(
  "appendTurn persiste snapshot canónico",
  async () => {
    let received = null;

    const service =
      createTesterCaptureServiceV1({
        repository:
          createRepository({
            appendTurn:
              async (payload) => {
                received =
                  payload;

                return {
                  status:
                    "created",
                };
              },
          }),
      });

    const result =
      await service.appendTurn({
        sessionId:
          "session-1",
        turnId:
          "turn-3",
        sequence: 3,
        inputMessage:
          " Necesito ayuda ",
        assistantMessage:
          " Cuéntame un poco más. ",
        contextBefore: {
          version: 2,
        },
        contextAfter: {
          version: 2,
          currentFocus:
            "person_1",
        },
        runtimeMetadata: {
          status:
            "needs_clarification",
        },
      });

    assert.equal(
      received.inputMessage,
      "Necesito ayuda",
    );

    assert.equal(
      received.assistantMessage,
      "Cuéntame un poco más.",
    );

    assert.equal(
      received.contextAfter
        .currentFocus,
      "person_1",
    );

    assert.equal(
      result.status,
      "created",
    );

    assert.equal(
      result.turnId,
      "turn-3",
    );
  },
);

test(
  "appendTurn conserva estado duplicate",
  async () => {
    const service =
      createTesterCaptureServiceV1({
        repository:
          createRepository({
            appendTurn:
              async () => ({
                status:
                  "duplicate",
              }),
          }),
      });

    const result =
      await service.appendTurn({
        sessionId:
          "session-1",
        turnId:
          "turn-1",
        sequence: 1,
        inputMessage:
          "hola",
        assistantMessage:
          "hola",
      });

    assert.equal(
      result.status,
      "duplicate",
    );
  },
);

test(
  "createFeedback mantiene anchors y razonamiento",
  async () => {
    let received = null;

    const service =
      createTesterCaptureServiceV1({
        repository:
          createRepository({
            createFeedback:
              async (payload) => {
                received =
                  payload;

                return {
                  feedback_id:
                    77,
                  review_status:
                    "pending",
                };
              },
          }),
      });

    const result =
      await service.createFeedback({
        sessionId:
          "session-1",
        snapshotThroughTurnId:
          "turn-7",
        anchorTurnIds: [
          "turn-3",
          "turn-7",
        ],
        category:
          "conversation_context",
        reasonText:
          "Perdió el contexto.",
        expectedText:
          "Esperaba que mantuviese a mi hermano.",
        reasonSource:
          "speech",
      });

    assert.deepEqual(
      received.anchorTurnIds,
      [
        "turn-3",
        "turn-7",
      ],
    );

    assert.equal(
      received.reasonSource,
      "speech",
    );

    assert.equal(
      result.feedbackId,
      77,
    );
  },
);

test(
  "los errores de contrato no llegan al repository",
  async () => {
    let calls = 0;

    const service =
      createTesterCaptureServiceV1({
        repository:
          createRepository({
            appendTurn:
              async () => {
                calls += 1;

                return {
                  status:
                    "created",
                };
              },
          }),
      });

    await assert.rejects(
      () =>
        service.appendTurn({
          sessionId:
            "session-1",
          turnId:
            "turn-1",
          sequence: 0,
          inputMessage:
            "hola",
          assistantMessage:
            "hola",
        }),
      /sequence/,
    );

    assert.equal(
      calls,
      0,
    );
  },
);
