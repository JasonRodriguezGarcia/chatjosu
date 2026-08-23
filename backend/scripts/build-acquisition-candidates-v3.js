import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  classifyAssociationRelevance,
} from "./lib/association-relevance-v1.js";

import {
  normalizeContactFieldsV1,
  normalizeEmailV1,
  normalizePhoneV1,
  normalizeWebsiteV1,
} from "./lib/association-contact-normalization-v1.js";

import {
  mapAssociationTagsV1,
} from "./lib/association-tag-mapper-v1.js";

import {
  buildAssociationSemanticCandidateGateV1,
} from "./lib/association-semantic-candidate-gate-v1.js";

import {
  buildAssociationFunctionEvidenceGateV1,
} from "./lib/association-function-evidence-gate-v1.js";

import {
  mapEuskadiSourceTaxonomyV1,
} from "./lib/euskadi-source-taxonomy-mapper-v1.js";

import {
  buildAssociationUtilityGateV1,
} from "./lib/association-utility-gate-v1.js";

const ROOT = process.cwd();

const SOURCE_DIR =
  "data/acquisition/euskadi_registro_asociaciones";

const MANIFEST_PATH =
  path.join(ROOT, SOURCE_DIR, "manifest.json");

const OUTPUT_PATH =
  path.join(ROOT, SOURCE_DIR, "normalized.jsonl");

const PREFLIGHT_PATH =
  path.join(ROOT, SOURCE_DIR, "preflight.json");

const TERRITORY_PATH =
  path.join(
    ROOT,
    "backend/data/spain-provinces-ine.json"
  );

const MASTER_PATH =
  path.join(
    ROOT,
    "data/master/associations.base.jsonl"
  );

function readJson(filename) {
  return JSON.parse(
    fs.readFileSync(
      filename,
      "utf8"
    )
  );
}

