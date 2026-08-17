import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeMultiNeedSearchResults,
  resolveMultipleNeeds,
  splitCompoundNeedClauses,
} from "../helpchat/multi-need-v1.js";

const ALCOHOL = {
  tag_id: 2,
  descripcion: "ALCOHOLISMO",
};

const MENTAL = {
  tag_id: 31,
  descripcion: "SALUD MENTAL",
};

test(
  "detecta mensaje potencialmente compuesto",
  () => {
    assert.deepEqual(
      splitCompoundNeedClauses(
        "soy alcohólico y tengo depresión"
      ),
      [
        "soy alcohólico",
        "tengo depresión",
      ]
    );
  }
);

test(
  "mensaje simple no provoca segunda clasificación",
  async () => {
    let calls = 0;

    const result =
      await resolveMultipleNeeds({
        inputMessage:
          "Mi padre tiene Alzheimer",
        conversationContext: null,
        primaryUnderstanding: {
          status: "resolved",
          tag: {
            tag_id: 4,
            descripcion:
              "ALZHEIMER",
          },
          provider: "anchor",
        },
        async understand() {
          calls += 1;
          throw new Error(
            "No debería llamarse"
          );
        },
      });

    assert.equal(
      calls,
      0
    );

    assert.deepEqual(
      result.map(
        (need) =>
          need.descripcion
      ),
      ["ALZHEIMER"]
    );
  }
);

test(
  "compuesto conserva alcohol y depresión",
  async () => {
    const result =
      await resolveMultipleNeeds({
        inputMessage:
          "soy alcohólico y tengo depresión",
        conversationContext: null,
        primaryUnderstanding: {
          status: "resolved",
          tag: ALCOHOL,
          provider: "embedding",
        },
        async understand({
          inputMessage,
        }) {
          if (
            /depres/i.test(
              inputMessage
            )
          ) {
            return {
              status: "resolved",
              tag: MENTAL,
              provider: "embedding",
              needsClarification: false,
            };
          }

          return {
            status: "resolved",
            tag: ALCOHOL,
            provider: "embedding",
            needsClarification: false,
          };
        },
      });

    assert.deepEqual(
      result.map(
        (need) =>
          need.descripcion
      ),
      [
        "ALCOHOLISMO",
        "SALUD MENTAL",
      ]
    );
  }
);

test(
  "merge conserva recurso de segunda necesidad si primera da cero",
  () => {
    const merged =
      mergeMultiNeedSearchResults({
        resolvedNeeds: [
          ALCOHOL,
          MENTAL,
        ],
        searchResults: [
          {
            localCount: 0,
            neighborCount: 0,
            nationalCount: 0,
            associations: [],
          },
          {
            localCount: 0,
            neighborCount: 0,
            nationalCount: 2,
            associations: [
              {
                id: 10,
                name: "AMAFE",
                resultScope:
                  "national",
              },
              {
                id: 12,
                name:
                  "Teléfono de la Esperanza",
                resultScope:
                  "national",
              },
            ],
          },
        ],
        limit: 5,
      });

    assert.equal(
      merged.associations.length,
      2
    );

    assert.deepEqual(
      merged.associations.map(
        (row) =>
          row.matchedNeed
      ),
      [
        "SALUD MENTAL",
        "SALUD MENTAL",
      ]
    );

    assert.equal(
      merged.fallbackType,
      "national"
    );
  }
);

test(
  "merge deduplica asociación presente en dos necesidades",
  () => {
    const merged =
      mergeMultiNeedSearchResults({
        resolvedNeeds: [
          ALCOHOL,
          MENTAL,
        ],
        searchResults: [
          {
            localCount: 1,
            neighborCount: 0,
            nationalCount: 0,
            associations: [
              {
                id: 99,
                name: "Entidad X",
                resultScope:
                  "local",
              },
            ],
          },
          {
            localCount: 1,
            neighborCount: 0,
            nationalCount: 0,
            associations: [
              {
                id: 99,
                name: "Entidad X",
                resultScope:
                  "local",
              },
            ],
          },
        ],
      });

    assert.equal(
      merged.associations.length,
      1
    );
  }
);

