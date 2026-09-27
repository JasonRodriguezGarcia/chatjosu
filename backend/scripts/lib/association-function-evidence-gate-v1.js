function normalize(value) {
  return String(
    value ?? ""
  )
    .normalize("NFD")
    .replace(
      /\p{Diacritic}/gu,
      ""
    )
    .toLocaleUpperCase(
      "es-ES"
    )
    .replace(
      /[^A-Z0-9]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

const DEFINITIONS = [
  [
    "INFORMACION",
    [
      /\bINFORMAR\b/,
      /\bINFORMACION\b/,
      /\bINFORMATIV(?:O|A|OS|AS)\b/,
    ],
  ],

  [
    "ORIENTACION",
    [
      /\bORIENTAR\b/,
      /\bORIENTACION\b/,
    ],
  ],

  [
    "ASESORAMIENTO",
    [
      /\bASESORAR\b/,
      /\bASESORAMIENTO\b/,
      /\bASESORIA\b/,
    ],
  ],

  [
    "ASESORAMIENTO_JURIDICO",
    [
      /\bASESORAMIENTO JURIDICO\b/,
      /\bASESORIA JURIDICA\b/,
      /\bASESORAR\b.{0,60}\bJURIDIC/,
      /\bJURIDIC(?:O|A|OS|AS)\b.{0,60}\bASESOR/,
    ],
  ],

  [
    "APOYO_PSICOLOGICO",
    [
      /\bAPOYO PSICOLOGICO\b/,
      /\bATENCION PSICOLOGICA\b/,
      /\bASISTENCIA PSICOLOGICA\b/,
    ],
  ],

  [
    "APOYO_SOCIAL",
    [
      /\bAPOYO SOCIAL\b/,
      /\bAPOYOS SOCIALES\b/,
      /\bASISTENCIA SOCIAL\b/,
    ],
  ],

  [
    "ACOMPANAMIENTO",
    [
      /\bACOMPANAMIENTO\b/,
      /\bACOMPANAR\b/,
    ],
  ],

  [
    "ACOGIDA",
    [
      /\bACOGIDA\b/,
      /\bSERVICIO DE ACOGIDA\b/,
    ],
  ],

  [
    "ALOJAMIENTO",
    [
      /\bALOJAMIENTO\b/,
      /\bALOJAMIENTOS\b/,
      /\bRESIDENCIA TEMPORAL\b/,
    ],
  ],

  [
    "ALIMENTACION",
    [
      /\bALIMENTACION\b/,
      /\bCOMEDOR SOCIAL\b/,
      /\bBANCO DE ALIMENTOS\b/,
      /\bREPARTO DE ALIMENTOS\b/,
    ],
  ],

  [
    "AYUDA_ECONOMICA",
    [
      /\bAYUDA ECONOMICA\b/,
      /\bAYUDAS ECONOMICAS\b/,
      /\bAPOYO ECONOMICO\b/,
    ],
  ],

  [
    "NECESIDADES_BASICAS",
    [
      /\bNECESIDADES BASICAS\b/,
      /\bBIENES DE PRIMERA NECESIDAD\b/,
    ],
  ],

  [
    "REHABILITACION",
    [
      /\bREHABILITACION\b/,
      /\bREHABILITAR\b/,
    ],
  ],

  [
    "TERAPIA",
    [
      /\bTERAPIA\b/,
      /\bTERAPIAS\b/,
      /\bTERAPEUTIC(?:O|A|OS|AS)\b/,
    ],
  ],

  [
    "ATENCION_SANITARIA",
    [
      /\bATENCION SANITARIA\b/,
      /\bASISTENCIA SANITARIA\b/,
      /\bATENCION MEDICA\b/,
      /\bASISTENCIA MEDICA\b/,
    ],
  ],

  [
    "ATENCION_DOMICILIARIA",
    [
      /\bATENCION DOMICILIARIA\b/,
      /\bAYUDA A DOMICILIO\b/,
      /\bASISTENCIA DOMICILIARIA\b/,
      /\bSERVICIO DOMICILIARIO\b/,
    ],
  ],

  [
    "RESPIRO_FAMILIAR",
    [
      /\bRESPIRO FAMILIAR\b/,
      /\bSERVICIO DE RESPIRO\b/,
    ],
  ],

  [
    "FORMACION",
    [
      /\bFORMACION\b/,
      /\bFORMAR A\b/,
      /\bFORMAR PERSONAS\b/,
      /\bCAPACITACION\b/,
      /\bCURSOS? FORMATIVOS?\b/,
    ],
  ],

  [
    "EMPLEO_INSERCION",
    [
      /\bINSERCION LABORAL\b/,
      /\bINTEGRACION LABORAL\b/,
      /\bINTEGRACION SOCIOLABORAL\b/,
      /\bINTEGRACION SOCIO LABORAL\b/,
      /\bEMPLEABILIDAD\b/,
      /\bACCESO AL EMPLEO\b/,
    ],
  ],

  [
    "MEDIACION",
    [
      /\bMEDIACION\b/,
      /\bMEDIAR\b/,
    ],
  ],

  [
    "OCIO_INCLUSIVO",
    [
      /\bOCIO INCLUSIVO\b/,
      /\bOCIO ADAPTADO\b/,
      /\bOCIO ACCESIBLE\b/,
      /\bACTIVIDADES? INCLUSIVAS?\b/,
      /\bINTEGRACION\b.{0,80}\bOCIO\b/,
      /\bOCIO\b.{0,80}\bINTEGRACION\b/,
    ],
  ],

  [
    "TRANSPORTE",
    [
      /\bTRANSPORTE ADAPTADO\b/,
      /\bSERVICIO DE TRANSPORTE\b/,
      /\bTRASLADO DE PERSONAS\b/,
    ],
  ],

  [
    "DEFENSA_DERECHOS",
    [
      /\bDEFENSA DE (?:LOS )?DERECHOS\b/,
      /\bDEFENDER (?:LOS )?DERECHOS\b/,
      /\bPROTECCION DE (?:LOS )?DERECHOS\b/,
      /\bREIVINDICAR\b.{0,80}\bDERECHOS\b/,
    ],
  ],

  [
    "REPRESENTACION",
    [
      /\bREPRESENTACION\b/,
      /\bREPRESENTAR A\b/,
      /\bREPRESENTAR LOS INTERESES\b/,
      /\bREPRESENTAR SUS INTERESES\b/,
    ],
  ],

  [
    "SENSIBILIZACION",
    [
      /\bSENSIBILIZAR\b/,
      /\bSENSIBILIZACION\b/,
      /\bCONCIENCIAR\b/,
      /\bCONCIENCIACION\b/,
    ],
  ],

  [
    "INVESTIGACION",
    [
      /\bINVESTIGAR\b/,
      /\bINVESTIGACION\b/,
      /\bINVESTIGACIONES\b/,
      /\bESTUDIO CIENTIFICO\b/,
      /\bESTUDIOS? EPIDEMIOLOGICOS?\b/,
    ],
  ],

  [
    "RECAUDACION_FONDOS",
    [
      /\bRECAUDACION DE FONDOS\b/,
      /\bRECAUDAR FONDOS\b/,
      /\bCAPTACION DE FONDOS\b/,
      /\bCAPTAR FONDOS\b/,
    ],
  ],

  [
    "VOLUNTARIADO",
    [
      /\bVOLUNTARIADO\b/,
      /\bPERSONAS? VOLUNTARIAS?\b/,
      /\bPERSONAS? VOLUNTARIOS?\b/,
      /\bVOLUNTARIOS?\b/,
      /\bVOLUNTARIAS?\b/,
    ],
  ],
];

export const FUNCTION_EVIDENCE_GATED_KEYS_V1 =
  DEFINITIONS.map(
    ([key]) => key
  );

export function buildAssociationFunctionEvidenceGateV1({
  name = null,
  description = null,
  categorySection = null,
  categorySorting = null,
  categoryGoal = null,
} = {}) {
  const fields = [
    ["N1", normalize(name)],
    ["D1", normalize(description)],
    ["C1", normalize(categorySection)],
    ["C2", normalize(categorySorting)],
    ["C3", normalize(categoryGoal)],
  ];

  const candidates = [];

  for (
    const [
      key,
      patterns,
    ]
    of DEFINITIONS
  ) {
    let found = null;

    for (
      const [
        evidenceRef,
        value,
      ]
      of fields
    ) {
      if (!value) {
        continue;
      }

      for (
        const pattern
        of patterns
      ) {
        const match =
          pattern.exec(value);

        if (!match) {
          continue;
        }

        found = {
          key,
          evidence_ref:
            evidenceRef,
          match_value:
            match[0],
          pattern:
            pattern.source,
        };

        break;
      }

      if (found) {
        break;
      }
    }

    if (found) {
      candidates.push(
        found
      );
    }
  }

  return {
    format_version: 1,

    supported_keys:
      FUNCTION_EVIDENCE_GATED_KEYS_V1,

    candidates,
  };
}
