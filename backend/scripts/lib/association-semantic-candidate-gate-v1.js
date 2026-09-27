import {
  mapAssociationTagsV1,
} from "./association-tag-mapper-v1.js";

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("es-ES")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstEvidence(
  fields,
  patterns
) {
  for (const [field, text] of fields) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;

      const match =
        pattern.exec(text);

      if (match) {
        return {
          field,
          evidence_ref:
            field === "name"
              ? "N1"
              : field === "description"
                ? "D1"
                : field === "category_section"
                  ? "C1"
                  : field === "category_sorting"
                    ? "C2"
                    : field === "category_goal"
                      ? "C3"
                      : "C3",
          match_value:
            match[0],
          pattern:
            pattern.source,
          match_index:
            match.index,
        };
      }
    }
  }

  return null;
}

function buildCandidates(
  fields,
  definitions
) {
  const candidates = [];

  for (
    const [key, patterns]
    of definitions
  ) {
    const evidence =
      firstEvidence(
        fields,
        patterns
      );

    if (!evidence) {
      continue;
    }

    candidates.push({
      key,
      deterministic_confidence:
        "high",
      evidence,
    });
  }

  return candidates;
}

/*
 * These definitions are intentionally narrow.
 * They are evidence gates, not semantic classifiers.
 */
const POPULATION_DEFINITIONS = [
  ["JUVENTUD", [
    /\bJOVENES?\b/,
    /\bJUVENIL(?:ES)?\b/,
    /\bJUVENTUD\b/,
  ]],

  ["FAMILIAS", [
    /\bFAMILIAS?\b/,
    /\bFAMILIARES?\b/,
    /\bPADRES? Y MADRES?\b/,
    /\bMADRES? Y PADRES?\b/,
    /\bPADRES?\b/,
    /\bMADRES?\b/,
  ]],

  ["CUIDADORES", [
    /\bCUIDADORES?\b/,
    /\bCUIDADORAS?\b/,
  ]],

  ["PERSONAS_CON_DISCAPACIDAD", [
    /\bPERSONAS? CON DISCAPACIDAD\b/,
    /\bPERSONAS? DISCAPACITADAS?\b/,
  ]],

  ["PERSONAS_MAYORES", [
    /\bPERSONAS? MAYORES\b/,
    /\bTERCERA EDAD\b/,
  ]],

  ["INFANCIA", [
    /\bINFANCIA\b/,
    /\bINFANTIL(?:ES)?\b/,
    /\bNINOS?\b/,
    /\bNINAS?\b/,
  ]],

  ["ADOLESCENCIA", [
    /\bADOLESCENCIA\b/,
    /\bADOLESCENTES?\b/,
  ]],

  ["MUJERES", [
    /\bMUJERES?\b/,
    /\bFEMENIN(?:O|A|OS|AS)\b/,
  ]],

  ["MIGRANTES", [
    /\bMIGRANTES?\b/,
    /\bINMIGRANTES?\b/,
    /\bPERSONAS? MIGRADAS?\b/,
  ]],

  ["REFUGIADOS", [
    /\bREFUGIADOS?\b/,
    /\bREFUGIADAS?\b/,
    /\bSOLICITANTES? DE ASILO\b/,
  ]],

  ["PERSONAS_PRESAS", [
    /\bPERSONAS? PRESAS?\b/,
    /\bPOBLACION PENITENCIARIA\b/,
    /\bINTERNOS? PENITENCIARIOS?\b/,
  ]],

  ["PERSONAS_SIN_HOGAR", [
    /\bPERSONAS? SIN HOGAR\b/,
    /\bSINHOGARISMO\b/,
  ]],
];

