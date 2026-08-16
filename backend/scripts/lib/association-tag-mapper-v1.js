function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("es-ES")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SERVICE_PATTERNS = [
  /\bATENDER\b/,
  /\bATENCION\b/,
  /\bASISTENCIA\b/,
  /\bASISTIR\b/,
  /\bAPOYAR\b/,
  /\bAPOYO\b/,
  /\bAYUDAR\b/,
  /\bAYUDA\b/,
  /\bACOMPANAR\b/,
  /\bACOMPANAMIENTO\b/,
  /\bORIENTAR\b/,
  /\bORIENTACION\b/,
  /\bASESORAR\b/,
  /\bASESORAMIENTO\b/,
  /\bREHABILITAR\b/,
  /\bREHABILITACION\b/,
  /\bTRATAMIENTO\b/,
  /\bTERAPIA\b/,
  /\bINTERVENCION\b/,
  /\bPRESTAR\b/,
  /\bOFRECER\b/,
  /\bPROPORCIONAR\b/,
  /\bFACILITAR\b/,
  /\bFORMAR\b/,
  /\bFORMACION\b/,
  /\bACOGER\b/,
  /\bACOGIDA\b/,
  /\bREINSERCION\b/,
  /\bSERVICIOS?\b/,
  /\bRECURSOS?\b/,
  /\bMEJORAR LA CALIDAD DE VIDA\b/,
  /\bDEFENSA DE LOS DERECHOS\b/,
  /\bDEFENDER LOS DERECHOS\b/,
  /\bINTEGRACION SOCIAL\b/,
  /\bINCLUSION SOCIAL\b/,
];

const SERVICE_WINDOW_CHARS = 240;

function findPatternMatch(
  text,
  patterns
) {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;

    const match =
      pattern.exec(text);

    if (match) {
      return {
        pattern,
        index: match.index,
        value: match[0],
      };
    }
  }

  return null;
}

function hasNearbyServiceEvidence(
  text,
  matchIndex,
  matchLength
) {
  const start =
    Math.max(
      0,
      matchIndex -
      SERVICE_WINDOW_CHARS
    );

  const end =
    Math.min(
      text.length,
      matchIndex +
      matchLength +
      SERVICE_WINDOW_CHARS
    );

  const window =
    text.slice(
      start,
      end
    );

  return SERVICE_PATTERNS.some(
    pattern => {
      pattern.lastIndex = 0;
      return pattern.test(window);
    }
  );
}

