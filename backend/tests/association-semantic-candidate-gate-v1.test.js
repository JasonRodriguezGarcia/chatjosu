import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAssociationSemanticCandidateGateV1,
} from "../scripts/lib/association-semantic-candidate-gate-v1.js";

function keys(result) {
  return result
    .needs
    .candidates
    .map(
      row => row.key
    )
    .sort();
}

test(
  "vecinal ordinaria no recibe necesidades candidatas",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        name:
          'DE VECINOS "IGORRE"',
        description:
          "Promoción de iniciativas de interés colectivo vecinal.",
      });

    assert.deepEqual(
      keys(result),
      []
    );
  }
);

test(
  "actividad cultural no recibe discapacidad por plausibilidad",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        name:
          'ASOCIACIÓN FESTIVAL FOLKLÓRICO "GAZTEFOLK"',
        description:
          "Festival folclórico juvenil y promoción de la danza tradicional.",
      });

    assert.deepEqual(
      keys(result),
      []
    );
  }
);

test(
  "radio cultural no recibe enfermedades candidatas",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        name:
          "SOCIEDAD AMIGOS DE LA RADIO",
        description:
          "Difusión y desarrollo de la cultura radiofónica.",
      });

    assert.deepEqual(
      keys(result),
      []
    );
  }
);

test(
  "APAIS produce necesidades evidenciadas",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        name:
          "Asociación para ayuda de la integración sociolaboral de las personas con discapacidad",
        description:
          "Plena integración socio-laboral de personas con deficiencias auditivas, sensoriales y cualquier otra discapacidad.",
      });

    assert.deepEqual(
      keys(result),
      [
        "DISCAPACIDAD",
        "DISCAPACIDAD_AUDITIVA",
        "INSERCION_LABORAL",
      ]
    );
  }
);

test(
  "síndrome X Frágil queda para discovery y no se fuerza a otra necesidad",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        name:
          "Aiala Síndrome X Frágil elkartea",
        description:
          "Apoyo y orientación a familias de personas con Síndrome X Frágil.",
      });

    assert.deepEqual(
      keys(result),
      []
    );

    assert.equal(
      result
        .needs
        .allow_suggested,
      true
    );
  }
);

test(
  "Alzheimer produce necesidad canónica",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        name:
          "Asociación de familiares y personas con Alzheimer",
      });

    assert.deepEqual(
      keys(result),
      ["ALZHEIMER"]
    );
  }
);

test(
  "el gate conserva candidatos review y su evidencia",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        description:
          "Organización de eventos culturales para recaudar fondos para investigación sobre retinosis pigmentaria.",
      });

    const candidate =
      result
        .needs
        .candidates
        .find(
          row =>
            row.key ===
            "RETINOSIS_PIGMENTARIA"
        );

    assert.ok(candidate);

    assert.equal(
      candidate
        .deterministic_confidence,
      "review"
    );

    assert.equal(
      candidate
        .evidence
        .field,
      "description"
    );
  }
);

test(
  "Gaztefolk detecta juventud danza y folklore",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        name:
          'ASOCIACIÓN FESTIVAL FOLKLÓRICO "GAZTEFOLK"',
        description:
          "Festival folclórico internacional juvenil y promoción de la danza tradicional para jóvenes.",
        originalCategory:
          "Música, Danza, Folklore",
      });

    const populations =
      result.populations.candidates
        .map(
          row => row.key
        );

    const activities =
      result.activities.candidates
        .map(
          row => row.key
        );

    assert.ok(
      populations.includes(
        "JUVENTUD"
      )
    );

    assert.ok(
      activities.includes(
        "DANZA"
      )
    );

    assert.ok(
      activities.includes(
        "FOLKLORE"
      )
    );
  }
);

test(
  "radio no recibe folklore ni cultura tradicional",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        name:
          "SOCIEDAD AMIGOS DE LA RADIO",
        description:
          "Difusión y desarrollo de la cultura radiofónica.",
        originalCategory:
          "Radio",
      });

    const activities =
      result.activities.candidates
        .map(
          row => row.key
        );

    assert.ok(
      !activities.includes(
        "FOLKLORE"
      )
    );

    assert.ok(
      !activities.includes(
        "CULTURA_TRADICIONAL"
      )
    );
  }
);

test(
  "Alzheimer no recibe actividad vecinal sin evidencia",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        name:
          "Asociación de familiares y personas con Alzheimer",
        description:
          "Asesoramiento a familiares y cuidadores de personas con Alzheimer.",
        originalCategory:
          "Ayuda a Enfermos",
      });

    const activities =
      result.activities.candidates
        .map(
          row => row.key
        );

    assert.ok(
      !activities.includes(
        "ACTIVIDAD_VECINAL"
      )
    );
  }
);

test(
  "familias y cuidadores se detectan por evidencia",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        description:
          "Apoyo y asesoramiento a familiares y cuidadores de personas con Alzheimer.",
      });

    const populations =
      result.populations.candidates
        .map(
          row => row.key
        );

    assert.ok(
      populations.includes(
        "FAMILIAS"
      )
    );

    assert.ok(
      populations.includes(
        "CUIDADORES"
      )
    );
  }
);

