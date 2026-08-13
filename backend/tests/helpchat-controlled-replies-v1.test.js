import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTROLLED_REPLY_VALUES_V1,
  isControlledReplyV1,
  resolveControlledReplyV1,
} from "../helpchat/controlled-replies-v1.js";

test(
  "employment resuelve directamente a inserción laboral",
  () => {
    assert.deepEqual(
      resolveControlledReplyV1(
        "employment",
      ),
      {
        type: "resolved_need",
        resolvedNeeds: [
          {
            tag_id: 25,
            descripcion:
              "INSERCIÓN LABORAL",
            source:
              "controlled_reply",
          },
        ],
      },
    );
  },
);

test(
  "health pide más información y no inventa un tag",
  () => {
    assert.deepEqual(
      resolveControlledReplyV1(
        "health",
      ),
      {
        type: "clarification",
        missingDimension:
          "health_detail",
      },
    );
  },
);

test(
  "salud emocional y adicciones siguen siendo ramas de aclaración",
  () => {
    assert.equal(
      resolveControlledReplyV1(
        "emotional_health",
      ).type,
      "clarification",
    );

    assert.equal(
      resolveControlledReplyV1(
        "addiction",
      ).type,
      "clarification",
    );
  },
);

test(
  "other devuelve a entrada libre",
  () => {
    assert.deepEqual(
      resolveControlledReplyV1(
        "other",
      ),
      {
        type: "free_text",
      },
    );
  },
);

test(
  "valores desconocidos no se interpretan",
  () => {
    assert.equal(
      resolveControlledReplyV1(
        "housing",
      ),
      null,
    );

    assert.equal(
      isControlledReplyV1(
        "invented",
      ),
      false,
    );
  },
);

test(
  "el conjunto permitido queda explícito",
  () => {
    assert.deepEqual(
      CONTROLLED_REPLY_VALUES_V1,
      [
        "employment",
        "health",
        "emotional_health",
        "addiction",
        "other",
      ],
    );
  },
);
