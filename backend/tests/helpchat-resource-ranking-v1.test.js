import assert from "node:assert/strict";
import test from "node:test";

import {
  rankHelpchatResourcesV1,
} from "../helpchat/resource-ranking-v1.js";

function resource(
  overrides = {}
) {
  return {
    id: 1,
    name: "Recurso",
    resultScope: "local",
    address: null,
    phone: null,
    email: null,
    website: null,
    ...overrides,
  };
}

test(
  "prioriza local sobre limítrofe y nacional",
  () => {
    const result =
      rankHelpchatResourcesV1([
        resource({
          id: 3,
          resultScope:
            "national",
          phone: "900000003",
        }),
        resource({
          id: 2,
          resultScope:
            "neighbor_province",
          phone: "900000002",
        }),
        resource({
          id: 1,
          resultScope:
            "local",
        }),
      ]);

    assert.deepEqual(
      result.map(
        item =>
          item.resultScope
      ),
      [
        "local",
        "neighbor_province",
        "national",
      ]
    );
  }
);

test(
  "dentro del mismo territorio prioriza contacto directo",
  () => {
    const result =
      rankHelpchatResourcesV1([
        resource({
          id: 1,
          address:
            "Calle Mayor 1",
        }),
        resource({
          id: 2,
          phone:
            "944000000",
        }),
      ]);

    assert.deepEqual(
      result.map(
        item => item.id
      ),
      [2, 1]
    );
  }
);

test(
  "más canales de contacto desempatan entre recursos contactables",
  () => {
    const result =
      rankHelpchatResourcesV1([
        resource({
          id: 1,
          phone:
            "944000001",
        }),
        resource({
          id: 2,
          phone:
            "944000002",
          email:
            "ayuda@example.org",
          website:
            "https://example.org",
        }),
      ]);

    assert.deepEqual(
      result.map(
        item => item.id
      ),
      [2, 1]
    );
  }
);

test(
  "un recurso sólo con dirección se conserva",
  () => {
    const addressOnly =
      resource({
        id: 7,
        address:
          "Plaza Mayor 7",
      });

    const result =
      rankHelpchatResourcesV1([
        addressOnly,
      ]);

    assert.equal(
      result.length,
      1
    );

    assert.equal(
      result[0],
      addressOnly
    );
  }
);

test(
  "un recurso sin contacto tampoco se elimina",
  () => {
    const result =
      rankHelpchatResourcesV1([
        resource({
          id: 8,
        }),
      ]);

    assert.equal(
      result.length,
      1
    );

    assert.equal(
      result[0].id,
      8
    );
  }
);

test(
  "el ranking no muta el array recibido",
  () => {
    const input = [
      resource({
        id: 2,
        phone:
          "944000002",
      }),
      resource({
        id: 1,
      }),
    ];

    const before =
      [...input];

    rankHelpchatResourcesV1(
      input
    );

    assert.deepEqual(
      input,
      before
    );
  }
);

test(
  "el desempate final es determinista",
  () => {
    const result =
      rankHelpchatResourcesV1([
        resource({
          id: 20,
        }),
        resource({
          id: 3,
        }),
        resource({
          id: 11,
        }),
      ]);

    assert.deepEqual(
      result.map(
        item => item.id
      ),
      [3, 11, 20]
    );
  }
);
