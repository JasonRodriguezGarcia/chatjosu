import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClarificationQuickRepliesV1,
  getClarificationNodeV1,
  listClarificationNodesV1,
  resolveClarificationChoiceV1,
} from "../helpchat/clarification-graph-v1.js";

test(
  "el grafo expone nodos canónicos",
  () => {
    assert.deepEqual(
      listClarificationNodesV1(),
      [
        "need_type",
        "health_detail",
        "mental_health_detail",
        "mental_behavior_detail",
        "addiction_detail",
        "free_text",
      ],
    );
  },
);

test(
  "need_type dirige salud emocional al siguiente nodo",
  () => {
    const result =
      resolveClarificationChoiceV1({
        nodeId:
          "need_type",
        choiceId:
          "emotional_health",
      });

    assert.equal(
      result.status,
      "resolved",
    );

    assert.deepEqual(
      result.action,
      {
        type: "goto",
        node:
          "mental_health_detail",
      },
    );
  },
);

test(
  "salud emocional resuelve ánimo y sueño localmente",
  () => {
    for (
      const choiceId of [
        "mood_anxiety",
        "sleep",
      ]
    ) {
      const result =
        resolveClarificationChoiceV1({
          nodeId:
            "mental_health_detail",
          choiceId,
        });

      assert.equal(
        result.action.type,
        "resolve_need",
      );

      assert.deepEqual(
        result.action.resolvedNeeds,
        [
          {
            tag_id: 31,
            descripcion:
              "SALUD MENTAL",
          },
        ],
      );
    }
  },
);

test(
  "cambios de conducta progresa y no resuelve a ciegas",
  () => {
    const result =
      resolveClarificationChoiceV1({
        nodeId:
          "mental_health_detail",
        choiceId:
          "behavior_changes",
      });

    assert.deepEqual(
      result.action,
      {
        type: "goto",
        node:
          "mental_behavior_detail",
      },
    );
  },
);

test(
  "otra situación abandona decisiones cerradas y permite texto libre",
  () => {
    const result =
      resolveClarificationChoiceV1({
        nodeId:
          "mental_health_detail",
        choiceId:
          "mental_other",
      });

    assert.deepEqual(
      result.action,
      {
        type: "free_text",
      },
    );
  },
);

test(
  "quick replies transportan nodo y elección sin reinterpretar lenguaje",
  () => {
    const replies =
      buildClarificationQuickRepliesV1(
        "mental_health_detail",
      );

    assert.deepEqual(
      replies.map(
        (reply) =>
          reply.label,
      ),
      [
        "Ánimo o ansiedad",
        "Sueño",
        "Cambios de conducta",
        "Otra situación",
      ],
    );

    assert.deepEqual(
      replies[1].controlledReply,
      {
        type:
          "clarification_choice",
        node:
          "mental_health_detail",
        choice:
          "sleep",
      },
    );
  },
);

test(
  "una opción de otro nodo no puede reutilizarse fuera de contexto",
  () => {
    const result =
      resolveClarificationChoiceV1({
        nodeId:
          "need_type",
        choiceId:
          "sleep",
      });

    assert.equal(
      result.status,
      "unknown_choice",
    );

    assert.equal(
      result.action,
      null,
    );
  },
);

test(
  "todo goto apunta a un nodo existente",
  () => {
    for (
      const nodeId of
      listClarificationNodesV1()
    ) {
      const node =
        getClarificationNodeV1(
          nodeId,
        );

      for (
        const choice of
        node.choices
      ) {
        if (
          choice.action.type !==
          "goto"
        ) {
          continue;
        }

        assert.ok(
          getClarificationNodeV1(
            choice.action.node,
          ),
          `${nodeId}.${choice.id} apunta a ${choice.action.node}`,
        );
      }
    }
  },
);
