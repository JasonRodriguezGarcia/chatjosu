const SOFTWARE_FAILURE_CATEGORIES =
  new Set([
    "repeated_question",
    "wrong_person",
    "context_loss",
    "incorrect_inference",
    "wrong_resources",
    "invalid_transition",
    "classification_error",
    "latency",
    "ux",
    "other",
  ]);

const ANALYSIS_STATUSES =
  new Set([
    "analyzed",
    "invalid_scope",
    "insufficient_evidence",
  ]);

const normalizeString = (
  value,
  {
    required = false,
    fallback = null,
  } = {},
) => {
  const normalized =
    typeof value === "string"
      ? value.trim()
      : "";

  if (
    required &&
    !normalized
  ) {
    throw new Error(
      "valor obligatorio",
    );
  }

  return (
    normalized ||
    fallback
  );
};

const normalizeStringArray = (
  value,
) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) =>
          normalizeString(item),
        )
        .filter(Boolean),
    ),
  ];
};

export const buildTesterFeedbackAnalysisV1 = (
  input = {},
) => {
  const status =
    normalizeString(
      input.status,
      {
        required: true,
      },
    );

  if (
    !ANALYSIS_STATUSES.has(
      status,
    )
  ) {
    throw new Error(
      "analysis status inválido",
    );
  }

  const category =
    normalizeString(
      input.category,
      {
        required: true,
      },
    );

  if (
    !SOFTWARE_FAILURE_CATEGORIES.has(
      category,
    )
  ) {
    throw new Error(
      "software failure category inválida",
    );
  }

  const confidence =
    Number(
      input.confidence,
    );

  if (
    !Number.isFinite(
      confidence,
    ) ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new Error(
      "confidence debe estar entre 0 y 1",
    );
  }

  return {
    version: 1,

    status,

    category,

    confidence,

    summary:
      normalizeString(
        input.summary,
        {
          required: true,
        },
      ),

    suspectedInvariants:
      normalizeStringArray(
        input.suspectedInvariants,
      ),

    suspectedComponents:
      normalizeStringArray(
        input.suspectedComponents,
      ),

    evidenceTurnIds:
      normalizeStringArray(
        input.evidenceTurnIds,
      ),

    observedSoftwareBehavior:
      normalizeString(
        input.observedSoftwareBehavior,
        {
          required: true,
        },
      ),

    expectedSoftwareBehavior:
      normalizeString(
        input.expectedSoftwareBehavior,
        {
          required: true,
        },
      ),

    safetyConstraints: {
      patientDiagnosisForbidden:
        true,

      medicalAssociationReasoningAllowed:
        true,

      medicalReasoningPurpose:
        "software_logic_only",

      mustSeparateAssociationFromPatientConclusion:
        true,

      forbiddenMedicalActions: [
        "diagnose_specific_person",
        "assign_disease_probability_to_specific_person",
        "recommend_treatment_to_specific_person",
        "present_association_as_individual_diagnosis",
      ],

      allowedMedicalReasoning: [
        "identify_symptom_disease_associations_for_software_logic",
        "evaluate_medical_taxonomy_for_software_logic",
        "detect_overconfident_medical_mapping",
        "propose_disambiguation_logic",
      ],

      forbiddenSemanticLeaps:
        normalizeStringArray(
          input
            ?.safetyConstraints
            ?.forbiddenSemanticLeaps,
        ),
    },

    additionalFindings:
      Array.isArray(
        input.additionalFindings,
      )
        ? input.additionalFindings
            .filter(
              (finding) =>
                finding &&
                typeof finding === "object",
            )
            .map(
              (finding) => ({
                category:
                  normalizeString(
                    finding.category,
                  ),

                confidence:
                  Number.isFinite(
                    Number(
                      finding.confidence,
                    ),
                  )
                    ? Number(
                        finding.confidence,
                      )
                    : null,

                summary:
                  normalizeString(
                    finding.summary,
                  ),

                evidenceTurnIds:
                  normalizeStringArray(
                    finding.evidenceTurnIds,
                  ),

                suspectedComponents:
                  normalizeStringArray(
                    finding.suspectedComponents,
                  ),

                regressionRecommended:
                  finding.regressionRecommended ===
                  true,
              }),
            )
        : [],

    regressionCandidate: {
      recommended:
        input
          ?.regressionCandidate
          ?.recommended ===
        true,

      fixtureType:
        normalizeString(
          input
            ?.regressionCandidate
            ?.fixtureType,
        ),
    },

    solutionProposal: {
      summary:
        normalizeString(
          input
            ?.solutionProposal
            ?.summary,
        ),

      filesLikelyAffected:
        normalizeStringArray(
          input
            ?.solutionProposal
            ?.filesLikelyAffected,
        ),

      risks:
        normalizeStringArray(
          input
            ?.solutionProposal
            ?.risks,
        ),
    },

    model: {
      provider:
        normalizeString(
          input
            ?.model
            ?.provider,
        ),

      name:
        normalizeString(
          input
            ?.model
            ?.name,
        ),

      latencyMs:
        Number.isFinite(
          Number(
            input
              ?.model
              ?.latencyMs,
          ),
        )
          ? Number(
              input
                .model
                .latencyMs,
            )
          : null,
    },
  };
};
