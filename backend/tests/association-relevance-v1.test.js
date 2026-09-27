import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyAssociationRelevance,
} from "../scripts/lib/association-relevance-v1.js";

function classify(input) {
  return classifyAssociationRelevance(
    input
  );
}

test(
  "ayuda a enfermos entra directamente",
  () => {
    const result =
      classify({
        categories: [
          "Ayuda a Enfermos",
        ],
      });

    assert.equal(
      result.decision,
      "keep"
    );
  }
);

test(
  "deporte adaptado con función inclusiva se conserva",
  () => {
    const result =
      classify({
        categories: [
          "Deportivas (no competitivas)",
        ],
        text: [
          "Apoyo mediante deporte adaptado para personas con discapacidad física.",
        ],
      });

    assert.equal(
      result.decision,
      "keep"
    );
  }
);

test(
  "deporte genérico queda en revisión",
  () => {
    const result =
      classify({
        categories: [
          "Deportivas (no competitivas)",
        ],
        text: [
          "Promoción y práctica deportiva entre sus socios.",
        ],
      });

    assert.equal(
      result.decision,
      "review"
    );
  }
);

test(
  "vecinal con apoyo a familias vulnerables se conserva",
  () => {
    const result =
      classify({
        categories: [
          "De Vecinos",
        ],
        text: [
          "Apoyo social y acompañamiento a familias vulnerables del barrio.",
        ],
      });

    assert.equal(
      result.decision,
      "keep"
    );
  }
);

test(
  "vecinal ordinaria queda en revisión",
  () => {
    const result =
      classify({
        categories: [
          "De Vecinos",
        ],
        text: [
          "Organización de actividades y fiestas del barrio.",
        ],
      });

    assert.equal(
      result.decision,
      "review"
    );
  }
);

test(
  "gastronómica ordinaria queda fuera",
  () => {
    const result =
      classify({
        categories: [
          "Gastronómicas",
        ],
        text: [
          "Promoción y difusión de la gastronomía local.",
        ],
      });

    assert.equal(
      result.decision,
      "drop"
    );
  }
);

test(
  "cultural genérica no se fuerza a keep",
  () => {
    const result =
      classify({
        categories: [
          "Promoción Cultural",
        ],
        text: [
          "Organización de actividades culturales.",
        ],
      });

    assert.equal(
      result.decision,
      "review"
    );
  }
);

test(
  "ocio inclusivo con autismo se conserva",
  () => {
    const result =
      classify({
        categories: [
          "Recreativas",
        ],
        text: [
          "Programa de apoyo y ocio inclusivo para jóvenes con autismo y sus familias.",
        ],
      });

    assert.equal(
      result.decision,
      "keep"
    );
  }
);

test(
  "música para infancia ordinaria queda fuera",
  () => {
    const result =
      classify({
        categories: [
          "Música, Danza, Folklore",
        ],
        text: [
          "Promover el conocimiento de la música en la infancia y la juventud.",
        ],
      });

    assert.equal(
      result.decision,
      "drop"
    );
  }
);

test(
  "teatro infantil ordinario queda fuera",
  () => {
    const result =
      classify({
        categories: [
          "Teatro",
        ],
        text: [
          "Promoción del teatro realizado por y para niños y jóvenes.",
        ],
      });

    assert.equal(
      result.decision,
      "drop"
    );
  }
);

test(
  "infancia vulnerable con apoyo social se conserva",
  () => {
    const result =
      classify({
        categories: [
          "Juveniles",
        ],
        text: [
          "Prestación de apoyo social a menores en situación de vulnerabilidad.",
        ],
      });

    assert.equal(
      result.decision,
      "keep"
    );
  }
);

test(
  "nombre cancer no produce señal sanitaria",
  () => {
    const result =
      classify({
        name:
          "Cultural Musical Ironic Cancer Phobia",
        categories: [
          "Música, Danza, Folklore",
        ],
        text: [
          "Potenciar la música Hard Rock y realizar actividades culturales.",
        ],
      });

    assert.equal(
      result.decision,
      "drop"
    );
  }
);

test(
  "tamborrada recreativa ordinaria queda fuera",
  () => {
    const result =
      classify({
        categories: [
          "Recreativas",
        ],
        text: [
          "Organización de la Tamborrada de Vitoria.",
        ],
      });

    assert.equal(
      result.decision,
      "drop"
    );
  }
);

test(
  "teatro con recuperación de personas con adicciones se conserva para revisión",
  () => {
    const result =
      classify({
        categories: [
          "Teatro",
        ],
        text: [
          "Realización de actividades en centros de recuperación de toxicómanos y alcohólicos.",
        ],
      });

    assert.equal(
      result.decision,
      "review"
    );
  }
);

test(
  "música que solo actúa para mayores no se fuerza a keep",
  () => {
    const result =
      classify({
        categories: [
          "Música, Danza, Folklore",
        ],
        text: [
          "Actuaciones musicales para personas de la tercera edad.",
        ],
      });

    assert.notEqual(
      result.decision,
      "keep"
    );
  }
);

test(
  "salud comunitaria entra directamente",
  () => {
    const result =
      classify({
        categories: [
          "Promoción Cultural",
        ],
        text: [
          "Programas de salud comunitaria en barrios vulnerables.",
        ],
      });

    assert.equal(
      result.decision,
      "keep"
    );
  }
);

test(
  "migración con integración sí es recurso",
  () => {
    const result =
      classify({
        categories: [
          "Promoción Cultural",
        ],
        text: [
          "Facilitar la integración social de la población inmigrante.",
        ],
      });

    assert.equal(
      result.decision,
      "keep"
    );
  }
);

test(
  "folklore con mera mención de colectivos sociales va a revisión y no keep",
  () => {
    const result =
      classify({
        categories: [
          "Música, Danza, Folklore",
        ],
        text: [
          "Colaborar ocasionalmente con asociaciones de enfermos y personas mayores.",
        ],
      });

    assert.equal(
      result.decision,
      "review"
    );
  }
);

test(
  "servicios sociales es finalidad directa",
  () => {
    const result =
      classify({
        categories: [
          "Otros Colectivos",
        ],
        text: [
          "Prestación de servicios sociales a la ciudadanía.",
        ],
      });

    assert.equal(
      result.decision,
      "keep"
    );
  }
);
