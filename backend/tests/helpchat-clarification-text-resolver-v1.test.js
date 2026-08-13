import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveClarificationTextV1,
} from "../helpchat/clarification-text-resolver-v1.js";

test(
  "resuelve dominios evidentes dentro de need_type",
  () => {
    const cases = [
      [
        "Es por su salud emocional",
        "emotional_health",
      ],
      [
        "Tiene problemas con el alcohol",
        "addiction",
      ],
      [
        "Es por el trabajo",
        "employment",
      ],
    ];

    for (
      const [
        inputMessage,
        choiceId,
      ]
      of cases
    ) {
      const result =
        resolveClarificationTextV1({
          nodeId:
            "need_type",
          inputMessage,
        });

      assert.equal(
        result.status,
        "resolved",
      );

      assert.equal(
        result.choiceId,
        choiceId,
      );
    }
  },
);

test(
  "resuelve respuestas evidentes dentro de salud emocional",
  () => {
    const cases = [
      [
        "No consigue dormir",
        "sleep",
      ],
      [
        "Está muy ansioso",
        "mood_anxiety",
      ],
      [
        "Ha cambiado mucho su comportamiento",
        "behavior_changes",
      ],
    ];

    for (
      const [
        inputMessage,
        choiceId,
      ]
      of cases
    ) {
      const result =
        resolveClarificationTextV1({
          nodeId:
            "mental_health_detail",
          inputMessage,
        });

      assert.equal(
        result.status,
        "resolved",
      );

      assert.equal(
        result.choiceId,
        choiceId,
      );
    }
  },
);

test(
  "no fuerza respuestas inciertas",
  () => {
    for (
      const inputMessage
      of [
        "No sé bien qué pasa",
        "Son varias cosas",
        "Gracias",
      ]
    ) {
      const result =
        resolveClarificationTextV1({
          nodeId:
            "mental_health_detail",
          inputMessage,
        });

      assert.equal(
        result.status,
        "unresolved",
      );

      assert.equal(
        result.choiceId,
        null,
      );
    }
  },
);

test(
  "no intenta elegir en nodos de texto libre",
  () => {
    const result =
      resolveClarificationTextV1({
        nodeId:
          "mental_behavior_detail",
        inputMessage:
          "Desde hace tres semanas está más irritable",
      });

    assert.equal(
      result.status,
      "unresolved",
    );
  },
);

test(
  "no escoge si una frase activa varias opciones",
  () => {
    const result =
      resolveClarificationTextV1({
        nodeId:
          "mental_health_detail",
        inputMessage:
          "Tiene ansiedad y tampoco consigue dormir",
      });

    assert.equal(
      result.status,
      "ambiguous",
    );

    assert.deepEqual(
      result.matches.sort(),
      [
        "mood_anxiety",
        "sleep",
      ].sort(),
    );
  },
);
