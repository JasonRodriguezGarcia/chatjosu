import assert from "node:assert/strict";
import test from "node:test";

import {
  mapAssociationTagsV1,
} from "../scripts/lib/association-tag-mapper-v1.js";

function keys(result) {
  return result.tags
    .map(tag => tag.key)
    .sort();
}

test(
  "ELA produce tag específico",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación alavesa de Esclerosis Lateral Amiotrófica",
        description:
          "Apoyo a personas enfermas de ELA y sus familias.",
      });

    assert.ok(
      keys(result).includes(
        "ELA"
      )
    );
  }
);

test(
  "esclerosis múltiple no se confunde con ELA",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación de Esclerosis Múltiple de Araba",
      });

    assert.deepEqual(
      keys(result),
      ["ESCLEROSIS_MULTIPLE"]
    );
  }
);

test(
  "celiaquía genera tag propio",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación de Celíacos y familiares",
      });

    assert.ok(
      keys(result).includes(
        "CELIAQUIA"
      )
    );
  }
);

test(
  "Crohn y colitis comparten necesidad canónica",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación de enfermos de Crohn y Colitis Ulcerosa",
      });

    assert.deepEqual(
      keys(result),
      ["CROHN_COLITIS"]
    );
  }
);

test(
  "una asociación puede recibir varios tags",
  () => {
    const result =
      mapAssociationTagsV1({
        description:
          "Apoyo a personas migrantes en riesgo de exclusión social mediante programas de inserción laboral.",
      });

    assert.deepEqual(
      keys(result),
      [
        "EXCLUSION_SOCIAL",
        "INMIGRACION_REFUGIO",
        "INSERCION_LABORAL",
      ]
    );
  }
);

test(
  "protectora de animales no se convierte en acogimiento familiar",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación protectora de animales",
        description:
          "Acogimiento de animales abandonados.",
      });

    assert.ok(
      !keys(result).includes(
        "ACOGIMIENTO_FAMILIAR"
      )
    );
  }
);

test(
  "mención a personas mayores crea población pero no enfermedad",
  () => {
    const result =
      mapAssociationTagsV1({
        description:
          "Actividades culturales para personas mayores.",
      });

    assert.deepEqual(
      result.tags.map(
        tag => tag.key
      ),
      ["PERSONAS_MAYORES"]
    );

    assert.equal(
      result.tags[0].confidence,
      "review"
    );
  }
);

test(
  "expresión explícita de personas mayores emite PERSONAS_MAYORES",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación para personas mayores",
        description:
          "Apoyo y servicios a personas mayores.",
      });

    assert.ok(
      result.tags.some(
        t => t.key === "PERSONAS_MAYORES"
      ),
      "nombre con expresión explícita debería emitir PERSONAS_MAYORES"
    );
  }
);

test(
  "tercera edad explícita emite PERSONAS_MAYORES",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación para la Tercera Edad",
        description:
          "Apoyo a la Tercera Edad y sus familias.",
      });

    assert.ok(
      result.tags.some(
        t => t.key === "PERSONAS_MAYORES"
      )
    );
  }
);

test(
  "ancianos explícito emite PERSONAS_MAYORES",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación para Ancianos",
        description:
          "Atención a ancianos y ancianas.",
      });

    assert.ok(
      result.tags.some(
        t => t.key === "PERSONAS_MAYORES"
      )
    );
  }
);

test(
  "geriatría explícita emite PERSONAS_MAYORES",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación de Geriatría",
        description:
          "Servicios geriátricos y geriátricos.",
      });

    assert.ok(
      result.tags.some(
        t => t.key === "PERSONAS_MAYORES"
      )
    );
  }
);

test(
  "hemofilia y coagulopatías producen tag específico",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación de Hemofilia y otras Coagulopatías Congénitas",
      });

    assert.deepEqual(
      keys(result),
      ["HEMOFILIA"]
    );
  }
);

test(
  "acoso laboral produce necesidad propia",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación contra el acoso laboral",
        description:
          "Asistencia a víctimas de mobbing.",
      });

    assert.deepEqual(
      keys(result),
      ["ACOSO_LABORAL"]
    );
  }
);