const DEFINITIONS = [
  // Enfermedades y condiciones concretas.
  ["ELA", [
    /\bESCLEROSIS LATERAL AMIOTROFICA\b/,
    /\bELA\b/,
  ]],

  ["ESCLEROSIS_MULTIPLE", [
    /\bESCLEROSIS MULTIPLE\b/,
  ]],

  ["FIBROSIS_QUISTICA", [
    /\bFIBROSIS QUISTICA\b/,
  ]],

  ["CELIAQUIA", [
    /\bCELIAQUI/,
    /\bCELIAC/,
  ]],

  ["HEMOFILIA", [
    /\bHEMOFILIA\b/,
    /\bCOAGULOPATIAS CONGENITAS\b/,
  ]],

  ["LINFEDEMA_LIPEDEMA", [
    /\bLINFEDEMA\b/,
    /\bLIPEDEMA\b/,
    /\bFLEBEDEMA\b/,
  ]],

  ["NEUROFIBROMATOSIS", [
    /\bNEUROFIBROMATOSIS\b/,
  ]],

  ["ARTRITIS_ESPONDILITIS", [
    /\bARTRITIS REUMATOIDE\b/,
    /\bESPONDILITIS\b/,
  ]],

  ["PSORIASIS", [
    /\bPSORIASIS\b/,
    /\bARTRITIS PSORIASICA\b/,
  ]],

  ["SENSIBILIDAD_QUIMICA", [
    /\bSENSIBILIDAD QUIMICA\b/,
  ]],

  ["HEPATITIS", [
    /\bHEPATITIS(?:\s+[A-Z])?\b/,
  ]],

  ["RETINOSIS_PIGMENTARIA", [
    /\bRETINOSIS PIGMENTARIA\b/,
    /\bDISTROFIA HEREDITARIA DE RETINA\b/,
  ]],

  ["AUTISMO", [
    /\bAUTISMO\b/,
    /\bTRASTORNO DEL ESPECTRO DEL AUTISMO\b/,
    /\bTEA\b/,
  ]],

  ["TDAH", [
    /\bTDAH\b/,
    /\bDEFICIT DE ATENCION\b/,
    /\bHIPERACTIVIDAD\b/,
  ]],

  ["DISLEXIA", [
    /\bDISLEXIA\b/,
    /\bPROBLEMAS DE LECTOESCRITURA\b/,
  ]],

  ["ALZHEIMER", [
    /\bALZHEIMER\b/,
  ]],

  ["PARKINSON", [
    /\bPARKINSON\b/,
    /\bPARCKINSON\b/,
  ]],

  ["CANCER_INFANTIL", [
    /\bCANCER INFANTIL\b/,
    /\bNINOS(?: Y NINAS)? CON CANCER\b/,
  ]],

  ["CANCER", [
    /\bCANCER\b/,
    /\bONCOLOG/,
  ]],

  ["DIABETES", [
    /\bDIABET/,
  ]],

  ["ENFERMEDAD_RENAL", [
    /\bENFERMEDAD(?:ES)? RENAL/,
    /\bINSUFICIENCIA RENAL\b/,
    /\bDIALISIS\b/,
    /\bNEFRO/,
  ]],

  ["FIBROMIALGIA_FATIGA_CRONICA", [
    /\bFIBROMIALGIA\b/,
    /\bSINDROME DE FATIGA CRONICA\b/,
    /\bCANSANCIO CRONICO\b/,
  ]],

  ["LUPUS", [
    /\bLUPUS\b/,
  ]],

  ["CROHN_COLITIS", [
    /\bCROHN\b/,
    /\bCOLITIS ULCEROSA\b/,
  ]],

  ["PARALISIS_CEREBRAL", [
    /\bPARALISIS CEREBRAL\b/,
  ]],

  ["DANO_CEREBRAL_ADQUIRIDO", [
    /\bDANO CEREBRAL ADQUIRIDO\b/,
  ]],

  ["ESPINA_BIFIDA_HIDROCEFALIA", [
    /\bESPINA BIFIDA\b/,
    /\bHIDROCEFALIA\b/,
  ]],

  ["ENFERMEDADES_NEUROMUSCULARES", [
    /\bENFERMEDAD(?:ES)? NEUROMUSCULAR/,
    /\bENFERMOS NEUROMUSCULARES\b/,
  ]],

  ["DISCAPACIDAD_AUDITIVA", [
    /\bSORDOS?\b/,
    /\bDISCAPACIDAD AUDITIVA\b/,
    /\bDEFICIENTES AUDITIVOS\b/,
    /\bDEFICIENCIAS? AUDITIVAS?\b/,
    /\bIMPLANTADOS COCLEARES\b/,
  ]],

  ["DISCAPACIDAD_INTELECTUAL", [
    /\bDISCAPACIDAD INTELECTUAL\b/,
    /\bDISMINUIDOS PSIQUICOS\b/,
    /\bSINDROME DE DOWN\b/,
  ]],

  ["SALUD_MENTAL", [
    /\bSALUD MENTAL\b/,
    /\bENFERMEDAD(?:ES)? MENTAL(?:ES)?\b/,
    /\bENFERMOS? MENTALES?\b/,
    /\bTRASTORNO(?:S)? MENTAL(?:ES)?\b/,
  ]],

  ["DISCAPACIDAD_FISICA", [
    /\bDISCAPACIDAD FISICA\b/,
    /\bDISMINUIDOS FISICOS\b/,
    /\bMINUSVALIDOS FISICOS\b/,
  ]],

  ["DISCAPACIDAD", [
    /\bPERSONAS? CON DISCAPACIDAD\b/,
    /\bCUALQUIER OTRA DISCAPACIDAD\b/,
    /\bDISCAPACIDAD GENERAL\b/,
  ]],

  ["ADICCIONES_COMPORTAMENTALES", [
    /\bADICCIONES COMPORTAMENTALES\b/,
    /\bADICCIONES SIN SUSTANCIA\b/,
  ]],

  ["TRASTORNOS_ALIMENTARIOS", [
    /\bANOREXIA\b/,
    /\bBULIMIA\b/,
    /\bTRASTORNO(?:S)? DE LA CONDUCTA ALIMENTARIA\b/,
    /\bTCA\b/,
  ]],

  ["TRASTORNO_BIPOLAR", [
    /\bTRASTORNO(?:S)? BIPOLAR/,
  ]],

  ["ALCOHOLISMO", [
    /\bALCOHOLISMO\b/,
    /\bALCOHOLICOS\b/,
  ]],

  ["LUDOPATIA", [
    /\bLUDOPAT/,
    /\bJUEGO PATOLOGICO\b/,
  ]],

  // Sociales: solo expresiones bastante explícitas.
  ["VIOLENCIA_GENERO", [
    /\bVIOLENCIA DE GENERO\b/,
    /\bVIOLENCIA MACHISTA\b/,
    /\bVIOLENCIA SEXISTA\b/,
    /\bMALOS TRATOS\b/,
  ]],

  ["ACOSO_LABORAL", [
    /\bACOSO LABORAL\b/,
    /\bACOSO MORAL EN EL TRABAJO\b/,
    /\bMOBBING\b/,
  ]],

  ["ACOSO_ESCOLAR", [
    /\bACOSO ESCOLAR\b/,
    /\bBULLYING\b/,
  ]],

  ["SOLEDAD_NO_DESEADA", [
    /\bSOLEDAD NO DESEADA\b/,
  ]],

  ["SIN_HOGAR", [
    /\bSIN HOGAR\b/,
    /\bPERSONAS SIN TECHO\b/,
  ]],

  ["PERSONAS_PRESAS", [
    /\bPERSONAS PRESAS\b/,
    /\bPERSONAS PRIVADAS DE LIBERTAD\b/,
    /\bREINSERCION DE PRESOS\b/,
  ]],

  ["INMIGRACION_REFUGIO", [
    /\bPERSONAS MIGRANTES\b/,
    /\bINMIGRANTES\b/,
    /\bREFUGIADOS\b/,
    /\bREFUGIADAS\b/,
    /\bDERECHO DE ASILO\b/,
  ]],

  ["INSERCION_LABORAL", [
    /\bINSERCION LABORAL\b/,
    /\bINCLUSION LABORAL\b/,
    /\bINTEGRACION SOCIOLABORAL\b/,
    /\bINTEGRACION SOCIO LABORAL\b/,
    /\bEMPLEO PROTEGIDO\b/,
  ]],

  ["EXCLUSION_SOCIAL", [
    /\bEXCLUSION SOCIAL\b/,
    /\bRIESGO DE EXCLUSION\b/,
    /\bMARGINACION SOCIAL\b/,
  ]],

  ["POBREZA_NECESIDADES_BASICAS", [
    /\bPOBREZA\b/,
    /\bBANCO DE ALIMENTOS\b/,
    /\bNECESIDADES BASICAS\b/,
  ]],

  ["DEPENDENCIA", [
    /\bGRAN DEPENDENCIA\b/,
    /\bPERSONAS DEPENDIENTES\b/,
    /\bSITUACION DE DEPENDENCIA\b/,
  ]],

  ["ACOGIMIENTO_FAMILIAR", [
    /\bACOGIMIENTO FAMILIAR\b/,
    /\bFAMILIAS DE ACOGIDA\b/,
  ]],

  ["ADOPCION", [
    /\bFAMILIAS ADOPTIVAS\b/,
    /\bNINO ADOPTADO\b/,
    /\bNINOS ADOPTADOS\b/,
  ]],

  ["MEDIACION_FAMILIAR", [
    /\bMEDIACION FAMILIAR\b/,
    /\bCRISIS FAMILIARES\b/,
  ]],
];

