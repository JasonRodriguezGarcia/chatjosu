import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveOpenClarificationReentryV1,
} from "../helpchat/open-clarification-reentry-v1.js";

test(
  "cambios bruscos de humor salen de la rama de adicción conductual",
  () => {
    assert.deepEqual(
      resolveOpenClarificationReentryV1({
        nodeId:
          "addiction_behavior_detail",
        inputMessage:
          "tiene cambios bruscos de humor y temperamento",
      }),
      {
        status:
          "resolved",
        sourceNode:
          "addiction_behavior_detail",
        targetNode:
          "mental_health_detail",
      },
    );
  },
);

test(
  "una conducta adictiva real no se fuerza a salud emocional",
  () => {
    assert.equal(
      resolveOpenClarificationReentryV1({
        nodeId:
          "addiction_behavior_detail",
        inputMessage:
          "No puede dejar las apuestas online",
      }).status,
      "unresolved",
    );
  },
);

test(
  "una respuesta desconocida no inventa una reentrada",
  () => {
    assert.equal(
      resolveOpenClarificationReentryV1({
        nodeId:
          "addiction_behavior_detail",
        inputMessage:
          "Hace cosas que nos preocupan",
      }).status,
      "unresolved",
    );
  },
);
