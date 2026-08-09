import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClarification,
  validateClarificationQuestion,
} from "../helpchat/clarification-policy-v1.js";

test(
  "construye aclaración de necesidad",
  () => {
    const result =
      buildClarification({
        missingDimension: "need_type",
      });

    assert.equal(
      result.needsClarification,
      true
    );

    assert.equal(
      result.missingDimension,
      "need_type"
    );

    assert.match(
      result.clarificationQuestion,
      /tipo de ayuda/i
    );
  }
);

test(
  "acota ambigüedad de dominio",
  () => {
    const result =
      buildClarification({
        missingDimension:
          "symptom_domain",
      });

    assert.match(
      result.clarificationQuestion,
      /memoria|desorientación/i
    );
  }
);

test(
  "una pregunta corta es válida",
  () => {
    const result =
      validateClarificationQuestion(
        "¿Qué tipo de ayuda necesitas?"
      );

    assert.equal(
      result.valid,
      true
    );
  }
);

test(
  "rechaza varias preguntas",
  () => {
    const result =
      validateClarificationQuestion(
        "¿Qué edad tiene? ¿Dónde vive?"
      );

    assert.equal(
      result.valid,
      false
    );

    assert.equal(
      result.reason,
      "multiple_questions"
    );
  }
);

test(
  "dimensión desconocida vuelve a need_type",
  () => {
    const result =
      buildClarification({
        missingDimension:
          "inventada",
      });

    assert.equal(
      result.missingDimension,
      "need_type"
    );
  }
);
