import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTesterFeedbackAnalysisV1,
} from "../helpchat/tester-feedback-analysis-v1.js";

test(
  "construye análisis de un defecto de software",
  () => {
    const result =
      buildTesterFeedbackAnalysisV1({
        status:
          "analyzed",

        category:
          "repeated_question",

        confidence:
          0.97,

        summary:
          "La misma aclaración se repite sin progreso.",

        suspectedInvariants: [
          "informative_answer_must_advance",
        ],

        suspectedComponents: [
          "health-statement-authority-v1",
        ],

        evidenceTurnIds: [
          "turn-3",
          "turn-4",
        ],

        observedSoftwareBehavior:
          "El asistente repite la misma pregunta.",

        expectedSoftwareBehavior:
          "Registrar la respuesta y avanzar sin inferir diagnóstico.",

        safetyConstraints: {
          forbiddenSemanticLeaps: [
            "clinical observation -> diagnosis",
          ],
        },

        regressionCandidate: {
          recommended:
            true,
          fixtureType:
            "multi_turn",
        },

        solutionProposal: {
          summary:
            "Añadir una transición de no diagnóstico conocido que avance el grafo.",
        },

        model: {
          provider:
            "local",
          name:
            "qwen",
          latencyMs:
            120,
        },
      });

    assert.equal(
      result.category,
      "repeated_question",
    );

    assert.equal(
      result.safetyConstraints
        .patientDiagnosisForbidden,
      true,
    );

    assert.equal(
      result.safetyConstraints
        .medicalAssociationReasoningAllowed,
      true,
    );

    assert.equal(
      result.safetyConstraints
        .medicalReasoningPurpose,
      "software_logic_only",
    );

    assert.equal(
      result.regressionCandidate
        .recommended,
      true,
    );
  },
);

test(
  "las restricciones médicas no dependen del modelo",
  () => {
    const result =
      buildTesterFeedbackAnalysisV1({
        status:
          "analyzed",
        category:
          "incorrect_inference",
        confidence:
          0.8,
        summary:
          "Defecto lógico.",
        observedSoftwareBehavior:
          "El software hizo una inferencia no permitida.",
        expectedSoftwareBehavior:
          "No inferir diagnóstico.",
      });

    assert.deepEqual(
      result
        .safetyConstraints
        .forbiddenMedicalActions,
      [
        "diagnose_specific_person",
        "assign_disease_probability_to_specific_person",
        "recommend_treatment_to_specific_person",
        "present_association_as_individual_diagnosis",
      ],
    );
  },
);

test(
  "rechaza categorías que no describen defectos software",
  () => {
    assert.throws(
      () =>
        buildTesterFeedbackAnalysisV1({
          status:
            "analyzed",
          category:
            "lung_cancer",
          confidence:
            0.9,
          summary:
            "No permitido",
          observedSoftwareBehavior:
            "x",
          expectedSoftwareBehavior:
            "y",
        }),
      /software failure category inválida/,
    );
  },
);

test(
  "rechaza confianza fuera de rango",
  () => {
    assert.throws(
      () =>
        buildTesterFeedbackAnalysisV1({
          status:
            "analyzed",
          category:
            "other",
          confidence:
            2,
          summary:
            "x",
          observedSoftwareBehavior:
            "x",
          expectedSoftwareBehavior:
            "y",
        }),
      /confidence/,
    );
  },
);
