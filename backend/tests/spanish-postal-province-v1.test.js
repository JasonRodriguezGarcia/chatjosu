import assert from "node:assert/strict";
import test from "node:test";

import {
  provinceKeyFromSpanishPostalCode,
} from "../helpchat/spanish-postal-province-v1.js";

test(
  "Irun resuelve Gipuzkoa por prefijo postal",
  () => {
    assert.equal(
      provinceKeyFromSpanishPostalCode(
        "20304"
      ),
      "GUIPUZCOA"
    );
  }
);

test(
  "resuelve provincias sensibles del contrato",
  () => {
    assert.equal(
      provinceKeyFromSpanishPostalCode(
        "48001"
      ),
      "VIZCAYA"
    );

    assert.equal(
      provinceKeyFromSpanishPostalCode(
        "15001"
      ),
      "A CORUNA"
    );

    assert.equal(
      provinceKeyFromSpanishPostalCode(
        "35001"
      ),
      "LAS PALMAS"
    );

    assert.equal(
      provinceKeyFromSpanishPostalCode(
        "26001"
      ),
      "LA RIOJA"
    );
  }
);

test(
  "incluye Ceuta y Melilla",
  () => {
    assert.equal(
      provinceKeyFromSpanishPostalCode(
        "51001"
      ),
      "CEUTA"
    );

    assert.equal(
      provinceKeyFromSpanishPostalCode(
        "52001"
      ),
      "MELILLA"
    );
  }
);

test(
  "rechaza códigos inválidos",
  () => {
    assert.equal(
      provinceKeyFromSpanishPostalCode(
        null
      ),
      null
    );

    assert.equal(
      provinceKeyFromSpanishPostalCode(
        "2030"
      ),
      null
    );

    assert.equal(
      provinceKeyFromSpanishPostalCode(
        "ABCDE"
      ),
      null
    );
  }
);
