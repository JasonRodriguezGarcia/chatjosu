const FORMAT_VERSION = 1;

const PUBLICATION_LANES = new Set([
  "support_resource",
  "community_wellbeing",
]);

function clean(value) {
  const text =
    String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();

  return text || null;
}

function uniqueStrings(values) {
  return [
    ...new Set(
      (values ?? [])
        .map(value =>
          clean(value)
        )
        .filter(Boolean)
    ),
  ];
}

function semanticDimension(value) {
  /*
   * Euskadi census:
   *   ["MUSICA", "TEATRO"]
   *
   * Navarra envelope:
   *   {
   *     keys: ["MUSICA"],
   *     evidence: [...]
   *   }
   *
   * Canonical:
   *   {
   *     keys: ["MUSICA"],
   *     evidence: [...]
   *   }
   */
  if (Array.isArray(value)) {
    return {
      keys:
        uniqueStrings(value),
      evidence: [],
    };
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return {
      keys:
        uniqueStrings(
          value.keys ?? []
        ),

      evidence:
        Array.isArray(
          value.evidence
        )
          ? value.evidence
          : [],
    };
  }

  return {
    keys: [],
    evidence: [],
  };
}

function serviceScope({
  sourceId,
  sourceScope,
  provinceKey,
  municipalityName,
} = {}) {
  const raw =
    clean(sourceScope);

  const source =
    clean(sourceId);

  const province =
    clean(provinceKey);

  const municipality =
    clean(municipalityName);

  const base = {
    level: "unknown",

    autonomous_communities: [],
    provinces: [],
    municipalities: [],

    source_value: raw,

    method:
      raw
        ? "source_taxonomy"
        : "insufficient_source_evidence",
  };

  /*
   * Euskadi source taxonomy.
   *
   * Physical location and service scope remain
   * deliberately separate.
   */
  if (
    source ===
      "euskadi_registro_asociaciones"
  ) {
    switch (raw) {
      case "C.A. del País Vasco":
        return {
          ...base,
          level:
            "autonomous_community",
          autonomous_communities: [
            "EUSKADI",
          ],
        };

      case "C.A. del País Vasco y C.Foral de Navarra":
        return {
          ...base,
          level:
            "multi_autonomous_community",
          autonomous_communities: [
            "EUSKADI",
            "NAVARRA",
          ],
        };

      case "T.H. de Bizkaia":
        return {
          ...base,
          level: "province",
          autonomous_communities: [
            "EUSKADI",
          ],
          provinces: [
            "VIZCAYA",
          ],
        };

      case "T.H. de Gipuzkoa":
        return {
          ...base,
          level: "province",
          autonomous_communities: [
            "EUSKADI",
          ],
          provinces: [
            "GUIPUZCOA",
          ],
        };

      case "T.H. de Alava":
        return {
          ...base,
          level: "province",
          autonomous_communities: [
            "EUSKADI",
          ],
          provinces: [
            "ALAVA",
          ],
        };

      case "T.H. de Gipuzkoa y Bizkaia":
        return {
          ...base,
          level: "multi_province",
          autonomous_communities: [
            "EUSKADI",
          ],
          provinces: [
            "GUIPUZCOA",
            "VIZCAYA",
          ],
        };

      case "T.H. de Alava y Bizkaia":
        return {
          ...base,
          level: "multi_province",
          autonomous_communities: [
            "EUSKADI",
          ],
          provinces: [
            "ALAVA",
            "VIZCAYA",
          ],
        };

      case "T.H. de Gipuzkoa y Alava":
        return {
          ...base,
          level: "multi_province",
          autonomous_communities: [
            "EUSKADI",
          ],
          provinces: [
            "GUIPUZCOA",
            "ALAVA",
          ],
        };

      case "Municipal":
        return {
          ...base,
          level: "municipality",
          autonomous_communities: [
            "EUSKADI",
          ],
          provinces:
            province
              ? [province]
              : [],
          municipalities:
            municipality
              ? [municipality]
              : [],
        };

      case "Comarcal":
        return {
          ...base,
          level: "comarca",
          autonomous_communities: [
            "EUSKADI",
          ],
          provinces:
            province
              ? [province]
              : [],
        };

      case "Local":
        return {
          ...base,
          level: "local",
          autonomous_communities: [
            "EUSKADI",
          ],
          provinces:
            province
              ? [province]
              : [],
          municipalities:
            municipality
              ? [municipality]
              : [],
        };

      case "Territorial":
        return {
          ...base,
          level: "province",
          autonomous_communities: [
            "EUSKADI",
          ],
          provinces:
            province
              ? [province]
              : [],
          method:
            "source_taxonomy_plus_location",
        };

      default:
        return base;
    }
  }

  /*
   * Do not interpret opaque source codes
   * from other registries here.
   *
   * Navarra will receive an explicit mapping
   * once its source semantics have been proven.
   */
  return base;
}

