import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHelpchatResourceResponseV1,
} from "../helpchat/resource-response-v1.js";

test(
  "presenta un recurso simple sin repetir innecesariamente la única necesidad",
  () => {
    const message =
      buildHelpchatResourceResponseV1({
        associations: [
          {
            id: 1,
            name:
              "Asociación Uno",
            municipality:
              "Bilbao",
            phone:
              "944000001",
            matchedNeed:
              "ALCOHOLISMO",
            matchedNeeds: [
              "ALCOHOLISMO",
            ],
          },
        ],
        resolvedNeeds: [
          {
            tag_id: 2,
            descripcion:
              "ALCOHOLISMO",
          },
        ],
        effectiveProvince:
          "Bizkaia",
        resolvedProvince:
          "Bizkaia",
        localCount: 1,
      });

    assert.match(
      message,
      /He encontrado 1 opción/
    );

    assert.match(
      message,
      /\*\*Asociación Uno\*\*/
    );

    assert.match(
      message,
      /Bilbao/
    );

    assert.match(
      message,
      /Tel\.: 944000001/
    );

    assert.doesNotMatch(
      message,
      /Puede orientarte con:/
    );
  }
);

test(
  "explica el match de cada recurso cuando hay varias necesidades",
  () => {
    const message =
      buildHelpchatResourceResponseV1({
        associations: [
          {
            id: 1,
            name:
              "Recurso Alcohol",
            matchedNeeds: [
              "ALCOHOLISMO",
            ],
          },
          {
            id: 2,
            name:
              "Recurso Salud",
            matchedNeeds: [
              "SALUD MENTAL",
            ],
          },
        ],
        resolvedNeeds: [
          {
            tag_id: 2,
            descripcion:
              "ALCOHOLISMO",
          },
          {
            tag_id: 31,
            descripcion:
              "SALUD MENTAL",
          },
        ],
        effectiveProvince:
          "Bizkaia",
        resolvedProvince:
          "Bizkaia",
        localCount: 2,
      });

    assert.match(
      message,
      /Recurso Alcohol[\s\S]*Puede orientarte con: ALCOHOLISMO/
    );

    assert.match(
      message,
      /Recurso Salud[\s\S]*Puede orientarte con: SALUD MENTAL/
    );
  }
);

test(
  "presenta una asociación multi-tag una sola vez con todas sus necesidades",
  () => {
    const message =
      buildHelpchatResourceResponseV1({
        associations: [
          {
            id: 99,
            name:
              "Entidad Integral",
            matchedNeed:
              "ALCOHOLISMO",
            matchedNeeds: [
              "ALCOHOLISMO",
              "SALUD MENTAL",
            ],
          },
        ],
        resolvedNeeds: [
          {
            tag_id: 2,
            descripcion:
              "ALCOHOLISMO",
          },
          {
            tag_id: 31,
            descripcion:
              "SALUD MENTAL",
          },
        ],
        effectiveProvince:
          "Bizkaia",
        resolvedProvince:
          "Bizkaia",
        localCount: 2,
      });

    assert.equal(
      (
        message.match(
          /Entidad Integral/g
        ) || []
      ).length,
      1
    );

    assert.match(
      message,
      /Puede orientarte con: ALCOHOLISMO · SALUD MENTAL/
    );
  }
);

test(
  "usa el número de recursos visibles y no el contador bruto de matches",
  () => {
    const message =
      buildHelpchatResourceResponseV1({
        associations: [
          {
            id: 1,
            name:
              "Entidad A",
          },
          {
            id: 2,
            name:
              "Entidad B",
          },
        ],
        resolvedNeeds: [
          {
            tag_id: 2,
            descripcion:
              "ALCOHOLISMO",
          },
          {
            tag_id: 31,
            descripcion:
              "SALUD MENTAL",
          },
        ],
        effectiveProvince:
          "Bizkaia",
        resolvedProvince:
          "Bizkaia",
        localCount: 7,
      });

    assert.match(
      message,
      /He encontrado 2 opciones/
    );

    assert.doesNotMatch(
      message,
      /He encontrado 7 opciones/
    );
  }
);

test(
  "mantiene el mensaje de fallback a provincias limítrofes",
  () => {
    const message =
      buildHelpchatResourceResponseV1({
        associations: [
          {
            id: 1,
            name:
              "Recurso Limítrofe",
            municipality:
              "Laredo",
            matchedNeeds: [
              "SALUD MENTAL",
            ],
          },
        ],
        resolvedNeeds: [
          {
            tag_id: 31,
            descripcion:
              "SALUD MENTAL",
          },
        ],
        effectiveProvince:
          "Bizkaia",
        resolvedProvince:
          "Cantabria",
        localCount: 0,
        fallbackType:
          "neighbor_province",
      });

    assert.match(
      message,
      /No he encontrado opciones registradas en \*\*Bizkaia\*\*/
    );

    assert.match(
      message,
      /provincias limítrofes/
    );

    assert.match(
      message,
      /Recurso Limítrofe/
    );
  }
);

test(
  "mantiene el mensaje de fallback nacional",
  () => {
    const message =
      buildHelpchatResourceResponseV1({
        associations: [
          {
            id: 1,
            name:
              "Recurso Estatal",
            matchedNeeds: [
              "DIABETES",
            ],
          },
        ],
        resolvedNeeds: [
          {
            tag_id: 13,
            descripcion:
              "DIABETES",
          },
        ],
        effectiveProvince:
          "Bizkaia",
        resolvedProvince:
          "Bizkaia",
        localCount: 0,
        fallbackType:
          "national",
      });

    assert.match(
      message,
      /recursos de ámbito nacional/
    );
  }
);

test(
  "mantiene una respuesta útil cuando no hay recursos",
  () => {
    const message =
      buildHelpchatResourceResponseV1({
        associations: [],
        resolvedNeeds: [
          {
            tag_id: 13,
            descripcion:
              "DIABETES",
          },
        ],
        effectiveProvince:
          "Bizkaia",
      });

    assert.match(
      message,
      /no he encontrado asociaciones/
    );

    assert.match(
      message,
      /\*\*DIABETES\*\*/
    );
  }
);
