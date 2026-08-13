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

test(
  "todas las rutas guiadas del grafo terminan de forma válida",
  () => {
    const allowedActions =
      new Set([
        "resolve_need",
        "goto",
        "free_text",
      ]);

    const completedPaths = [];

    function visit(
      nodeId,
      path = [],
      activeNodes = new Set(),
    ) {
      assert.ok(
        path.length <= 20,
        `ruta demasiado profunda: ${path.join(" -> ")}`,
      );

      assert.equal(
        activeNodes.has(nodeId),
        false,
        `ciclo detectado en ${nodeId}: ${path.join(" -> ")}`,
      );

      const node =
        getClarificationNodeV1(
          nodeId,
        );

      assert.ok(
        node,
        `nodo inexistente: ${nodeId}`,
      );

      assert.equal(
        typeof node.question,
        "string",
      );

      assert.ok(
        node.question.trim().length > 0,
      );

      /*
       * Un nodo sin choices es una salida válida
       * hacia respuesta libre contextual.
       */
      if (
        node.choices.length === 0
      ) {
        completedPaths.push({
          path: [
            ...path,
            nodeId,
          ],
          terminal:
            "contextual_free_text",
        });

        return;
      }

      const nextActive =
        new Set(activeNodes);

      nextActive.add(nodeId);

      for (
        const choice of
        node.choices
      ) {
        const result =
          resolveClarificationChoiceV1({
            nodeId,
            choiceId:
              choice.id,
          });

        assert.equal(
          result.status,
          "resolved",
        );

        const action =
          result.action;

        assert.ok(
          allowedActions.has(
            action?.type,
          ),
          `acción inválida en ${nodeId}.${choice.id}`,
        );

        const nextPath = [
          ...path,
          `${nodeId}:${choice.id}`,
        ];

        if (
          action.type ===
            "goto"
        ) {
          assert.ok(
            getClarificationNodeV1(
              action.node,
            ),
            `goto inválido ${nodeId}.${choice.id} -> ${action.node}`,
          );

          visit(
            action.node,
            nextPath,
            nextActive,
          );

          continue;
        }

        if (
          action.type ===
            "resolve_need"
        ) {
          assert.ok(
            Array.isArray(
              action.resolvedNeeds,
            ) &&
            action.resolvedNeeds.length >
              0,
            `resolve sin necesidad en ${nodeId}.${choice.id}`,
          );

          for (
            const need of
            action.resolvedNeeds
          ) {
            assert.ok(
              Number.isFinite(
                Number(
                  need.tag_id,
                ),
              ),
            );

            assert.ok(
              typeof need.descripcion ===
                "string" &&
              need.descripcion.trim(),
            );
          }

          completedPaths.push({
            path:
              nextPath,
            terminal:
              "resolved_need",
          });

          continue;
        }

        if (
          action.type ===
            "free_text"
        ) {
          completedPaths.push({
            path:
              nextPath,
            terminal:
              "free_text",
          });
        }
      }
    }

    visit(
      "need_type",
    );

    assert.ok(
      completedPaths.length >
        0,
    );

    /*
     * Toda choice alcanzable desde need_type
     * debe haber participado en alguna ruta.
     */
    const traversed =
      new Set(
        completedPaths.flatMap(
          (entry) =>
            entry.path,
        ),
      );

    const reachableChoices = [];

    function collect(
      nodeId,
      visited = new Set(),
    ) {
      if (
        visited.has(nodeId)
      ) {
        return;
      }

      visited.add(nodeId);

      const node =
        getClarificationNodeV1(
          nodeId,
        );

      for (
        const choice of
        node?.choices || []
      ) {
        reachableChoices.push(
          `${nodeId}:${choice.id}`,
        );

        if (
          choice.action?.type ===
            "goto"
        ) {
          collect(
            choice.action.node,
            visited,
          );
        }
      }
    }

    collect(
      "need_type",
    );

    for (
      const key of
      reachableChoices
    ) {
      assert.ok(
        traversed.has(key),
        `choice no recorrida: ${key}`,
      );
    }
  },
);
