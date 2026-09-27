function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("es-ES")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(text, patterns) {
  return patterns.some(
    pattern => pattern.test(text)
  );
}

function distinct(values) {
  return [
    ...new Set(
      values.filter(Boolean)
    ),
  ];
}

/*
 * Categorías cuya finalidad registral ya es
 * suficientemente específica para HelpChat.
 *
 * Estas no necesitan inferencia semántica
 * adicional para superar la criba de relevancia.
 */
const DIRECT_CATEGORY_PATTERNS = [
  /\bAYUDA A ENFERMOS\b/,
  /\bAYUDA A OTROS COLECTIVOS\b/,
  /\bAYUDA A GRUPOS MARGINADOS\b/,
  /\bAYUDA A MINUSVALIDOS\b/,
  /\bAYUDA A DISMINUIDOS PSIQUICOS\b/,
  /\bAYUDA A ANCIANOS\b/,
  /\bAYUDA A DROGADICTOS\b/,
  /\bAYUDA A ALCOHOLICOS\b/,
  /\bPADRES DE ENFERMOS\b/,
  /\bTERCERA EDAD\b/,
  /\bASISTENCIA SOCIAL\b/,
  /\bASSISTENCIA SOCIAL\b/,
  /\bASSISTENCIAL\b/,
  /\bSALUD\b/,
  /\bSANITAT\b/,
  /\bDISCAPACIT/,
  /\bMOVIMIENTOS MIGRATORIOS\b/,
  /\bDERECHOS HUMANOS\b/,
  /\bPREVENCION Y REHABILITACION DE ADICCIONES/,
  /\bPROMOCION DEL MENOR\b/,
  /\bPROMOCION DE EMPLEO\b/,
  /\bAYUDA A ACCID/,
  /\bDE VIUDOS/,
  /\bDE DIVORCIADOS/,
  /\bMADRES SOLTERAS\b/,
];

/*
 * Categorías que pueden contener recursos útiles,
 * pero que jamás deben conservarse solo por la
 * categoría.
 */
const CONTEXTUAL_CATEGORY_PATTERNS = [
  /\bPROMOCION CULTURAL\b/,
  /\bDE VECINOS\b/,
  /\bVEINS\b/,
  /\bVECINOS Y COMERCIANTES\b/,
  /\bDEPORTIV/,
  /\bESPORT\b/,
  /\bJUVENIL/,
  /\bDE TIEMPO LIBRE\b/,
  /\bTIEMPO LIBRE\b/,
  /\bPADRES DE FAMILIA\b/,
  /\bPROMOCION DE LA MUJER\b/,
  /\bDONA\b/,
  /\bPARTICIPACION SOCIAL\b/,
  /\bSOLIDARIDAD INTERNACIONAL\b/,
  /\bCOOPERACION DESARROLLO\b/,
  /\bRELIGIOS/,
  /\bDESARROLLO COMUNITARIO\b/,
];

/*
 * Necesidad, colectivo o problemática.
 *
 * Por sí solos NO convierten una asociación
 * en recurso HelpChat.
 */
const NEED_PATTERNS = [
  /\bDISCAPACIT/,
  /\bDEPENDENCI/,
  /\bENFERM/,
  /\bPACIENT/,
  /\bSALUD MENTAL\b/,
  /\bADICCION/,
  /\bDROGODEPEND/,
  /\bTOXICOMAN/,
  /\bALCOHOLIS/,
  /\bCANCER\b/,
  /\bALZHEIMER\b/,
  /\bAUTIS/,
  /\bPARKINSON\b/,
  /\bDIABET/,
  /\bFIBROMIALG/,
  /\bESCLEROSIS\b/,
  /\bPARALISIS CEREBRAL\b/,
  /\bSINDROME DE DOWN\b/,
  /\bEXCLUSION SOCIAL\b/,
  /\bPOBREZA\b/,
  /\bSIN HOGAR\b/,
  /\bVULNERAB/,
  /\bINMIGR/,
  /\bMIGRANT/,
  /\bREFUGIAD/,
  /\bASILO\b/,
  /\bVIOLENCIA DE GENERO\b/,
  /\bVIOLENCIA MACHISTA\b/,
  /\bMALTRATO\b/,
  /\bCUIDADOR/,
  /\bPERSONAS MAYORES\b/,
  /\bTERCERA EDAD\b/,
  /\bINFANCIA\b/,
  /\bMENORES\b/,
];

/*
 * Acción que evidencia que la entidad realmente
 * presta o promueve una respuesta a una necesidad.
 */
const SERVICE_PATTERNS = [
  /\bAYUD/,
  /\bAPOYO\b/,
  /\bAPOYAR\b/,
  /\bATENCION\b/,
  /\bATENDER\b/,
  /\bASISTEN/,
  /\bTRATAMIENTO\b/,
  /\bREHABILIT/,
  /\bRECUPERACION\b/,
  /\bACOMPAN/,
  /\bACOGID/,
  /\bORIENTA/,
  /\bASESORA/,
  /\bINSERCION\b/,
  /\bINCLUSION\b/,
  /\bINCLUSIV/,
  /\bINTEGRACION\b/,
  /\bINTEGRAR\b/,
  /\bPROTECCION\b/,
  /\bPREVENCION\b/,
  /\bCUIDADO\b/,
  /\bDEFENSA DE (?:LOS )?DERECHOS\b/,
  /\bSERVICIOS? SOCIALES?\b/,
  /\bSERVICIO ASISTENCIAL\b/,
];