test(
  "merge reparte plazas entre necesidades con recursos",
  () => {
    const merged =
      mergeMultiNeedSearchResults({
        resolvedNeeds: [
          ALCOHOL,
          MENTAL,
        ],
        searchResults: [
          {
            localCount: 5,
            neighborCount: 0,
            nationalCount: 0,
            associations: [
              {
                id: 1,
                name: "Alcohol 1",
                resultScope:
                  "local",
              },
              {
                id: 2,
                name: "Alcohol 2",
                resultScope:
                  "local",
              },
              {
                id: 3,
                name: "Alcohol 3",
                resultScope:
                  "local",
              },
              {
                id: 4,
                name: "Alcohol 4",
                resultScope:
                  "local",
              },
              {
                id: 5,
                name: "Alcohol 5",
                resultScope:
                  "local",
              },
            ],
          },
          {
            localCount: 5,
            neighborCount: 0,
            nationalCount: 0,
            associations: [
              {
                id: 11,
                name: "Mental 1",
                resultScope:
                  "local",
              },
              {
                id: 12,
                name: "Mental 2",
                resultScope:
                  "local",
              },
              {
                id: 13,
                name: "Mental 3",
                resultScope:
                  "local",
              },
              {
                id: 14,
                name: "Mental 4",
                resultScope:
                  "local",
              },
              {
                id: 15,
                name: "Mental 5",
                resultScope:
                  "local",
              },
            ],
          },
        ],
        limit: 5,
      });

    assert.deepEqual(
      merged.associations.map(
        row => row.id
      ),
      [
        1,
        11,
        2,
        12,
        3,
      ]
    );

    assert.deepEqual(
      merged.associations.map(
        row =>
          row.matchedNeed
      ),
      [
        "ALCOHOLISMO",
        "SALUD MENTAL",
        "ALCOHOLISMO",
        "SALUD MENTAL",
        "ALCOHOLISMO",
      ]
    );
  }
);

test(
  "merge rellena plazas cuando una necesidad se agota",
  () => {
    const merged =
      mergeMultiNeedSearchResults({
        resolvedNeeds: [
          ALCOHOL,
          MENTAL,
        ],
        searchResults: [
          {
            localCount: 4,
            neighborCount: 0,
            nationalCount: 0,
            associations: [
              {
                id: 1,
                name: "Alcohol 1",
                resultScope:
                  "local",
              },
              {
                id: 2,
                name: "Alcohol 2",
                resultScope:
                  "local",
              },
              {
                id: 3,
                name: "Alcohol 3",
                resultScope:
                  "local",
              },
              {
                id: 4,
                name: "Alcohol 4",
                resultScope:
                  "local",
              },
            ],
          },
          {
            localCount: 1,
            neighborCount: 0,
            nationalCount: 0,
            associations: [
              {
                id: 10,
                name: "Mental 1",
                resultScope:
                  "local",
              },
            ],
          },
        ],
        limit: 5,
      });

    assert.deepEqual(
      merged.associations.map(
        row => row.id
      ),
      [
        1,
        10,
        2,
        3,
        4,
      ]
    );
  }
);

test(
  "merge aplica ranking dentro de cada necesidad antes de intercalar",
  () => {
    const merged =
      mergeMultiNeedSearchResults({
        resolvedNeeds: [
          ALCOHOL,
          MENTAL,
        ],
        searchResults: [
          {
            localCount: 1,
            neighborCount: 0,
            nationalCount: 1,
            associations: [
              {
                id: 1,
                name:
                  "Alcohol nacional",
                resultScope:
                  "national",
                phone:
                  "900000001",
              },
              {
                id: 2,
                name:
                  "Alcohol local",
                resultScope:
                  "local",
              },
            ],
          },
          {
            localCount: 1,
            neighborCount: 0,
            nationalCount: 0,
            associations: [
              {
                id: 10,
                name:
                  "Mental local",
                resultScope:
                  "local",
              },
            ],
          },
        ],
        limit: 3,
      });

    assert.deepEqual(
      merged.associations.map(
        row => row.id
      ),
      [
        2,
        10,
        1,
      ]
    );
  }
);

