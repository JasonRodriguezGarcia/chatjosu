import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveHelpchatLocationRequirement,
} from "../helpchat/location-requirement-v1.js";

const resolvedUnderstanding = {
  status: "resolved",
  tag: {
    tag_id: 2,
    descripcion:
      "ALCOHOLISMO",
  },
  needsClarification: false,
};

test(
  "pide provincia cuando la necesidad está resuelta y falta territorio",
  () => {
    assert.deepEqual(
      resolveHelpchatLocationRequirement({
        effectiveProvince: "",
        understanding:
          resolvedUnderstanding,
      }),
      {
        needsLocation: true,
        locationReason:
          "province_required",
      }
    );
  }
);

test(
  "no pide ubicación cuando ya existe provincia efectiva",
  () => {
    assert.deepEqual(
      resolveHelpchatLocationRequirement({
        effectiveProvince:
          "Burgos",
        understanding:
          resolvedUnderstanding,
      }),
      {
        needsLocation: false,
        locationReason: null,
      }
    );
  }
);

test(
  "la aclaración cognitiva tiene prioridad sobre ubicación",
  () => {
    assert.deepEqual(
      resolveHelpchatLocationRequirement({
        effectiveProvince: "",
        understanding: {
          status:
            "needs_clarification",
          tag: null,
          needsClarification:
            true,
        },
      }),
      {
        needsLocation: false,
        locationReason: null,
      }
    );
  }
);
