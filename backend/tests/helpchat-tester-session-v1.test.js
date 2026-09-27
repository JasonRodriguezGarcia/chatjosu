import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTesterSessionV1,
  buildTesterTurnV1,
} from "../helpchat/tester-session-v1.js";

test(
  "crea una sesión de tester identificable",
  () => {
    const result =
      buildTesterSessionV1({
        sessionId:
          "session-123",
        startedAt:
          "2026-08-14T15:00:00Z",
        buildRevision:
          "106a5b0",
        environment:
          "testing",
      });

    assert.equal(
      result.sessionId,
      "session-123",
    );

    assert.equal(
      result.buildRevision,
      "106a5b0",
    );

    assert.equal(
      result.environment,
      "testing",
    );
  },
);

test(
  "un turno vincula entrada respuesta contexto y metadata",
  () => {
    const before = {
      version: 2,
      currentFocus:
        "person_1",
    };

    const after = {
      version: 2,
      currentFocus:
        "person_1",
      pendingClarification: {
        node:
          "health_detail",
        personId:
          "person_1",
        mode:
          "free_text",
      },
    };

    const result =
      buildTesterTurnV1({
        sessionId:
          "session-123",
        turnId:
          "turn-4",
        sequence: 4,
        inputMessage:
          "no puede dormir y bebe mucho",
        assistantMessage:
          "¿Os han indicado ya alguna enfermedad o diagnóstico?",
        contextBefore:
          before,
        contextAfter:
          after,
        runtimeMetadata: {
          status:
            "needs_clarification",
          provider:
            "health_statement_authority",
          durationMs: 12,
        },
      });

    assert.equal(
      result.turnId,
      "turn-4",
    );

    assert.equal(
      result.sequence,
      4,
    );

    assert.equal(
      result.contextBefore.currentFocus,
      "person_1",
    );

    assert.equal(
      result.contextAfter
        .pendingClarification
        .node,
      "health_detail",
    );

    assert.equal(
      result.runtimeMetadata
        .status,
      "needs_clarification",
    );
  },
);

test(
  "el snapshot queda desacoplado de los objetos originales",
  () => {
    const context = {
      version: 2,
      currentFocus:
        "person_1",
    };

    const result =
      buildTesterTurnV1({
        sessionId:
          "session-1",
        turnId:
          "turn-1",
        sequence: 1,
        inputMessage:
          "Necesito ayuda",
        assistantMessage:
          "Cuéntame un poco más.",
        contextBefore:
          context,
      });

    context.currentFocus =
      "self";

    assert.equal(
      result.contextBefore
        .currentFocus,
      "person_1",
    );
  },
);

test(
  "rechaza turnos incompletos",
  () => {
    assert.throws(
      () =>
        buildTesterTurnV1({
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

    assert.throws(
      () =>
        buildTesterTurnV1({
          sessionId:
            "session-1",
          turnId:
            "turn-1",
          sequence: 1,
          inputMessage:
            " ",
          assistantMessage:
            "respuesta",
        }),
      /inputMessage/,
    );
  },
);