const ACTIVITY_DEFINITIONS = [
  ["MUSICA", [
    /\bMUSICA\b/,
    /\bMUSICAL(?:ES)?\b/,
  ]],

  ["DANZA", [
    /\bDANZA\b/,
  ]],

  ["FOLKLORE", [
    /\bFOLKLORE\b/,
    /\bFOLCLOR(?:E|ICO|ICA|ICOS|ICAS)\b/,
  ]],

  ["ACTIVIDAD_VECINAL", [
    /\bVECINAL(?:ES)?\b/,
    /\bDE VECINOS\b/,
  ]],

  ["ACTIVIDAD_COMUNITARIA", [
    /\bCOMUNITARI(?:O|A|OS|AS)\b/,
    /\bCOMUNIDAD\b/,
    /\bVECINAL(?:ES)?\b/,
    /\bDE VECINOS\b/,
  ]],

  ["CULTURA_TRADICIONAL", [
    /\bCULTURA TRADICIONAL\b/,
    /\bTRADICIONES?\b/,
  ]],

  ["NATURALEZA", [
    /\bNATURALEZA\b/,
    /\bMEDIO NATURAL\b/,
  ]],

  ["JUEGOS", [
    /\bJUEGOS?\b/,
  ]],

  ["TIEMPO_LIBRE", [
    /\bTIEMPO LIBRE\b/,
  ]],

  ["CANTO", [
    /\bCANTO\b/,
    /\bCORAL(?:ES)?\b/,
    /\bCORO(?:S)?\b/,
  ]],

  ["TEATRO", [
    /\bTEATRO\b/,
    /\bTEATRAL(?:ES)?\b/,
  ]],

  ["CINE", [
    /\bCINE\b/,
    /\bCINEMATOGRAFI(?:A|CO|CA|COS|CAS)\b/,
  ]],

  ["LECTURA", [
    /\bLECTURA\b/,
    /\bLECTURAS\b/,
  ]],

  ["ESCRITURA", [
    /\bESCRITURA\b/,
    /\bESCRITURAS\b/,
  ]],

  ["ARTES_PLASTICAS", [
    /\bARTES? PLASTICAS?\b/,
    /\bPINTURA\b/,
    /\bESCULTURA\b/,
  ]],

  ["FOTOGRAFIA", [
    /\bFOTOGRAFIA\b/,
    /\bFOTOGRAFIC(?:O|A|OS|AS)\b/,
  ]],

  ["GASTRONOMIA", [
    /\bGASTRONOMIA\b/,
    /\bGASTRONOMIC(?:O|A|OS|AS)\b/,
  ]],

  ["MICOLOGIA", [
    /\bMICOLOGIA\b/,
    /\bMICOLOGIC(?:O|A|OS|AS)\b/,
  ]],

  ["ECOLOGIA", [
    /\bECOLOGIA\b/,
    /\bECOLOGIC(?:O|A|OS|AS)\b/,
  ]],

  ["SENDERISMO", [
    /\bSENDERISMO\b/,
  ]],

  ["DEPORTE", [
    /\bDEPORTE\b/,
    /\bDEPORTES\b/,
    /\bDEPORTIV(?:O|A|OS|AS)\b/,
  ]],

  ["ACTIVIDAD_FISICA", [
    /\bACTIVIDAD FISICA\b/,
    /\bEJERCICIO FISICO\b/,
  ]],

  ["COLECCIONISMO", [
    /\bCOLECCIONISMO\b/,
    /\bCOLECCIONISTAS?\b/,
  ]],

  ["FILATELIA", [
    /\bFILATELIA\b/,
    /\bFILATELIC(?:O|A|OS|AS)\b/,
  ]],

  ["OCIO", [
    /\bOCIO\b/,
  ]],

  ["VOLUNTARIADO", [
    /\bVOLUNTARIADO\b/,
    /\bVOLUNTARIOS?\b/,
    /\bVOLUNTARIAS?\b/,
  ]],

  ["ACTIVIDAD_INTERGENERACIONAL", [
    /\bINTERGENERACIONAL(?:ES)?\b/,
  ]],
];

export function buildAssociationSemanticCandidateGateV1({
  name = null,
  description = null,
  originalCategory = null,
  categorySection = null,
  categorySorting = null,
  categoryGoal = null,
} = {}) {
  const mapped =
    mapAssociationTagsV1({
      name,
      description,
      originalCategory,
    });

  const normalizedName =
    normalize(name);

  const normalizedDescription =
    normalize(description);

  const normalizedCategorySection =
    normalize(
      categorySection
    );

  const normalizedCategorySorting =
    normalize(
      categorySorting
    );

  const normalizedCategoryGoal =
    normalize(
      categoryGoal
    );

  const normalizedOriginalCategory =
    normalize(
      originalCategory
    );

  const fields = [
    [
      "name",
      normalizedName,
    ],
    [
      "description",
      normalizedDescription,
    ],
    [
      "category_section",
      normalizedCategorySection,
    ],
    [
      "category_sorting",
      normalizedCategorySorting,
    ],
    [
      "category_goal",
      normalizedCategoryGoal,
    ],
    [
      "original_category",
      normalizedOriginalCategory,
    ],
  ];

  const needCandidates =
    mapped.tags.map(
      tag => ({
        key:
          tag.key,

        deterministic_confidence:
          tag.confidence,

        evidence: {
          field:
            tag.evidence?.field
            ?? null,

          match_value:
            tag.evidence?.match_value
            ?? null,

          pattern:
            tag.evidence?.pattern
            ?? null,

          match_index:
            tag.evidence?.match_index
            ?? null,
        },
      })
    );

  return {
    format_version: 1,

    needs: {
      candidates:
        needCandidates,
      allow_suggested:
        true,
    },

    populations: {
      candidates:
        buildCandidates(
          fields,
          POPULATION_DEFINITIONS
        ),
      allow_suggested:
        true,
    },

    activities: {
      candidates:
        buildCandidates(
          fields,
          ACTIVITY_DEFINITIONS
        ),
      allow_suggested:
        true,
    },
  };
}
