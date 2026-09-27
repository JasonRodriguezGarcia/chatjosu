function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("es-ES")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DIRECT_IDENTITY_PATTERNS = [
  /\bAFECTADOS?\b/,
  /\bAFECTADAS?\b/,
  /\bPERSONAS AFECTADAS\b/,
  /\bPACIENTES?\b/,
  /\bENFERMOS?\b/,
  /\bENFERMAS?\b/,
  /\bFAMILIARES DE\b/,
  /\bFAMILIAS DE\b/,
  /\bPADRES Y MADRES DE\b/,
  /\bPERSONAS CON\b/,
];

const DIRECT_SERVICE_PATTERNS = [
  /\bATENCION\b/,
  /\bATENDER\b/,
  /\bASISTENCIA\b/,
  /\bASISTIR\b/,
  /\bAPOYO\b/,
  /\bAPOYAR\b/,
  /\bAYUDA\b/,
  /\bAYUDAR\b/,
  /\bORIENTACION\b/,
  /\bORIENTAR\b/,
  /\bASESORAMIENTO\b/,
  /\bASESORAR\b/,
  /\bACOMPANAMIENTO\b/,
  /\bACOMPANAR\b/,
  /\bREHABILITACION\b/,
  /\bREHABILITAR\b/,
  /\bTRATAMIENTO\b/,
  /\bTERAPIA\b/,
  /\bACOGIDA\b/,
  /\bACOGER\b/,
  /\bPRESTAR SERVICIOS\b/,
  /\bOFRECER SERVICIOS\b/,
  /\bFACILITAR RECURSOS\b/,
  /\bMEJORAR LA CALIDAD DE VIDA\b/,
  /\bINTEGRACION SOCIAL\b/,
  /\bINCLUSION SOCIAL\b/,
  /\bREINSERCION\b/,
];

const SUPPORTIVE_PATTERNS = [
  /\bINVESTIGACION\b/,
  /\bINVESTIGAR\b/,
  /\bSENSIBILIZACION\b/,
  /\bSENSIBILIZAR\b/,
  /\bCONCIENCIACION\b/,
  /\bCONCIENCIAR\b/,
  /\bDIVULGACION\b/,
  /\bDIVULGAR\b/,
  /\bRECAUDAR FONDOS\b/,
  /\bRECAUDACION DE FONDOS\b/,
  /\bDONAR\b/,
  /\bDONACION\b/,
  /\bEVENTOS CULTURALES\b/,
  /\bACTIVIDADES CULTURALES\b/,
  /\bMERCHANDISING\b/,
];

function findMatches(
  text,
  patterns
) {
  return patterns
    .filter(pattern => {
      pattern.lastIndex = 0;
      return pattern.test(text);
    })
    .map(pattern =>
      pattern.source
    );
}

export function classifyAssociationResourceRoleV1({
  name,
  description,
} = {}) {
  const normalizedName =
    normalize(name);

  const normalizedDescription =
    normalize(description);

  const directIdentity =
    findMatches(
      normalizedName,
      DIRECT_IDENTITY_PATTERNS
    );

  const directService =
    findMatches(
      normalizedDescription,
      DIRECT_SERVICE_PATTERNS
    );

  const supportive =
    findMatches(
      normalizedDescription,
      SUPPORTIVE_PATTERNS
    );

  /*
   * Identidad explícita de personas afectadas
   * o prestación directa de ayuda domina.
   */
  if (
    directIdentity.length ||
    directService.length
  ) {
    return {
      role: "direct",
      confidence: "high",
      reasons: [
        ...(directIdentity.length
          ? ["direct_identity"]
          : []),
        ...(directService.length
          ? ["direct_service"]
          : []),
      ],
      evidence: {
        direct_identity:
          directIdentity,
        direct_service:
          directService,
        supportive:
          supportive,
      },
    };
  }

  /*
   * Investigación, divulgación,
   * sensibilización, recaudación, etc.
   * sin atención directa.
   */
  if (supportive.length) {
    return {
      role: "supportive",
      confidence: "high",
      reasons: [
        "supportive_activity",
      ],
      evidence: {
        direct_identity: [],
        direct_service: [],
        supportive,
      },
    };
  }

  /*
   * Default conservador:
   * no competir con recursos directos.
   */
  return {
    role: "supportive",
    confidence: "review",
    reasons: [
      "no_direct_evidence",
    ],
    evidence: {
      direct_identity: [],
      direct_service: [],
      supportive: [],
    },
  };
}
