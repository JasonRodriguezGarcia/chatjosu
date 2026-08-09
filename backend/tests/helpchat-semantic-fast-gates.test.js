import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveSemanticAnchor,
  isClearlyInsufficient,
} from "../helpchat/semantic-fast-gates.js";

test(
  "resuelve anchors explícitos",
  () => {
    assert.equal(
      resolveSemanticAnchor(
        "Mi padre tiene Alzheimer"
      )?.descripcion,
      "ALZHEIMER"
    );

    assert.equal(
      resolveSemanticAnchor(
        "Mi hija tiene anorexia"
      )?.descripcion,
      "SALUD MENTAL ANOREXIA BULIMIA NERVIOSA TRASTORNO ALIMENTARIO"
    );

    assert.equal(
      resolveSemanticAnchor(
        "Mi hijo tiene autismo"
      )?.descripcion,
      "AUTISMO"
    );
  }
);

test(
  "no inventa anchor en lenguaje ambiguo",
  () => {
    assert.equal(
      resolveSemanticAnchor(
        "Mi tío está perdiendo la cabeza"
      ),
      null
    );
  }
);

test(
  "detecta petición claramente insuficiente",
  () => {
    assert.equal(
      isClearlyInsufficient(
        "Necesito ayuda para mi padre",
        null
      ),
      true
    );

    assert.equal(
      isClearlyInsufficient(
        "Necesito ayuda",
        null
      ),
      true
    );
  }
);

test(
  "contexto activo evita declarar insuficiencia",
  () => {
    assert.equal(
      isClearlyInsufficient(
        "Necesito ayuda para mi padre",
        {
          activeNeeds: [
            "deterioro cognitivo",
          ],
        }
      ),
      false
    );
  }
);
