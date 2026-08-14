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
        "addiction_substance_detail",
        "addiction_behavior_detail",
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

test(
  "addiction_detail exposes the three canonical branches",
  () => {
    const node =
      getClarificationNodeV1(
        "addiction_detail",
      );

    assert.deepEqual(
      node.choices.map(
        (choice) =>
          choice.id,
      ),
      [
        "alcohol",
        "other_substance",
        "other_behavior",
      ],
    );

    const alcohol =
      resolveClarificationChoiceV1({
        nodeId:
          "addiction_detail",
        choiceId:
          "alcohol",
      });

    assert.equal(
      alcohol.action.type,
      "resolve_need",
    );

    assert.equal(
      alcohol.action.resolvedNeeds[0].descripcion,
      "ALCOHOLISMO",
    );

    const substance =
      resolveClarificationChoiceV1({
        nodeId:
          "addiction_detail",
        choiceId:
          "other_substance",
      });

    assert.equal(
      substance.action.type,
      "goto",
    );

    assert.equal(
      substance.action.node,
      "addiction_substance_detail",
    );

    const behavior =
      resolveClarificationChoiceV1({
        nodeId:
          "addiction_detail",
        choiceId:
          "other_behavior",
      });

    assert.equal(
      behavior.action.type,
      "goto",
    );

    assert.equal(
      behavior.action.node,
      "addiction_behavior_detail",
    );
  },
);

test(
  "cada nodo expone exactamente su pregunta y choices canónicas",
  () => {
    const matrix = {
      need_type: {
        question:
          "¿Sobre qué situación necesitas orientación principalmente?",
        choices: [
          "employment",
          "health",
          "emotional_health",
          "addiction",
          "other",
        ],
      },

      health_detail: {
        question:
          "¿Qué enfermedad, problema de salud o situación concreta estáis viviendo?",
        choices: [],
      },

      mental_health_detail: {
        question:
          "¿Qué es lo que más te preocupa: el ánimo o la ansiedad, el sueño, cambios de conducta, u otra situación?",
        choices: [
          "mood_anxiety",
          "sleep",
          "behavior_changes",
          "mental_other",
        ],
      },

      mental_behavior_detail: {
        question:
          "¿Qué cambios de conducta has notado y desde cuándo están ocurriendo?",
        choices: [],
      },

      addiction_detail: {
        question:
          "¿El problema está relacionado con alcohol, con otra sustancia o con otra conducta?",
        choices: [
          "alcohol",
          "other_substance",
          "other_behavior",
        ],
      },

      addiction_substance_detail: {
        question:
          "¿Con qué sustancia está relacionado y qué está ocurriendo?",
        choices: [],
      },

      addiction_behavior_detail: {
        question:
          "¿Con qué conducta está relacionado y qué está ocurriendo?",
        choices: [],
      },

      free_text: {
        question:
          "Cuéntame con tus propias palabras qué está pasando.",
        choices: [],
      },
    };

    assert.deepEqual(
      listClarificationNodesV1(),
      Object.keys(matrix),
    );

    for (
      const [
        nodeId,
        expected,
      ]
      of Object.entries(matrix)
    ) {
      const node =
        getClarificationNodeV1(
          nodeId,
        );

      assert.equal(
        node.question,
        expected.question,
        `pregunta inesperada en ${nodeId}`,
      );

      assert.deepEqual(
        node.choices.map(
          (choice) =>
            choice.id,
        ),
        expected.choices,
        `choices inesperadas en ${nodeId}`,
      );

      const replies =
        buildClarificationQuickRepliesV1(
          nodeId,
        );

      assert.deepEqual(
        replies.map(
          (reply) =>
            reply.id,
        ),
        expected.choices,
        `quick replies inesperadas en ${nodeId}`,
      );

      for (
        const reply
        of replies
      ) {
        assert.deepEqual(
          reply.controlledReply,
          {
            type:
              "clarification_choice",
            node:
              nodeId,
            choice:
              reply.id,
          },
          `controlled reply inválida en ${nodeId}.${reply.id}`,
        );
      }
    }
  },
);

test(
  "cada goto expone únicamente los botones del nodo destino",
  () => {
    for (
      const nodeId
      of listClarificationNodesV1()
    ) {
      const node =
        getClarificationNodeV1(
          nodeId,
        );

      for (
        const choice
        of node.choices
      ) {
        if (
          choice.action.type !==
            "goto"
        ) {
          continue;
        }

        const result =
          resolveClarificationChoiceV1({
            nodeId,
            choiceId:
              choice.id,
          });

        const targetNode =
          getClarificationNodeV1(
            result.action.node,
          );

        const targetReplies =
          buildClarificationQuickRepliesV1(
            result.action.node,
          );

        assert.deepEqual(
          targetReplies.map(
            (reply) =>
              reply.id,
          ),
          targetNode.choices.map(
            (targetChoice) =>
              targetChoice.id,
          ),
          `${nodeId}.${choice.id} arrastra botones que no pertenecen a ${result.action.node}`,
        );

        for (
          const reply
          of targetReplies
        ) {
          assert.equal(
            reply.controlledReply.node,
            result.action.node,
            `${nodeId}.${choice.id} conserva nodo antiguo`,
          );
        }
      }
    }
  },
);