test(
  "actividad vecinal habilita también actividad comunitaria",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        name:
          'DE VECINOS "IGORRE"',
        description:
          "Promover iniciativas de interés colectivo vecinal.",
        originalCategory:
          "De Vecinos",
      });

    const activities =
      result.activities.candidates
        .map(
          row => row.key
        );

    assert.ok(
      activities.includes(
        "ACTIVIDAD_VECINAL"
      )
    );

    assert.ok(
      activities.includes(
        "ACTIVIDAD_COMUNITARIA"
      )
    );
  }
);

test(
  "gate expone referencias semánticas de evidencia",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        name:
          "Asociación juvenil",
        description:
          "Actividades para jóvenes.",
      });

    const youth =
      result
        .populations
        .candidates
        .find(
          row =>
            row.key ===
            "JUVENTUD"
        );

    assert.ok(youth);

    assert.ok(
      ["N1", "D1"].includes(
        youth.evidence
          .evidence_ref
      )
    );
  }
);

test(
  "gate conserva C1 C2 C3 según la categoría que aporta evidencia",
  () => {
    const c1 =
      buildAssociationSemanticCandidateGateV1({
        categorySection:
          "Música",
      });

    assert.equal(
      c1.activities.candidates
        .find(
          row =>
            row.key === "MUSICA"
        )
        ?.evidence
        ?.evidence_ref,
      "C1"
    );

    const c2 =
      buildAssociationSemanticCandidateGateV1({
        categorySorting:
          "Danza",
      });

    assert.equal(
      c2.activities.candidates
        .find(
          row =>
            row.key === "DANZA"
        )
        ?.evidence
        ?.evidence_ref,
      "C2"
    );

    const c3 =
      buildAssociationSemanticCandidateGateV1({
        categoryGoal:
          "Folklore",
      });

    assert.equal(
      c3.activities.candidates
        .find(
          row =>
            row.key === "FOLKLORE"
        )
        ?.evidence
        ?.evidence_ref,
      "C3"
    );
  }
);

test(
  "padres y madres aportan población familias",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        name:
          "ASOCIACION DE PADRES Y MADRES DE ALUMNOS",
        description:
          "Orientar y asistir a los padres y madres en la educación de sus hijos.",
        categoryGoal:
          "De Padres de Alumnos",
      });

    const populations =
      result.populations.candidates
        .map(
          row => row.key
        );

    assert.ok(
      populations.includes(
        "FAMILIAS"
      )
    );
  }
);

test(
  "naturaleza juegos y tiempo libre quedan evidenciados",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        name:
          'ASOCIACIÓN RECREATIVA "TXIRIBUELTA"',
        description:
          "Acercar a los jóvenes a la naturaleza y dinamizar mediante juegos.",
        categoryGoal:
          "Tiempo Libre",
      });

    const populations =
      result.populations.candidates
        .map(
          row => row.key
        );

    const activities =
      result.activities.candidates
        .map(
          row => row.key
        );

    assert.ok(
      populations.includes(
        "JUVENTUD"
      )
    );

    assert.ok(
      activities.includes(
        "NATURALEZA"
      )
    );

    assert.ok(
      activities.includes(
        "JUEGOS"
      )
    );

    assert.ok(
      activities.includes(
        "TIEMPO_LIBRE"
      )
    );
  }
);

test(
  "gate cubre poblaciones canónicas explícitas restantes",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        description:
          "Infancia, adolescentes, mujeres migrantes y refugiadas, "
          + "personas presas y personas sin hogar.",
      });

    const keys =
      new Set(
        result.populations.candidates
          .map(
            row => row.key
          )
      );

    for (const key of [
      "INFANCIA",
      "ADOLESCENCIA",
      "MUJERES",
      "MIGRANTES",
      "REFUGIADOS",
      "PERSONAS_PRESAS",
      "PERSONAS_SIN_HOGAR",
    ]) {
      assert.ok(
        keys.has(key),
        key
      );
    }
  }
);

test(
  "gate cubre actividades canónicas explícitas restantes",
  () => {
    const result =
      buildAssociationSemanticCandidateGateV1({
        description:
          "Canto coral, teatro, cine, lectura, escritura, "
          + "artes plásticas, fotografía, gastronomía, micología, "
          + "ecología, senderismo, deporte, actividad física, "
          + "coleccionismo, filatelia, ocio, voluntariado "
          + "y actividad intergeneracional.",
      });

    const keys =
      new Set(
        result.activities.candidates
          .map(
            row => row.key
          )
      );

    for (const key of [
      "CANTO",
      "TEATRO",
      "CINE",
      "LECTURA",
      "ESCRITURA",
      "ARTES_PLASTICAS",
      "FOTOGRAFIA",
      "GASTRONOMIA",
      "MICOLOGIA",
      "ECOLOGIA",
      "SENDERISMO",
      "DEPORTE",
      "ACTIVIDAD_FISICA",
      "COLECCIONISMO",
      "FILATELIA",
      "OCIO",
      "VOLUNTARIADO",
      "ACTIVIDAD_INTERGENERACIONAL",
    ]) {
      assert.ok(
        keys.has(key),
        key
      );
    }
  }
);
