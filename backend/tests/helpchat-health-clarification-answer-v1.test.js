import test from "node:test";
import assert from "node:assert/strict";

import {
  interpretHealthClarificationAnswerV1,
} from "../helpchat/health-clarification-answer-v1.js";

test(
  "resolves an explicit no-diagnosis answer",
  () => {
    for (
      const message
      of [
        "observando estos síntomas",
        "de momento estamos observando los síntomas",
        "todavía no hay diagnóstico",
        "no le han diagnosticado nada",
      ]
    ) {
      assert.deepEqual(
        interpretHealthClarificationAnswerV1({
          dimension:
            "diagnosis_status",
          inputMessage:
            message,
        }),
        {
          status:
            "resolved",
          dimension:
            "diagnosis_status",
          value:
            "not_confirmed",
        },
        message,
      );
    }
  },
);

test(
  "does not force unrelated text into diagnosis status",
  () => {
    assert.deepEqual(
      interpretHealthClarificationAnswerV1({
        dimension:
          "diagnosis_status",
        inputMessage:
          "le duele mucho el pecho",
      }),
      {
        status:
          "unresolved",
        dimension:
          "diagnosis_status",
        value: null,
      },
    );
  },
);

test(
  "does not interpret unsupported dimensions",
  () => {
    assert.deepEqual(
      interpretHealthClarificationAnswerV1({
        dimension:
          "something_else",
        inputMessage:
          "todavía no hay diagnóstico",
      }),
      {
        status:
          "unresolved",
        dimension:
          "something_else",
        value: null,
      },
    );
  },
);
