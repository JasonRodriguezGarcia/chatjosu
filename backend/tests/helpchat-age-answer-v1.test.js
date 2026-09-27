import test from "node:test";
import assert from "node:assert/strict";

import {
  interpretAgeAnswerV1,
} from "../helpchat/age-answer-v1.js";

test(
  "extracts a valid age without assigning a need",
  () => {
    const cases = [
      ["72", 72],
      ["72 años", 72],
      ["Tiene 72 años", 72],
      ["tiene 18", 18],
      ["12 años", 12],
      ["Tiene 7 años", 7],
    ];

    for (
      const [
        input,
        expectedAge,
      ] of cases
    ) {
      const result =
        interpretAgeAnswerV1(
          input,
        );

      assert.equal(
        result.status,
        "resolved",
      );

      assert.equal(
        result.age,
        expectedAge,
      );

      assert.equal(
        "resolvedNeeds" in result,
        false,
      );
    }
  },
);

test(
  "does not invent or accept an invalid age",
  () => {
    for (
      const input of [
        "",
        "no lo sé",
        "es joven",
        "es mayor",
        "200 años",
      ]
    ) {
      const result =
        interpretAgeAnswerV1(
          input,
        );

      assert.equal(
        result.status,
        "unresolved",
      );

      assert.equal(
        result.age,
        null,
      );
    }
  },
);
