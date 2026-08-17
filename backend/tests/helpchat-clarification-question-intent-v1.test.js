import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClarificationQuestionIntentV1,
} from "../helpchat/clarification-question-intent-v1.js";

test(
  "builds a reusable question intent from pending age clarification",
  () => {
    const result =
      buildClarificationQuestionIntentV1({
        understanding: {
          needsClarification:
            true,
          missingDimension:
            "age",
          clarificationQuestion:
            "¿Qué edad tiene la persona de la que me hablas?",
        },
        relationalContext: {
          version: 2,
          people: [
            {
              id:
                "person_1",
              relationship:
                "hermano",
            },
          ],
          pendingClarification: {
            node:
              "age",
            personId:
              "person_1",
            mode:
              "free_text",
            dimension:
              "age",
          },
        },
      });

    assert.deepEqual(
      result,
      {
        version: 1,
        action:
          "paraphrase_clarification",
        language:
          "es",
        askFor:
          "age",
        node:
          "age",
        targetPersonId:
          "person_1",
        relationship:
          "hermano",
        canonicalQuestion:
          "¿Qué edad tiene la persona de la que me hablas?",
      },
    );
  },
);

test(
  "does not build a question intent for resolved answers",
  () => {
    assert.equal(
      buildClarificationQuestionIntentV1({
        understanding: {
          needsClarification:
            false,
          clarificationQuestion:
            null,
        },
        relationalContext:
          null,
      }),
      null,
    );
  },
);
