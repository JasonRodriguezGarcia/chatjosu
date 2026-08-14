import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveSemanticAnchor,
  isClearlyInsufficient,
  resolveSemanticAnchors,
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

test(
  "resuelve varios anchors explícitos sin perder compatibilidad",
  async () => {
    const {
      resolveSemanticAnchors,
      resolveSemanticAnchor,
    } = await import(
      "../helpchat/semantic-fast-gates.js"
    );

    assert.deepEqual(
      resolveSemanticAnchors(
        "soy alcohólico y tengo depresión"
      ).map(
        (tag) =>
          tag.descripcion
      ),
      [
        "ALCOHOLISMO",
        "SALUD MENTAL",
      ]
    );

    assert.equal(
      resolveSemanticAnchor(
        "soy alcohólico y tengo depresión"
      ),
      null
    );
  }
);

test(
  "amplía anchors explícitos de alcohol y depresión",
  async () => {
    const {
      resolveSemanticAnchors,
    } = await import(
      "../helpchat/semantic-fast-gates.js"
    );

    assert.deepEqual(
      resolveSemanticAnchors(
        "soy alcohólico"
      ).map(
        (tag) =>
          tag.descripcion
      ),
      ["ALCOHOLISMO"]
    );

    assert.deepEqual(
      resolveSemanticAnchors(
        "tengo depresión"
      ).map(
        (tag) =>
          tag.descripcion
      ),
      ["SALUD MENTAL"]
    );
  }
);

test(
  "regresión exacta conserva alcohol trabajo y sueño",
  () => {
    const inputMessage =
      "no sé qué hacer con mi vida he perdido el trabajo.\n" +
      "tengo problemas de alcohol y no puedo dormir por las noches";

    const needs =
      resolveSemanticAnchors(
        inputMessage
      );

    assert.deepEqual(
      needs.map(
        (need) =>
          need.descripcion
      ),
      [
        "ALCOHOLISMO",
        "SALUD MENTAL",
        "INSERCIÓN LABORAL",
      ]
    );
  }
);

test(
  "trata los starters genéricos como información insuficiente",
  () => {
    const emptyContext = {
      version: 1,
      subject: {
        relationship: null,
      },
      activeNeeds: [],
      currentGoal: null,
      facts: [],
      constraints: [],
      territory: {
        province: null,
        municipality: null,
      },
      resourcesShown: [],
    };

    assert.equal(
      isClearlyInsufficient(
        "Busco orientación social",
        emptyContext,
      ),
      true,
    );

    assert.equal(
      isClearlyInsufficient(
        "Necesito apoyo relacionado con una enfermedad",
        emptyContext,
      ),
      true,
    );
  },
);

test(
  "necesito orientación es un starter genérico insuficiente",
  () => {
    assert.equal(
      isClearlyInsufficient(
        "Necesito orientación",
        null,
      ),
      true,
    );
  },
);