test(
  "multi-anchor previo evita reclasificar cláusulas",
  async () => {
    let calls = 0;

    const result =
      await resolveMultipleNeeds({
        inputMessage:
          "soy alcohólico y tengo depresión",
        conversationContext: null,
        primaryUnderstanding: {
          status: "resolved",
          tag: ALCOHOL,
          resolvedNeeds: [
            {
              ...ALCOHOL,
              source: "anchor",
            },
            {
              ...MENTAL,
              source: "anchor",
            },
          ],
          provider: "anchor",
        },
        async understand() {
          calls += 1;

          throw new Error(
            "No debería ejecutarse."
          );
        },
      });

    assert.equal(
      calls,
      0
    );

    assert.deepEqual(
      result.map(
        (need) =>
          need.descripcion
      ),
      [
        "ALCOHOLISMO",
        "SALUD MENTAL",
      ]
    );
  }
);

test(
  "una petición genérica de seguimiento no se convierte en segunda necesidad",
  async () => {
    let genericCalls = 0;

    const result =
      await resolveMultipleNeeds({
        inputMessage:
          "El médico me ha dicho que tengo la glucosa demasiado alta y necesito seguimiento",
        conversationContext:
          null,
        primaryUnderstanding: {
          status:
            "resolved",
          tag: {
            tag_id: 13,
            descripcion:
              "DIABETES",
          },
          provider:
            "embedding",
        },
        async understand({
          inputMessage,
        }) {
          if (
            /seguimiento/i.test(
              inputMessage
            )
          ) {
            genericCalls += 1;

            return {
              status:
                "resolved",
              tag: {
                tag_id: 8,
                descripcion:
                  "CÁRITAS BIENESTAR SOCIAL",
              },
              provider:
                "embedding",
              needsClarification:
                false,
            };
          }

          return {
            status:
              "resolved",
            tag: {
              tag_id: 13,
              descripcion:
                "DIABETES",
            },
            provider:
              "embedding",
            needsClarification:
              false,
          };
        },
      });

    assert.equal(
      genericCalls,
      0,
    );

    assert.deepEqual(
      result.map(
        (need) =>
          need.descripcion
      ),
      [
        "DIABETES",
      ],
    );
  },
);

test(
  "multi necesidad conserva dos problemas explícitos independientes",
  async () => {
    const result =
      await resolveMultipleNeeds({
        inputMessage:
          "Bebe demasiado y se ha quedado sin trabajo",
        conversationContext:
          null,
        primaryUnderstanding: {
          status:
            "resolved",
          tag: {
            tag_id: 2,
            descripcion:
              "ALCOHOLISMO",
          },
          provider:
            "anchor",
        },
        async understand({
          inputMessage,
        }) {
          if (
            /trabajo/i.test(
              inputMessage
            )
          ) {
            return {
              status:
                "resolved",
              tag: {
                tag_id: 25,
                descripcion:
                  "INSERCIÓN LABORAL",
              },
              provider:
                "anchor",
              needsClarification:
                false,
            };
          }

          return {
            status:
              "resolved",
            tag: {
              tag_id: 2,
              descripcion:
                "ALCOHOLISMO",
            },
            provider:
              "anchor",
            needsClarification:
              false,
          };
        },
      });

    assert.deepEqual(
      result.map(
        (need) =>
          need.descripcion
      ),
      [
        "ALCOHOLISMO",
        "INSERCIÓN LABORAL",
      ],
    );
  },
);
