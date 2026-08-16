import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAssociationUtilityGateV1,
} from "../scripts/lib/association-utility-gate-v1.js";

test(
  "relevance no-drop sobrevive sin señales adicionales",
  () => {
    const result =
      buildAssociationUtilityGateV1({
        relevanceDecision:
          "review",
      });

    assert.equal(
      result.decision,
      "keep"
    );

    assert.equal(
      result.protected,
      false
    );
  }
);

test(
  "drop cultural sin utilidad se descarta",
  () => {
    const result =
      buildAssociationUtilityGateV1({
        relevanceDecision:
          "drop",

        functionKeys: [
          "INVESTIGACION",
          "SENSIBILIZACION",
        ],
      });

    assert.equal(
      result.decision,
      "drop"
    );

    assert.equal(
      result.protected,
      false
    );
  }
);

test(
  "drop con necesidad explícita se protege",
  () => {
    const result =
      buildAssociationUtilityGateV1({
        relevanceDecision:
          "drop",

        needKeys: [
          "SALUD_MENTAL",
        ],
      });

    assert.equal(
      result.decision,
      "keep"
    );

    assert.ok(
      result.reasons.includes(
        "need"
      )
    );
  }
);

test(
  "drop con función asistencial se protege",
  () => {
    const result =
      buildAssociationUtilityGateV1({
        relevanceDecision:
          "drop",

        functionKeys: [
          "ASESORAMIENTO",
        ],
      });

    assert.equal(
      result.decision,
      "keep"
    );

    assert.ok(
      result.reasons.includes(
        "assistive_function"
      )
    );
  }
);

test(
  "drop con contexto asistencial oficial se protege",
  () => {
    const result =
      buildAssociationUtilityGateV1({
        relevanceDecision:
          "drop",

        hints: [
          "health_or_condition_resource",
        ],
      });

    assert.equal(
      result.decision,
      "keep"
    );

    assert.ok(
      result.reasons.includes(
        "protective_hint"
      )
    );
  }
);
