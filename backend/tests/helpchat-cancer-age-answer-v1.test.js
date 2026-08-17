import test from "node:test";
import assert from "node:assert/strict";

import {
  interpretCancerAgeAnswerV1,
} from "../helpchat/cancer-age-answer-v1.js";

test(
  "resuelve cáncer adulto desde edad numérica",
  () => {
    for (
      const input of [
        "72",
        "72 años",
        "Tiene 72 años",
        "tiene 18",
      ]
    ) {
      const result =
        interpretCancerAgeAnswerV1(
          input,
        );

      assert.equal(
        result.status,
        "resolved",
      );

      assert.equal(
        result.resolvedNeeds[0]
          .tag_id,
        9,
      );
    }
  },
);

test(
  "resuelve cáncer infantil desde edad numérica",
  () => {
    for (
      const input of [
        "7",
        "7 años",
        "Tiene 16 años",
        "17",
      ]
    ) {
      const result =
        interpretCancerAgeAnswerV1(
          input,
        );

      assert.equal(
        result.status,
        "resolved",
      );

      assert.equal(
        result.resolvedNeeds[0]
          .tag_id,
        10,
      );
    }
  },
);

test(
  "no inventa una edad",
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
      assert.equal(
        interpretCancerAgeAnswerV1(
          input,
        ).status,
        "unresolved",
      );
    }
  },
);