function derivePublicationLanes({
  semantic,
  supportEligible = false,
} = {}) {
  const lanes = [];

  if (supportEligible) {
    lanes.push(
      "support_resource"
    );
  }

  if (
    semantic.activities.keys.length
      > 0
  ) {
    lanes.push(
      "community_wellbeing"
    );
  }

  return lanes;
}

function validatePublicationLanes(
  lanes
) {
  for (const lane of lanes) {
    if (
      !PUBLICATION_LANES.has(
        lane
      )
    ) {
      throw new Error(
        `UNKNOWN_PUBLICATION_LANE:${lane}`
      );
    }
  }
}

export function buildCanonicalAssociationV1({
  normalized,
  semantic = null,
  supportEligible = false,
  semanticProvenance = null,
} = {}) {
  if (
    !normalized ||
    typeof normalized !== "object"
  ) {
    throw new TypeError(
      "normalized association is required"
    );
  }

  const sourceId =
    clean(
      normalized.source_id ??
      normalized.source?.source_id
    );

  const sourceRecordId =
    clean(
      normalized.source_record_id ??
      normalized.source
        ?.source_record_id ??
      normalized.source
        ?.record_id
    );

  if (!sourceId) {
    throw new Error(
      "MISSING_SOURCE_ID"
    );
  }

  if (!sourceRecordId) {
    throw new Error(
      "MISSING_SOURCE_RECORD_ID"
    );
  }

  const deterministic =
    semantic?.deterministic ??
    {};

  const canonicalSemantic = {
    needs:
      semanticDimension(
        deterministic.needs
      ),

    populations:
      semanticDimension(
        deterministic.populations
      ),

    functions:
      semanticDimension(
        deterministic.functions
      ),

    activities:
      semanticDimension(
        deterministic.activities
      ),
  };

  const publicationLanes =
    derivePublicationLanes({
      semantic:
        canonicalSemantic,
      supportEligible,
    });

  validatePublicationLanes(
    publicationLanes
  );

  return {
    format_version:
      FORMAT_VERSION,

    identity: {
      canonical_id:
        `${sourceId}:${sourceRecordId}`,

      source_id:
        sourceId,

      source_record_id:
        sourceRecordId,

      tax_id:
        clean(
          normalized.tax_id
        ),
    },

    source_facts: {
      name:
        clean(
          normalized.name
        ),

      description:
        clean(
          normalized.description
        ),

      source_scope:
        clean(
          normalized.scope
        ),

      source_categories:
        normalized.source_categories ??
        null,
    },

    location: {
      autonomous_community:
        sourceId ===
          "euskadi_registro_asociaciones"
          ? "EUSKADI"
          : sourceId ===
              "navarra_registro_asociaciones"
            ? "NAVARRA"
            : null,

      province:
        clean(
          normalized.province_key
        ),

      municipality:
        clean(
          normalized.municipality_name
        ),

      locality:
        clean(
          normalized.locality_name
        ),

      address:
        clean(
          normalized.address
        ),

      postal_code:
        clean(
          normalized.postal_code
        ),

      latitude:
        normalized.latitude ??
        null,

      longitude:
        normalized.longitude ??
        null,

      precision:
        clean(
          normalized.location_precision
        ),
    },

    service_scope:
      serviceScope({
        sourceId,

        sourceScope:
          normalized.scope,

        provinceKey:
          normalized.province_key,

        municipalityName:
          normalized.municipality_name,
      }),

    contacts: {
      phone:
        clean(
          normalized.phone
        ),

      email:
        clean(
          normalized.email
        ),

      website:
        clean(
          normalized.website
        ),
    },

    semantic:
      canonicalSemantic,

    publication: {
      lanes:
        publicationLanes,
    },

    provenance: {
      contacts:
        normalized.contact_provenance ??
        {},

      semantic:
        semanticProvenance ??
        {},

      territory: {
        source_scope:
          clean(
            normalized.scope
          ),
      },
    },

    curation: {
      relevance:
        semantic?.relevance ??
        normalized.relevance ??
        null,

      utility:
        semantic?.utility ??
        normalized.utility ??
        null,

      semantic_status:
        clean(
          semantic?.semantic_status
        ),

      review_status:
        clean(
          semantic?.taxonomy_review
            ?.status
        ),
    },
  };
}

export const canonicalAssociationV1 = {
  formatVersion:
    FORMAT_VERSION,

  publicationLanes: [
    ...PUBLICATION_LANES,
  ],

  semanticDimension,
  serviceScope,
  derivePublicationLanes,
};
