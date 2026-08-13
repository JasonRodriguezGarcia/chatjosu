import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClarification,
  validateClarificationQuestion,
} from "../helpchat/clarification-policy-v1.js";

test(
  "need_type ofrece respuestas rápidas públicas y acotadas",
  () => {
    const result =
      buildClarification({
        missingDimension:
          "need_type",
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
      /situación necesitas orientación/i
    );

    assert.deepEqual(
      result.quickReplies.map(
        (reply) =>
          reply.label
      ),
      [
        "Empleo",
        "Salud o enfermedad",
        "Salud emocional",
        "Alcohol u otras adicciones",
        "Otra situación",
      ]
    );

    for (
      const reply
      of result.quickReplies
    ) {
      assert.equal(
        typeof reply.id,
        "string"
      );

      assert.equal(
        typeof reply.label,
        "string"
      );

      assert.equal(
        typeof reply.message,
        "string"
      );

      assert.ok(
        reply.id.length > 0
      );

      assert.ok(
        reply.label.length > 0
      );

      assert.ok(
        reply.message.length > 0
      );
    }
  }
);

test(
  "subject distingue ayuda propia de ayuda para otra persona",
  () => {
    const result =
      buildClarification({
        missingDimension:
          "subject",
      });

    assert.deepEqual(
      result.quickReplies,
      [
        {
          id: "self",
          label: "Para mí",
          message:
            "Busco ayuda para mí",
        },
        {
          id:
            "other_person",
          label:
            "Para otra persona",
          message:
            "Busco ayuda para otra persona",
        },
      ]
    );
  }
);

test(
  "dimensiones sin respuestas rápidas siguen siendo válidas",
  () => {
    const result =
      buildClarification({
        missingDimension:
          "territory",
      });

    assert.equal(
      result.needsClarification,
      true
    );

    assert.deepEqual(
      result.quickReplies,
      []
    );
  }
);

test(
  "dimensión desconocida cae a need_type junto con sus quick replies",
  () => {
    const result =
      buildClarification({
        missingDimension:
          "invented_dimension",
      });

    assert.equal(
      result.missingDimension,
      "need_type"
    );

    assert.ok(
      result.quickReplies.length >
        0
    );
  }
);

test(
  "la pregunta canónica sigue validando correctamente",
  () => {
    const result =
      buildClarification({
        missingDimension:
          "need_type",
      });

    assert.deepEqual(
      validateClarificationQuestion(
        result.clarificationQuestion
      ),
      {
        valid: true,
        question:
          result.clarificationQuestion,
      }
    );
  }
);

test(
  "need_type emite únicamente controlled replies permitidas",
  () => {
    const result =
      buildClarification({
        missingDimension:
          "need_type",
      });

    assert.deepEqual(
      result.quickReplies.map(
        (reply) =>
          reply.controlledReply,
      ),
      [
        {
          type: "need_domain",
          value: "employment",
        },
        {
          type: "need_domain",
          value: "health",
        },
        {
          type: "need_domain",
          value: "emotional_health",
        },
        {
          type: "need_domain",
          value: "addiction",
        },
        {
          type: "need_domain",
          value: "other",
        },
      ],
    );
  },
);