test(
  "Parkinson y Alzheimer pueden coexistir",
  () => {
    const result =
      mapAssociationTagsV1({
        description:
          "Atención a afectados de Parkinson y Alzheimer.",
      });

    assert.deepEqual(
      keys(result),
      [
        "ALZHEIMER",
        "PARKINSON",
      ]
    );
  }
);

test(
  "salud mental explícita queda cubierta",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación Salud Mental ASASAM",
        description:
          "Atender las necesidades de personas con enfermedad mental.",
      });

    const tag =
      result.tags.find(
        item =>
          item.key ===
          "SALUD_MENTAL"
      );

    assert.ok(tag);
    assert.equal(
      tag.confidence,
      "high"
    );
  }
);

test(
  "discapacidad física tiene necesidad propia",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación de personas con discapacidad física",
      });

    assert.ok(
      keys(result).includes(
        "DISCAPACIDAD_FISICA"
      )
    );
  }
);

test(
  "adicciones comportamentales quedan cubiertas",
  () => {
    const result =
      mapAssociationTagsV1({
        description:
          "Atención y rehabilitación de personas con adicciones comportamentales.",
      });

    const tag =
      result.tags.find(
        item =>
          item.key ===
          "ADICCIONES_COMPORTAMENTALES"
      );

    assert.ok(tag);
    assert.equal(
      tag.confidence,
      "high"
    );
  }
);

test(
  "mención secundaria sin servicio queda en review",
  () => {
    const result =
      mapAssociationTagsV1({
        description:
          "Organización de eventos culturales para recaudar fondos para investigación sobre retinosis pigmentaria.",
      });

    const tag =
      result.tags.find(
        item =>
          item.key ===
          "RETINOSIS_PIGMENTARIA"
      );

    assert.ok(tag);
    assert.equal(
      tag.confidence,
      "review"
    );
  }
);

test(
  "servicio cercano a necesidad en descripción da high",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Entidad de apoyo social",
        description:
          "Ponemos recursos a disposición de personas desempleadas para lograr su inserción laboral.",
      });

    const tag =
      result.tags.find(
        item =>
          item.key ===
          "INSERCION_LABORAL"
      );

    assert.ok(tag);
    assert.equal(
      tag.confidence,
      "high"
    );
  }
);

test(
  "servicio lejano de una mención secundaria no promueve a high",
  () => {
    const padding =
      "actividad cultural comunitaria ".repeat(
        30
      );

    const result =
      mapAssociationTagsV1({
        description:
          "Ofrecer orientación general a los socios. " +
          padding +
          "Colaborar ocasionalmente con investigación sobre retinosis pigmentaria.",
      });

    const tag =
      result.tags.find(
        item =>
          item.key ===
          "RETINOSIS_PIGMENTARIA"
      );

    assert.ok(tag);
    assert.equal(
      tag.confidence,
      "review"
    );
  }
);

test(
  "discapacidad genérica explícita queda cubierta",
  () => {
    const result =
      mapAssociationTagsV1({
        description:
          "Apoyo a personas con discapacidad para su inclusión social.",
      });

    assert.ok(
      keys(result).includes(
        "DISCAPACIDAD"
      )
    );
  }
);

test(
  "drogadicción explícita emite ADICCIONES_DROGAS",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación contra la drogadicción",
        description:
          "Tratamiento de drogadicción y rehabilitación.",
      });

    assert.ok(
      result.tags.some(
        t => t.key === "ADICCIONES_DROGAS"
      ),
      "drogadicción explícita debería emitir ADICCIONES_DROGAS"
    );
  }
);

test(
  "drogadicto explícito emite ADICCIONES_DROGAS",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación de apoyo a drogadictos",
        description:
          "Ayuda a drogadictos y sus familias.",
      });

    assert.ok(
      result.tags.some(
        t => t.key === "ADICCIONES_DROGAS"
      )
    );
  }
);

test(
  "toxicomanía explícita emite ADICCIONES_DROGAS",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación contra la toxicomanía",
        description:
          "Tratamiento de toxicomanía y rehabilitación.",
      });

    assert.ok(
      result.tags.some(
        t => t.key === "ADICCIONES_DROGAS"
      )
    );
  }
);