/*
 * Algunas finalidades son suficientemente
 * explícitas aunque el texto no use una pareja
 * necesidad + servicio.
 */
const HARD_DIRECT_PURPOSE_PATTERNS = [
  /\bDEPORTE ADAPTADO\b/,
  /\bACTIVIDAD FISICA ADAPTADA\b/,
  /\bOCIO INCLUSIVO\b/,
  /\bDEPORTE INCLUSIVO\b/,
  /\bSALUD COMUNITARIA\b/,
  /\bSERVICIOS SOCIALES\b/,
  /\bASISTENCIA SOCIAL\b/,
  /\bAYUDA HUMANITARIA\b/,
  /\bBANCO DE ALIMENTOS\b/,
  /\bPERSONAS SIN HOGAR\b/,
  /\bINSERCION LABORAL\b/,
  /\bINCLUSION LABORAL\b/,
  /\bEMPLEO PROTEGIDO\b/,
  /\bVIOLENCIA DE GENERO\b/,
  /\bVIOLENCIA MACHISTA\b/,
  /\bDERECHO DE ASILO\b/,
];

const DIRECT_PURPOSE_PATTERNS = [
  /\bASISTENCIA SOCIAL\b/,
  /\bSERVICIOS SOCIALES\b/,
  /\bAYUDA HUMANITARIA\b/,
  /\bBANCO DE ALIMENTOS\b/,
  /\bEXCLUSION SOCIAL\b/,
  /\bPERSONAS SIN HOGAR\b/,
  /\bSALUD COMUNITARIA\b/,
  /\bSALUD MENTAL\b/,
  /\bINSERCION LABORAL\b/,
  /\bINCLUSION LABORAL\b/,
  /\bEMPLEO PROTEGIDO\b/,
  /\bVIOLENCIA DE GENERO\b/,
  /\bVIOLENCIA MACHISTA\b/,
  /\bDERECHO DE ASILO\b/,
];

/*
 * Evidencia que evita un DROP automático,
 * pero que tampoco basta para KEEP.
 *
 * Deliberadamente no incluimos solamente
 * "infancia", "juventud" o "tercera edad".
 */
const SOCIAL_REVIEW_PATTERNS = [
  /\bDISCAPACIT/,
  /\bDEPENDENCI/,
  /\bENFERM/,
  /\bPACIENT/,
  /\bSALUD MENTAL\b/,
  /\bADICCION/,
  /\bDROGODEPEND/,
  /\bTOXICOMAN/,
  /\bALCOHOLIS/,
  /\bEXCLUSION\b/,
  /\bPOBREZA\b/,
  /\bSIN HOGAR\b/,
  /\bVULNERAB/,
  /\bINMIGR/,
  /\bMIGRANT/,
  /\bREFUGIAD/,
  /\bASILO\b/,
  /\bMALTRATO\b/,
  /\bSERVICIOS SOCIALES\b/,
  /\bAYUDA HUMANITARIA\b/,
];

/*
 * Categorías que podemos sacar de runtime con
 * alta confianza cuando sus finalidades no
 * muestran una función social contradictoria.
 */
const STRONG_OUT_OF_SCOPE_PATTERNS = [
  /\bGASTRONOM/,
  /\bMICOL/,
  /\bFILATEL/,
  /\bNUMISMAT/,
  /\bTAURIN/,
  /\bRADIOAFICION/,
  /\bCOLECCIONISMO\b/,
  /\bPENAS? TAURIN/,
  /\bFUTBOL PENAS\b/,
  /\bPROPIETARIOS DE URBANIZACION/,
  /\bPROPIETARIS D URBANITZACIO/,
  /\bCORAL/,
  /\bFOLKLORE\b/,
  /\bMUSICA DANZA FOLKLORE\b/,
  /\bTEATRO\b/,
  /\bCINEMATOGRAF/,
  /\bFOTOGRAFIA\b/,
  /\bBELLAS ARTES\b/,
  /\bRECREATIVAS?\b/,
];

function buildTextSegments(values) {
  const segments = [];

  for (const value of values) {
    const raw = String(
      value ?? ""
    );

    for (
      const fragment
      of raw.split(/[.\n;|]+/)
    ) {
      const normalized =
        normalize(fragment);

      if (normalized) {
        segments.push(
          normalized
        );
      }
    }
  }

  return segments;
}

/*
 * Comprobamos parejas dentro de fragmentos
 * próximos para evitar que una necesidad
 * mencionada en un extremo de unos estatutos
 * se relacione artificialmente con un servicio
 * citado cientos de palabras después.
 */