function uniqueTags(matches) {
  const byKey = new Map();

  for (const match of matches) {
    if (!byKey.has(match.key)) {
      byKey.set(
        match.key,
        match
      );
    }
  }

  return [...byKey.values()];
}

export function mapAssociationTagsV1({
  name,
  description,
  originalCategory,
} = {}) {
  const normalizedName =
    normalize(name);

  const normalizedDescription =
    normalize(description);

  const normalizedCategory =
    normalize(originalCategory);

  /*
   * Nombre y finalidad tienen más valor que
   * la categoría administrativa genérica.
   */
  const fields = [
    ["name", normalizedName],
    ["description", normalizedDescription],
  ];

  const matches = [];

  for (
    const [key, patterns]
    of DEFINITIONS
  ) {
    let evidence = null;

    for (
      const [field, text]
      of fields
    ) {
      const matched =
        findPatternMatch(
          text,
          patterns
        );

      if (matched) {
        evidence = {
          field,
          pattern:
            matched.pattern.source,
          match_index:
            matched.index,
          match_value:
            matched.value,
        };
        break;
      }
    }

    if (!evidence) {
      continue;
    }

    const confidence =
      evidence.field === "name"
        ? "high"
        : hasNearbyServiceEvidence(
            normalizedDescription,
            evidence.match_index,
            evidence.match_value.length
          )
          ? "high"
          : "review";

    matches.push({
      key,
      confidence,
      evidence,
    });
  }

  /*
   * Algunos tags implican un padre útil,
   * pero no añadimos automáticamente padres
   * al array: la jerarquía vive en taxonomy.
   */
  return {
    version: "1.0",
    tags:
      uniqueTags(matches),
    unmapped:
      matches.length === 0,
    evidence: {
      normalized_name:
        normalizedName,
      normalized_category:
        normalizedCategory,
    },
  };
}
