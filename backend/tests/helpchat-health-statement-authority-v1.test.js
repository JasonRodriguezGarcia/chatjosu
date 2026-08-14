import test from "node:test";
import assert from "node:assert/strict";

import {
  assessHealthStatementAuthorityV1,
} from "../helpchat/health-statement-authority-v1.js";

test(
  "un diagnóstico declarado puede autorizar clasificación de condición",
  () => {
    for (
      const message
      of [
        "Le han diagnosticado diabetes",
        "Mi padre tiene Alzheimer",
        "Padece Parkinson",
        "Tiene lupus",
      ]
    ) {
      assert.equal(
        assessHealthStatementAuthorityV1(
          message,
        ).status,
        "explicit_condition",
        message,
      );
    }
  },
);

test(
  "síntomas ambiguos no adquieren autoridad diagnóstica",
  () => {
    for (
      const message
      of [
        "no puede dormir y bebe mucho",
        "tiembla bastante",
        "está agotada todo el día",
        "ha perdido mucho peso",
        "tiene mucha sed",
      ]
    ) {
      assert.equal(
        assessHealthStatementAuthorityV1(
          message,
        ).status,
        "symptom_description",
        message,
      );
    }
  },
);

test(
  "una enfermedad mencionada como hipótesis no se trata como diagnóstico",
  () => {
    for (
      const message
      of [
        "No sé si puede ser diabetes",
        "Creo que podría ser Parkinson",
        "Me preocupa que sea cáncer",
      ]
    ) {
      assert.equal(
        assessHealthStatementAuthorityV1(
          message,
        ).status,
        "uncertain_condition",
        message,
      );
    }
  },
);