function buildTextWindows(segments) {
  const result = [];

  for (
    let index = 0;
    index < segments.length;
    index += 1
  ) {
    result.push(
      [
        segments[index],
        segments[index + 1],
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  return result;
}

function hasNeedServicePair(windows) {
  return windows.some(
    window =>
      matchesAny(
        window,
        NEED_PATTERNS
      ) &&
      matchesAny(
        window,
        SERVICE_PATTERNS
      )
  );
}

export function classifyAssociationRelevance({
  name = null,
  categories = [],
  text = [],
} = {}) {
  /*
   * El nombre se acepta como metadata pero NO se
   * mezcla con la evidencia semántica.
   *
   * Evita falsos positivos como una banda llamada
   * "Cancer..." sin actividad sanitaria.
   */
  const normalizedName =
    normalize(name);

  const normalizedCategories =
    distinct(
      categories.map(
        normalize
      )
    );

  const categoryBlob =
    normalizedCategories.join(
      " | "
    );

  const segments =
    buildTextSegments(
      text
    );

  const windows =
    buildTextWindows(
      segments
    );

  const textBlob =
    segments.join(
      " | "
    );

  const directCategory =
    matchesAny(
      categoryBlob,
      DIRECT_CATEGORY_PATTERNS
    );

  const hardDirectPurpose =
    matchesAny(
      textBlob,
      HARD_DIRECT_PURPOSE_PATTERNS
    );

  const directPurpose =
    matchesAny(
      textBlob,
      DIRECT_PURPOSE_PATTERNS
    );

  const needServicePair =
    hasNeedServicePair(
      windows
    );

  const contextualCategory =
    matchesAny(
      categoryBlob,
      CONTEXTUAL_CATEGORY_PATTERNS
    );

  const strongOutOfScope =
    matchesAny(
      categoryBlob,
      STRONG_OUT_OF_SCOPE_PATTERNS
    );

  const socialReviewSignal =
    matchesAny(
      textBlob,
      SOCIAL_REVIEW_PATTERNS
    );

  if (directCategory) {
    return {
      status:
        "direct_relevance",
      decision:
        "keep",
      confidence:
        "high",
      reasons: [
        "direct_category",
      ],
      evidence: {
        normalized_name:
          normalizedName || null,
      },
    };
  }

  if (hardDirectPurpose) {
    return {
      status:
        "direct_relevance",
      decision:
        "keep",
      confidence:
        "high",
      reasons: [
        "hard_direct_purpose",
      ],
      evidence: {
        normalized_name:
          normalizedName || null,
      },
    };
  }

  /*
   * Una actividad primordialmente cultural,
   * artística o recreativa puede ser útil,
   * pero una mención asistencial secundaria
   * no basta para convertirla en recurso
   * directo del runtime.
   */
  if (
    strongOutOfScope &&
    (
      directPurpose ||
      needServicePair ||
      socialReviewSignal
    )
  ) {
    return {
      status:
        "contextual_relevance",
      decision:
        "review",
      confidence:
        "medium",
      reasons: distinct([
        directPurpose
          ? "direct_purpose"
          : null,
        needServicePair
          ? "need_service_pair"
          : null,
        socialReviewSignal
          ? "social_signal"
          : null,
        "out_of_scope_primary_activity",
      ]),
      evidence: {
        normalized_name:
          normalizedName || null,
      },
    };
  }

  if (
    directPurpose ||
    needServicePair
  ) {
    return {
      status:
        "direct_relevance",
      decision:
        "keep",
      confidence:
        "high",
      reasons: distinct([
        directPurpose
          ? "direct_purpose"
          : null,
        needServicePair
          ? "need_service_pair"
          : null,
      ]),
      evidence: {
        normalized_name:
          normalizedName || null,
      },
    };
  }

  if (contextualCategory) {
    return {
      status:
        "contextual_relevance",
      decision:
        "review",
      confidence:
        "medium",
      reasons: [
        "contextual_category",
      ],
      evidence: {
        normalized_name:
          normalizedName || null,
      },
    };
  }

  /*
   * Una categoría recreativa/cultural con señal
   * social real no se elimina automáticamente.
   * Va a revisión.
   */
  if (
    strongOutOfScope &&
    socialReviewSignal
  ) {
    return {
      status:
        "needs_review",
      decision:
        "review",
      confidence:
        "medium",
      reasons: [
        "out_of_scope_category_with_social_signal",
      ],
      evidence: {
        normalized_name:
          normalizedName || null,
      },
    };
  }

  if (strongOutOfScope) {
    return {
      status:
        "out_of_scope",
      decision:
        "drop",
      confidence:
        "high",
      reasons: [
        "strong_out_of_scope_category",
      ],
      evidence: {
        normalized_name:
          normalizedName || null,
      },
    };
  }

  return {
    status:
      "needs_review",
    decision:
      "review",
    confidence:
      "low",
    reasons: [
      "insufficient_evidence",
    ],
    evidence: {
      normalized_name:
        normalizedName || null,
    },
  };
}