test(
  "adicción a sustancias explícita emite ADICCIONES_DROGAS",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación para la adicción a sustancias",
        description:
          "Apoyo a personas con adicción a sustancias.",
      });

    assert.ok(
      result.tags.some(
        t => t.key === "ADICCIONES_DROGAS"
      )
    );
  }
);

test(
  "estupefacientes en contexto de adicción emite ADICCIONES_DROGAS",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación de prevención de consumo de estupefacientes",
        description:
          "Tratamiento de adicción a estupefacientes.",
      });

    assert.ok(
      result.tags.some(
        t => t.key === "ADICCIONES_DROGAS"
      )
    );
  }
);

test(
  "\"droga\" aislada sin contexto de adicción no emite ADICCIONES_DROGAS",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Archivo histórico",
        description:
          "Exposición sobre el uso de la palabra droga en prensa antigua.",
      });

    assert.ok(
      !result.tags.some(
        t => t.key === "ADICCIONES_DROGAS"
      ),
      "\"droga\" aislada sin contexto de adicción no debería emitir ADICCIONES_DROGAS"
    );
  }
);

test(
  "estupefacientes sin contexto de adicción no emite ADICCIONES_DROGAS",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Archivo jurídico",
        description:
          "Documentación histórica sobre estupefacientes y normativa.",
      });

    assert.ok(
      !result.tags.some(
        t => t.key === "ADICCIONES_DROGAS"
      )
    );
  }
);

test(
  "drogadiccion sin tilde emite ADICCIONES_DROGAS",
  () => {
    const result =
      mapAssociationTagsV1({
        description:
          "Servicio de tratamiento de drogadiccion y rehabilitación.",
      });

    assert.ok(
      result.tags.some(
        t => t.key === "ADICCIONES_DROGAS"
      )
    );
  }
);

test(
  "\"adicciones\" aislada sin contexto de drogas no emite ADICCIONES_DROGAS",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Centro de atención integral",
        description:
          "Atención a adicciones y problemas de salud mental.",
      });

    assert.ok(
      !result.tags.some(
        t => t.key === "ADICCIONES_DROGAS"
      ),
      "\"adicciones\" aislada sin contexto de drogas no debería emitir ADICCIONES_DROGAS"
    );
  }
);

test(
  "adicciones comportamentales sin evidencia de sustancias emite ADICCIONES_COMPORTAMENTALES",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación contra la ludopatía",
        description:
          "Tratamiento de adicciones comportamentales como la ludopatía.",
      });

    assert.ok(
      result.tags.some(
        t => t.key === "ADICCIONES_COMPORTAMENTALES"
      ),
      "adicciones comportamentales deberían emitir ADICCIONES_COMPORTAMENTALES"
    );
    assert.ok(
      !result.tags.some(
        t => t.key === "ADICCIONES_DROGAS"
      ),
      "adicciones comportamentales sin sustancias no deberían emitir ADICCIONES_DROGAS"
    );
  }
);

test(
  "deficiencias auditivas se reconocen como discapacidad auditiva",
  () => {
    const result =
      mapAssociationTagsV1({
        description:
          "Ayuda a personas con deficiencias auditivas.",
      });

    assert.ok(
      keys(result).includes(
        "DISCAPACIDAD_AUDITIVA"
      )
    );
  }
);

test(
  "integración sociolaboral se reconoce como inserción laboral",
  () => {
    const result =
      mapAssociationTagsV1({
        description:
          "Favorecer la integración sociolaboral de personas con discapacidad.",
      });

    assert.ok(
      keys(result).includes(
        "INSERCION_LABORAL"
      )
    );
  }
);

test(
  "caso APAIS conserva discapacidad auditiva e inserción laboral",
  () => {
    const result =
      mapAssociationTagsV1({
        name:
          "Asociación para ayuda de la integración sociolaboral de las personas con discapacidad",
        description:
          "El fin es la plena integración socio-laboral de las personas con deficiencias auditivas, sensoriales y cualquier otra discapacidad que dificulte la integración en entornos sociolaborales.",
      });

    const found =
      keys(result);

    assert.ok(
      found.includes(
        "DISCAPACIDAD"
      )
    );

    assert.ok(
      found.includes(
        "DISCAPACIDAD_AUDITIVA"
      )
    );

    assert.ok(
      found.includes(
        "INSERCION_LABORAL"
      )
    );
  }
);
