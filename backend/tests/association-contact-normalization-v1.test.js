import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeContactFieldsV1,
  normalizeEmailV1,
  normalizePhoneV1,
  normalizeWebsiteV1,
} from "../scripts/lib/association-contact-normalization-v1.js";

test(
  "dominio sin esquema se normaliza a https",
  () => {
    assert.equal(
      normalizeWebsiteV1(
        "downaraba.org"
      ),
      "https://downaraba.org/"
    );
  }
);

test(
  "dominio mayúsculas sin esquema se acepta",
  () => {
    assert.equal(
      normalizeWebsiteV1(
        "WWW.CLUBINDAR.ORG"
      ),
      "https://www.clubindar.org/"
    );
  }
);

test(
  "placeholder registral no es web",
  () => {
    for (
      const value
      of [
        "-",
        "NO",
        "NO HAY",
        "no tiene",
        "No aplica",
        "N/C",
      ]
    ) {
      assert.equal(
        normalizeWebsiteV1(
          value
        ),
        null
      );
    }
  }
);

test(
  "email alojado en website se recupera como email",
  () => {
    const result =
      normalizeContactFieldsV1({
        website:
          "contacto@example.org",
      });

    assert.equal(
      result.email,
      "contacto@example.org"
    );

    assert.equal(
      result.website,
      null
    );

    assert.equal(
      result.provenance
        .email
        .method,
      "misplaced"
    );
  }
);

test(
  "teléfono alojado en website se recupera como teléfono",
  () => {
    const result =
      normalizeContactFieldsV1({
        website:
          "688 624 436",
      });

    assert.equal(
      result.phone,
      "688 624 436"
    );

    assert.equal(
      result.website,
      null
    );
  }
);

test(
  "texto descriptivo no se acepta como website",
  () => {
    assert.equal(
      normalizeWebsiteV1(
        "CENTRO SOCIAL DE PERSONAS MAYORES"
      ),
      null
    );
  }
);

test(
  "email normal",
  () => {
    assert.equal(
      normalizeEmailV1(
        "info@example.org"
      ),
      "info@example.org"
    );
  }
);

test(
  "teléfono español normal",
  () => {
    assert.equal(
      normalizePhoneV1(
        "945 123 456"
      ),
      "945 123 456"
    );
  }
);