function readJsonl(filename) {
  if (!fs.existsSync(filename)) {
    return [];
  }

  return fs
    .readFileSync(
      filename,
      "utf8"
    )
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function cleanText(value) {
  const text =
    String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  return text || null;
}

function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("es-ES")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparable(value) {
  return normalizeKey(value)
    .replace(
      /\b(ASOCIACION|ASOC|FUNDACION|FEDERACION)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function sha256File(filename) {
  const hash =
    crypto.createHash("sha256");

  hash.update(
    fs.readFileSync(filename)
  );

  return hash.digest("hex");
}

function sha256Text(value) {
  return crypto
    .createHash("sha256")
    .update(
      String(value),
      "utf8"
    )
    .digest("hex");
}

function unwrapMarkdownLink(value) {
  const text =
    cleanText(value);

  if (!text) {
    return null;
  }

  const match =
    text.match(
      /^\[[^\]]*]\((https?:\/\/[^)]+)\)$/i
    );

  return cleanText(
    match
      ? match[1]
      : text
  );
}

function normalizeWebsite(value) {
  let text =
    unwrapMarkdownLink(value);

  if (!text) {
    return null;
  }

  text = text
    .replace(/^web\s*:\s*/i, "")
    .trim();

  if (
    /^www\./i.test(text)
  ) {
    text = `https://${text}`;
  }

  if (
    !/^https?:\/\//i.test(text)
  ) {
    return null;
  }

  try {
    const url =
      new URL(text);

    if (
      !url.hostname ||
      !url.hostname.includes(".")
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function normalizeEmail(value) {
  const text =
    cleanText(value);

  if (!text) {
    return null;
  }

  const match =
    text.match(
      /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/
    );

  return match
    ? match[0].toLowerCase()
    : null;
}

function normalizePhone(value) {
  const text =
    cleanText(value);

  if (!text) {
    return null;
  }

  const match =
    text.match(
      /(?<!\d)(?:\+34[\s.-]*)?(?:[6789]\d{2})(?:[\s.-]*\d{3})(?:[\s.-]*\d{3})(?!\d)/
    );

  if (!match) {
    return null;
  }

  const digits =
    match[0]
      .replace(/[^\d+]/g, "");

  if (
    digits.startsWith("+34") &&
    digits.length === 12
  ) {
    return (
      "+34 " +
      digits.slice(3, 6) +
      " " +
      digits.slice(6, 9) +
      " " +
      digits.slice(9)
    );
  }

  const local =
    digits.replace(/^\+34/, "");

  if (local.length !== 9) {
    return null;
  }

  return (
    local.slice(0, 3) +
    " " +
    local.slice(3, 6) +
    " " +
    local.slice(6)
  );
}

function extractWebsite(text) {
  const value =
    cleanText(text);

  if (!value) {
    return null;
  }

  const explicit =
    value.match(
      /https?:\/\/[^\s<>"')\]]+/i
    );

  if (explicit) {
    return normalizeWebsite(
      explicit[0]
    );
  }

  const www =
    value.match(
      /\bwww\.[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:\/[^\s<>"')\]]*)?/i
    );

  return www
    ? normalizeWebsite(www[0])
    : null;
}

function parseCoordinate(value) {
  const number =
    Number.parseFloat(
      String(value ?? "")
        .replace(",", ".")
    );

  return Number.isFinite(number)
    ? number
    : null;
}

function parseCoordinates(row) {
  let latitude =
    parseCoordinate(
      row.latwgs84
    );

  let longitude =
    parseCoordinate(
      row.lonwgs84
    );

  let method =
    latitude !== null &&
    longitude !== null
      ? "structured_wgs84"
      : null;

  if (
    latitude === null ||
    longitude === null
  ) {
    const combined =
      cleanText(
        row.latitudelongitude
      );

    const match =
      combined?.match(
        /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/
      );

    if (match) {
      latitude =
        Number.parseFloat(
          match[1]
        );

      longitude =
        Number.parseFloat(
          match[2]
        );

      method =
        "latitudelongitude_fallback";
    }
  }

  const valid =
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  return {
    latitude:
      valid ? latitude : null,
    longitude:
      valid ? longitude : null,
    method:
      valid ? method : null,
    invalid:
      !valid &&
      (
        latitude !== null ||
        longitude !== null
      ),
  };
}

function counterIncrement(
  object,
  key,
  amount = 1
) {
  object[key] =
    (object[key] ?? 0) +
    amount;
}

const manifest =
  readJson(
    MANIFEST_PATH
  );

const rawPath =
  path.join(
    ROOT,
    manifest.raw_file
  );

if (
  !fs.existsSync(rawPath)
) {
  throw new Error(
    `RAW_FILE_NOT_FOUND: ${rawPath}`
  );
}

const actualSha256 =
  sha256File(
    rawPath
  );

if (
  actualSha256 !==
  manifest.sha256
) {
  throw new Error(
    [
      "RAW_SHA256_MISMATCH",
      `expected=${manifest.sha256}`,
      `actual=${actualSha256}`,
    ].join(" ")
  );
}

console.log(
  "RAW_SHA256=PASS"
);

const sourceRows =
  readJson(
    rawPath
  );

if (
  !Array.isArray(sourceRows)
) {
  throw new Error(
    "SOURCE_IS_NOT_ARRAY"
  );
}

/*
 * Territory authority.
 */
const territoryCatalog =
  readJson(
    TERRITORY_PATH
  ).territories;

const territoryByIne =
  new Map(
    territoryCatalog.map(
      territory => [
        territory.ine_code,
        territory,
      ]
    )
  );

const territoryAliases =
  new Map();

for (
  const territory
  of territoryCatalog
) {
  territoryAliases.set(
    normalizeKey(
      territory.name
    ),
    territory
  );

  territoryAliases.set(
    normalizeKey(
      territory.province_key
    ),
    territory
  );
}

for (
  const [
    alias,
    ineCode,
  ]
  of [
    ["ARABA", "01"],
    ["ALAVA", "01"],
    ["ARABA ALAVA", "01"],
    ["GIPUZKOA", "20"],
    ["GUIPUZCOA", "20"],
    ["BIZKAIA", "48"],
    ["VIZCAYA", "48"],
  ]
) {
  territoryAliases.set(
    normalizeKey(alias),
    territoryByIne.get(
      ineCode
    )
  );
}

function resolveTerritory(row) {
  const code =
    cleanText(
      row.territorycode
    );

  if (
    code &&
    territoryByIne.has(code)
  ) {
    const territory =
      territoryByIne.get(code);

    return {
      resolved: true,
      method:
        "source_ine_code",
      province_key:
        territory.province_key,
      province_name:
        territory.name,
      ine_code:
        territory.ine_code,
    };
  }

  const nameKey =
    normalizeKey(
      row.territory
    );

  if (
    nameKey &&
    territoryAliases.has(nameKey)
  ) {
    const territory =
      territoryAliases.get(
        nameKey
      );

    return {
      resolved: true,
      method:
        "source_name_alias",
      province_key:
        territory.province_key,
      province_name:
        territory.name,
      ine_code:
        territory.ine_code,
    };
  }

  return {
    resolved: false,
    method: null,
    province_key: null,
    province_name: null,
    ine_code: null,
  };
}

/*
 * Existing Master indexes.
 *
 * Current base does not expose CIF/NIF,
 * therefore tax-id dedupe can only be
 * performed later if Master gains that field.
 */
const masterRows =
  readJsonl(
    MASTER_PATH
  );

const masterByExactLocation =
  new Map();

const masterByNameTerritory =
  new Map();

for (
  const row
  of masterRows
) {
  const name =
    normalizeComparable(
      row.name
    );

  if (!name) {
    continue;
  }

  const province =
    normalizeKey(
      row.province_key
    );

  const municipality =
    normalizeKey(
      row.municipality_name
    );

  const address =
    normalizeKey(
      row.address
    );

  if (
    province &&
    municipality &&
    address
  ) {
    const key =
      [
        name,
        province,
        municipality,
        address,
      ].join("|");

    if (
      !masterByExactLocation.has(
        key
      )
    ) {
      masterByExactLocation.set(
        key,
        []
      );
    }

    masterByExactLocation
      .get(key)
      .push(row);
  }

  if (province) {
    const key =
      [
        name,
        province,
      ].join("|");

    if (
      !masterByNameTerritory.has(
        key
      )
    ) {
      masterByNameTerritory.set(
        key,
        []
      );
    }

    masterByNameTerritory
      .get(key)
      .push(row);
  }
}

function dedupeAgainstMaster(
  candidate
) {
  const name =
    normalizeComparable(
      candidate.name
    );

  const province =
    normalizeKey(
      candidate.province_key
    );

  const municipality =
    normalizeKey(
      candidate.municipality_name
    );

  const address =
    normalizeKey(
      candidate.address
    );

  if (
    name &&
    province &&
    municipality &&
    address
  ) {
    const key =
      [
        name,
        province,
        municipality,
        address,
      ].join("|");

    const matches =
      masterByExactLocation.get(
        key
      ) ?? [];

    if (matches.length) {
      return {
        status:
          "exact_duplicate",
        method:
          "name_province_municipality_address",
        master_association_ids:
          matches.map(
            row =>
              row.association_id
          ),
      };
    }
  }

  if (
    name &&
    province
  ) {
    const key =
      [
        name,
        province,
      ].join("|");

    const matches =
      masterByNameTerritory.get(
        key
      ) ?? [];

    if (matches.length) {
      return {
        status:
          "probable_duplicate",
        method:
          "name_province",
        master_association_ids:
          matches.map(
            row =>
              row.association_id
          ),
      };
    }
  }

  return {
    status:
      "new_candidate",
    method: null,
    master_association_ids: [],
  };
}

function makeCandidateId(
  row,
  index
) {
  const recordId =
    cleanText(
      row.recNumRec
    );

  if (recordId) {
    return (
      manifest.source_id +
      ":" +
      recordId
    );
  }

  const fingerprint =
    [
      row.recName,
      row.address,
      row.municipality,
      row.territory,
      index,
    ]
      .map(value =>
        cleanText(value) ?? ""
      )
      .join("|");

  return (
    manifest.source_id +
    ":fallback:" +
    sha256Text(
      fingerprint
    ).slice(0, 24)
  );
}

const preflight = {
  format_version: 1,
  pipeline_version: 3,
  relevance_version: "1.3",

  source: {
    source_id:
      manifest.source_id,
    publisher:
      manifest.publisher,
    acquired_at:
      manifest.acquired_at,
    raw_file:
      manifest.raw_file,
    sha256:
      manifest.sha256,
    sha256_verified: true,
  },

  source_rows:
    sourceRows.length,

  candidate_rows: 0,

  /*
   * Normalization is lossless with respect
   * to source rows. Product/support eligibility
   * is accounted separately below.
   */
  coverage: {
    normalized_rows: 0,
    omitted_from_normalization: 0,
  },

  support_scope: {
    eligible: 0,
    excluded: 0,
  },

  relevance: {},
  resource_role: {},

  contacts: {
    source_phone_nonempty: 0,
    source_email_nonempty: 0,
    source_website_nonempty: 0,

    with_phone: 0,
    with_email: 0,
    with_website: 0,
    with_any_contact: 0,

    recovered_phone: 0,
    recovered_email: 0,
    recovered_website: 0,

    invalid_source_phone: 0,
    invalid_source_email: 0,
    invalid_source_website: 0,

    source_contact_loss: 0,
  },

  territory: {
    resolved: 0,
    unresolved: 0,
    by_province: {},
    by_resolution_method: {},
  },

  coordinates: {
    structured_wgs84: 0,
    fallback_combined: 0,
    missing: 0,
    invalid: 0,
  },

  dedupe: {
    new_candidate: 0,
    exact_duplicate: 0,
    probable_duplicate: 0,
    master_tax_id_available: false,
  },

  quality: {
    missing_source_record_id: 0,
    missing_name: 0,
    missing_address: 0,
    missing_postal_code: 0,
    missing_municipality: 0,
    missing_province: 0,
    missing_any_contact: 0,
  },
};

const output = [];

preflight.utility = {
  kept_non_drop: 0,
  protected_from_relevance_drop: 0,
  dropped: 0,
  protected_reasons: {},
};

for (
  let index = 0;
  index < sourceRows.length;
  index += 1
) {
  const row =
    sourceRows[index];

  const name =
    cleanText(
      row.recName ||
      row.documentName
    );

  const recordId =
    cleanText(
      row.recNumRec
    );

  if (!recordId) {
    preflight
      .quality
      .missing_source_record_id += 1;
  }

  /*
   * recName/documentName are metadata.
   * They are deliberately not included in
   * semantic text because names can contain
   * disease words without representing a
   * health resource.
   */
  const relevance =
    classifyAssociationRelevance({
      name,
      categories: [
        row.asoSection,
        row.asoSorting,
        row.asoGoalType,
      ],
      text: [
        row.documentDescription &&
        row.documentDescription !==
          row.recName
          ? row.documentDescription
          : null,
        row.recGoal,
      ],
    });

  counterIncrement(
    preflight.relevance,
    relevance.status
  );

  /*
   * Relevance is an independent opinion.
   *
   * A relevance drop is only allowed to
   * exclude the record when no useful
   * semantic evidence protects it.
   */
  const taxonomySignal =
    mapEuskadiSourceTaxonomyV1({
      section:
        row.asoSection,

      sorting:
        row.asoSorting,

      goalType:
        row.asoGoalType,
    });

  const tagSignal =
    mapAssociationTagsV1({
      name,

      description:
        cleanText(
          row.recGoal
        ),

      originalCategory:
        row.asoGoalType,
    });

  const semanticSignal =
    buildAssociationSemanticCandidateGateV1({
      name,

      description:
        cleanText(
          row.recGoal
        ),

      categorySection:
        row.asoSection,

      categorySorting:
        row.asoSorting,

      categoryGoal:
        row.asoGoalType,
    });

  const functionSignal =
    buildAssociationFunctionEvidenceGateV1({
      name,

      description:
        cleanText(
          row.recGoal
        ),

      categorySection:
        row.asoSection,

      categorySorting:
        row.asoSorting,

      categoryGoal:
        row.asoGoalType,
    });

  const needKeys =
    [
      ...new Set([
        ...(tagSignal.tags ?? [])
          .map(item => item.key),

        ...(
          taxonomySignal
            .assertions
            ?.needs ?? []
        ),

        ...(
          taxonomySignal
            .candidates
            ?.needs ?? []
        ),
      ]),
    ];

  const functionKeys =
    [
      ...new Set(
        (functionSignal
          .candidates ?? [])
          .map(item => item.key)
      ),
    ];

  const utility =
    buildAssociationUtilityGateV1({
      relevanceDecision:
        relevance.decision,

      needKeys,

      functionKeys,

      hints:
        taxonomySignal.hints ?? [],
    });

  if (
    relevance.decision !== "drop"
  ) {
    preflight
      .utility
      .kept_non_drop += 1;
  } else if (
    utility.decision === "keep"
  ) {
    preflight
      .utility
      .protected_from_relevance_drop += 1;

    for (
      const reason
      of utility.reasons
    ) {
      counterIncrement(
        preflight
          .utility
          .protected_reasons,
        reason
      );
    }
  } else {
    /*
     * A utility drop means this record is not
     * currently eligible for the primary
     * HelpChat support-resource lane.
     *
     * It MUST NOT remove the source record from
     * normalization: cultural/community records
     * can still be valid for community_wellbeing.
     */
    preflight
      .utility
      .dropped += 1;
  }

  const territory =
    resolveTerritory(
      row
    );

  if (territory.resolved) {
    preflight
      .territory
      .resolved += 1;

    counterIncrement(
      preflight
        .territory
        .by_province,
      territory.province_key
    );

    counterIncrement(
      preflight
        .territory
        .by_resolution_method,
      territory.method
    );
  } else {
    preflight
      .territory
      .unresolved += 1;
  }

  const coordinates =
    parseCoordinates(
      row
    );

  if (
    coordinates.method ===
    "structured_wgs84"
  ) {
    preflight
      .coordinates
      .structured_wgs84 += 1;
  } else if (
    coordinates.method ===
    "latitudelongitude_fallback"
  ) {
    preflight
      .coordinates
      .fallback_combined += 1;
  } else if (
    coordinates.invalid
  ) {
    preflight
      .coordinates
      .invalid += 1;
  } else {
    preflight
      .coordinates
      .missing += 1;
  }

  /*
   * Structured contact fields.
   */
  const sourcePhoneRaw =
    cleanText(
      row.phone
    );

  const sourceEmailRaw =
    cleanText(
      row.email
    );

  const sourceWebsiteRaw =
    cleanText(
      row.recweb ||
      row.webpage
    );

  if (sourcePhoneRaw) {
    preflight
      .contacts
      .source_phone_nonempty += 1;
  }

  if (sourceEmailRaw) {
    preflight
      .contacts
      .source_email_nonempty += 1;
  }

  if (sourceWebsiteRaw) {
    preflight
      .contacts
      .source_website_nonempty += 1;
  }

  const contactText =
    [
      row.recGoal,
      row.documentDescription,
    ]
      .filter(Boolean)
      .join("\n");

  const normalizedContacts =
    normalizeContactFieldsV1({
      phone:
        sourcePhoneRaw,
      email:
        sourceEmailRaw,
      website:
        sourceWebsiteRaw,
      fallbackText:
        contactText,
    });

  const phone =
    normalizedContacts.phone;

  const email =
    normalizedContacts.email;

  const website =
    normalizedContacts.website;

  const contactProvenance =
    normalizedContacts.provenance;

  if (
    sourcePhoneRaw &&
    !normalizePhone(
      sourcePhoneRaw
    )
  ) {
    preflight
      .contacts
      .invalid_source_phone += 1;
  }

  if (
    sourceEmailRaw &&
    !normalizeEmail(
      sourceEmailRaw
    )
  ) {
    preflight
      .contacts
      .invalid_source_email += 1;
  }

  if (
    sourceWebsiteRaw &&
    !website &&
    !email &&
    !phone
  ) {
    preflight
      .contacts
      .invalid_source_website += 1;
  }

  if (
    contactProvenance.phone?.method
    === "embedded"
  ) {
    preflight
      .contacts
      .recovered_phone += 1;
  }

  if (
    contactProvenance.email?.method
    === "embedded"
  ) {
    preflight
      .contacts
      .recovered_email += 1;
  }

  if (
    contactProvenance.website?.method
    === "embedded"
  ) {
    preflight
      .contacts
      .recovered_website += 1;
  }

  /*
   * Contact integrity invariant:
   *
   * A valid contact present in a structured
   * source field must survive normalization
   * according to its REAL contact type.
   *
   * Dirty registries may contain, for example,
   * an email or phone inside recweb.
   */

  const sourceContactValues =
    [
      sourcePhoneRaw,
      sourceEmailRaw,
      sourceWebsiteRaw,
    ].filter(Boolean);

  const sourceValidPhones =
    sourceContactValues
      .map(
        value =>
          normalizePhoneV1(value)
      )
      .filter(Boolean);

  const sourceValidEmails =
    sourceContactValues
      .map(
        value =>
          normalizeEmailV1(value)
      )
      .filter(Boolean);

  const sourceValidWebsites =
    sourceContactValues
      .map(
        value =>
          normalizeWebsiteV1(value)
      )
      .filter(Boolean);

  if (
    sourceValidPhones.length > 0 &&
    !phone
  ) {
    preflight
      .contacts
      .source_contact_loss += 1;
  }

  if (
    sourceValidEmails.length > 0 &&
    !email
  ) {
    preflight
      .contacts
      .source_contact_loss += 1;
  }

  if (
    sourceValidWebsites.length > 0 &&
    !website
  ) {
    preflight
      .contacts
      .source_contact_loss += 1;
  }

  const sourceCategories =
    [
      cleanText(
        row.asoSorting
      ),
      cleanText(
        row.asoGoalType
      ),
    ].filter(Boolean);

  /*
   * Review candidates survive acquisition but
   * are not eligible for primary runtime use.
   */
  const resourceRole =
    relevance.decision === "keep"
      ? "primary_candidate"
      : "supportive_candidate";

  counterIncrement(
    preflight.resource_role,
    resourceRole
  );

  const candidate = {
    candidate_id:
      makeCandidateId(
        row,
        index
      ),

    source_record_id:
      recordId,

    name,

    tax_id:
      cleanText(
        row.recCif
      ),

    scope:
      cleanText(
        row.asoScope
      ),

    province_key:
      territory.province_key,

    province_name:
      territory.province_name,

    province_ine_code:
      territory.ine_code,

    municipality_key:
      normalizeKey(
        row.municipality
      ) || null,

    municipality_name:
      cleanText(
        row.municipality
      ),

    municipality_source_code:
      cleanText(
        row.municipalitycode
      ),

    address:
      cleanText(
        row.address
      ),

    postal_code:
      cleanText(
        row.postalcode
      ),

    phone,
    email,
    website,

    contact_provenance:
      contactProvenance,

    latitude:
      coordinates.latitude,

    longitude:
      coordinates.longitude,

    location_precision:
      coordinates.method
        ? "coordinates"
        : territory.resolved
          ? "territory"
          : null,

    description:
      cleanText(
        row.recGoal
      ),

    original_category:
      sourceCategories.join(
        " | "
      ) || null,

    source_categories:
      sourceCategories,

    relevance,

    utility,

    resource_role:
      resourceRole,

    source: {
      source_id:
        manifest.source_id,

      publisher:
        manifest.publisher,

      record_id:
        recordId,

      source_url:
        manifest.source_url,

      record_url:
        unwrapMarkdownLink(
          row.friendlyUrl
        ),

      detail_url:
        unwrapMarkdownLink(
          row.physicalUrl
        ),

      acquired_at:
        manifest.acquired_at,

      raw_file:
        manifest.raw_file,

      source_row_index:
        index,

      territory_resolution:
        territory.method,

      coordinate_method:
        coordinates.method,
    },
  };

  candidate.dedupe =
    dedupeAgainstMaster(
      candidate
    );

  counterIncrement(
    preflight.dedupe,
    candidate.dedupe.status
  );

  if (!candidate.name) {
    preflight
      .quality
      .missing_name += 1;
  }

  if (!candidate.address) {
    preflight
      .quality
      .missing_address += 1;
  }

  if (!candidate.postal_code) {
    preflight
      .quality
      .missing_postal_code += 1;
  }

  if (
    !candidate
      .municipality_name
  ) {
    preflight
      .quality
      .missing_municipality += 1;
  }

  if (!candidate.province_key) {
    preflight
      .quality
      .missing_province += 1;
  }

  if (
    !phone &&
    !email &&
    !website
  ) {
    preflight
      .quality
      .missing_any_contact += 1;
  }

  if (phone) {
    preflight
      .contacts
      .with_phone += 1;
  }

  if (email) {
    preflight
      .contacts
      .with_email += 1;
  }

  if (website) {
    preflight
      .contacts
      .with_website += 1;
  }

  if (
    phone ||
    email ||
    website
  ) {
    preflight
      .contacts
      .with_any_contact += 1;
  }

  output.push(
    candidate
  );
}

preflight.candidate_rows =
  output.length;

preflight.coverage.normalized_rows =
  output.length;

preflight.coverage
  .omitted_from_normalization =
  preflight.source_rows -
  output.length;

preflight.support_scope.excluded =
  preflight.utility.dropped;

preflight.support_scope.eligible =
  preflight.source_rows -
  preflight.support_scope.excluded;

/*
 * Backward-compatible field.
 *
 * No source record is now excluded from the
 * normalized dataset merely because it is
 * outside the primary support-resource scope.
 */
preflight.excluded_out_of_scope = 0;

if (
  preflight.coverage
    .omitted_from_normalization !== 0
) {
  throw new Error(
    "LOSSLESS_NORMALIZATION_INVARIANT_FAILED"
  );
}

if (
  (
    preflight.support_scope.eligible +
    preflight.support_scope.excluded
  ) !== preflight.source_rows
) {
  throw new Error(
    "SUPPORT_SCOPE_ACCOUNTING_INVARIANT_FAILED"
  );
}

preflight.master_rows_checked =
  masterRows.length;

preflight.generated_at =
  new Date().toISOString();

if (
  preflight
    .contacts
    .source_contact_loss !== 0
) {
  throw new Error(
    "SOURCE_CONTACT_LOSS_INVARIANT_FAILED"
  );
}

fs.writeFileSync(
  OUTPUT_PATH,
  output
    .map(row =>
      JSON.stringify(row)
    )
    .join("\n") +
    "\n",
  "utf8"
);

fs.writeFileSync(
  PREFLIGHT_PATH,
  JSON.stringify(
    preflight,
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(
  `SOURCE_ROWS=${preflight.source_rows}`
);

console.log(
  `CANDIDATE_ROWS=${preflight.candidate_rows}`
);

console.log(
  `NORMALIZATION_OMITTED=${preflight.coverage.omitted_from_normalization}`
);

console.log(
  `SUPPORT_SCOPE_ELIGIBLE=${preflight.support_scope.eligible}`
);

console.log(
  `SUPPORT_SCOPE_EXCLUDED=${preflight.support_scope.excluded}`
);

console.log(
  `SOURCE_CONTACT_LOSS=${preflight.contacts.source_contact_loss}`
);

console.log(
  `NORMALIZED=${path.relative(ROOT, OUTPUT_PATH)}`
);

console.log(
  `PREFLIGHT=${path.relative(ROOT, PREFLIGHT_PATH)}`
);
