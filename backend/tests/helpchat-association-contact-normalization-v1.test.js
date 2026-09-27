import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeAssociationContactFieldsV1,
} from "../services/helpchat-association-service.js";

function normalize(
  overrides = {}
) {
  return normalizeAssociationContactFieldsV1({
    phone: null,
    email: null,
    website: null,
    ...overrides,
  });
}

test(
  "elimina una nota de contacto alojada en website",
  () => {
    const result =
      normalize({
        website:
          "(Contacto por email/teléfono)",
      });

    assert.equal(
      result.website,
      null
    );
  }
);

test(
  "elimina placeholders de contacto comunes",
  () => {
    const values = [
      "Consultar en web",
      "Consultar en web/sede",
      "No disponible",
      "Contacto por teléfono",
      "Contacto por email",
    ];

    for (const value of values) {
      const result =
        normalize({
          website: value,
        });

      assert.equal(
        result.website,
        null,
        value
      );
    }
  }
);

test(
  "conserva webs http y https",
  () => {
    assert.equal(
      normalize({
        website:
          "https://example.org/",
      }).website,
      "https://example.org/"
    );

    assert.equal(
      normalize({
        website:
          "http://example.org/",
      }).website,
      "http://example.org/"
    );
  }
);

test(
  "conserva dominios sin protocolo",
  () => {
    assert.equal(
      normalize({
        website:
          "alzheimernavarra.com",
      }).website,
      "alzheimernavarra.com"
    );

    assert.equal(
      normalize({
        website:
          "www.example.org/contacto",
      }).website,
      "www.example.org/contacto"
    );
  }
);

test(
  "mantiene la limpieza de enlaces markdown",
  () => {
    assert.equal(
      normalize({
        website:
          "[https://example.org/](https://example.org/)",
      }).website,
      "https://example.org/"
    );
  }
);

test(
  "no convierte texto libre en website",
  () => {
    const result =
      normalize({
        website:
          "Llamar para solicitar información",
      });

    assert.equal(
      result.website,
      null
    );
  }
);
