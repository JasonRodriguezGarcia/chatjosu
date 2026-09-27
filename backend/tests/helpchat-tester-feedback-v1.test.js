import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTesterFeedbackV1,
} from "../helpchat/tester-feedback-v1.js";

test(
  "feedback pertenece a la conversación y puede señalar varios turnos",
  () => {
    const result =
      buildTesterFeedbackV1({
        sessionId:
          "session-123",
        snapshotThroughTurnId:
          "turn-7",
        anchorTurnIds: [
          "turn-4",
          "turn-7",
        ],
        category:
          "conversation_context",
        reasonText:
          "Dejó de entender que estaba hablando de mi hermano.",
        expectedText:
          "Esperaba que mantuviese a mi hermano como persona actual.",
        reasonSource:
          "speech",
      });

    assert.equal(
      result.version,
      1,
    );

    assert.equal(
      result.sessionId,
      "session-123",
    );

    assert.equal(
      result.snapshotThroughTurnId,
      "turn-7",
    );

    assert.deepEqual(
      result.anchorTurnIds,
      [
        "turn-4",
        "turn-7",
      ],
    );

    assert.equal(
      result.reviewStatus,
      "pending",
    );
  },
);

test(
  "feedback general puede no señalar ningún turno concreto",
  () => {
    const result =
      buildTesterFeedbackV1({
        sessionId:
          "session-general",
        snapshotThroughTurnId:
          "turn-9",
        reasonText:
          "La conversación en conjunto resulta confusa.",
      });

    assert.deepEqual(
      result.anchorTurnIds,
      [],
    );
  },
);

test(
  "deduplica turnos señalados",
  () => {
    const result =
      buildTesterFeedbackV1({
        sessionId:
          "session-1",
        snapshotThroughTurnId:
          "turn-3",
        anchorTurnIds: [
          "turn-2",
          "turn-2",
          "turn-3",
        ],
        reasonText:
          "Se repite.",
      });

    assert.deepEqual(
      result.anchorTurnIds,
      [
        "turn-2",
        "turn-3",
      ],
    );
  },
);

test(
  "no acepta feedback sin conversación o explicación",
  () => {
    assert.throws(
      () =>
        buildTesterFeedbackV1({
          snapshotThroughTurnId:
            "turn-1",
          reasonText:
            "Algo no va bien",
        }),
      /sessionId/,
    );

    assert.throws(
      () =>
        buildTesterFeedbackV1({
          sessionId:
            "session-1",
          snapshotThroughTurnId:
            "turn-1",
          reasonText:
            " ",
        }),
      /reasonText/,
    );
  },
);
