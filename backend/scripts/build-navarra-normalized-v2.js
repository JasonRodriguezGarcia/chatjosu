#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();

const SOURCE_ID =
  "navarra_registro_asociaciones";

const ACQ_DIR = path.join(
  ROOT,
  "data/acquisition",
  SOURCE_ID
);

const INPUT_PATH = path.join(
  ACQ_DIR,
  "normalized.jsonl"
);

const DETAILS_DIR = path.join(
  ACQ_DIR,
  "raw/details"
);

const ENVELOPE_PATH = path.join(
  ROOT,
  "data/curation/semantic/envelopes",
  "navarra-semantic-envelope-v1.jsonl"
);

const OUTPUT_PATH = path.join(
  ACQ_DIR,
  "normalized-v2.jsonl"
);

const REPORT_PATH = path.join(
  ACQ_DIR,
  "curation-report.json"
);

const EXPECTED = {
  rows: 10254,
  email: 1685,
  phone: 97,
  website: 10,
  postal_code: 9552,
  address: 10218,
  address_enriched: 9959,
  tax_collision_records: 24,
  tax_collision_values: 12,
  relevance_keep: 668,
  relevance_review: 9586,
};

const EMAIL_LOCAL_RE =
  /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?$/;

const EMAIL_LABEL_RE =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;

const FINES_URL_RE =
  /(https?:\/\/[^\s()]+|www\.[^\s()]+)/i;

function clean(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value)
    .replace(/\s+/g, " ")
    .trim();

  return text || null;
}

function normalizeTaxId(value) {
  const text = clean(value);

  if (!text) {
    return null;
  }

  const normalized = text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return normalized || null;
}

function validateEmail(text) {
  const parts = String(text).split("@");

  if (parts.length !== 2) {
    return {
      valid: false,
      reason: "at_count",
    };
  }

  const local = parts[0];
  const domain = parts[1];

  if (
    local.length === 0 ||
    !EMAIL_LOCAL_RE.test(local)
  ) {
    return {
      valid: false,
      reason: "local_charset",
    };
  }

  const labels = domain.split(".");

  if (labels.length < 2) {
    return {
      valid: false,
      reason: "tld_missing",
    };
  }

  for (const label of labels) {
    if (
      label.length < 2 ||
      label.length > 63
    ) {
      return {
        valid: false,
        reason: "label_length",
      };
    }

    if (!EMAIL_LABEL_RE.test(label)) {
      return {
        valid: false,
        reason: "label_charset",
      };
    }
  }

  return {
    valid: true,
    reason: null,
  };
}

function isUrlLike(text) {
  if (!text) {
    return false;
  }

  return (
    text.toLowerCase().startsWith("www.") ||
    /^https?:\/\//i.test(text)
  );
}

function normalizeUrl(text) {
  const value = clean(text);

  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (
    value.toLowerCase().startsWith("www.")
  ) {
    return `https://${value}`;
  }

  return null;
}

function normalizePhoneValue(value) {
  const text = clean(value);

  if (!text) {
    return null;
  }

  const digits = text.replace(/\D/g, "");

  if (
    digits.length === 11 &&
    digits.startsWith("0034")
  ) {
    return digits.slice(4);
  }

  if (
    digits.length === 11 &&
    digits.startsWith("34")
  ) {
    return digits.slice(2);
  }

  if (digits.length === 9) {
    return digits;
  }

  return null;
}

function hashPayload(payload) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(payload)
    )
    .digest("hex");
}

function readJson(file) {
  return JSON.parse(
    fs.readFileSync(
      file,
      "utf8"
    )
  );
}

function readJsonl(file) {
  const text = fs.readFileSync(
    file,
    "utf8"
  );

  return text
    .split("\n")
    .filter(
      (line) =>
        line.trim() !== ""
    )
    .map(
      (line) =>
        JSON.parse(line)
    );
}

const inputRows =
  readJsonl(INPUT_PATH);

const envelopeRows =
  readJsonl(ENVELOPE_PATH);

if (inputRows.length !== 10254) {
  throw new Error(
    `Unexpected input rows: ${inputRows.length}`
  );
}

if (envelopeRows.length !== 10254) {
  throw new Error(
    `Unexpected envelope rows: ${envelopeRows.length}`
  );
}

const envelopeById =
  new Map();

for (const envelope of envelopeRows) {
  const id = String(
    envelope.source_record_id
  );

  if (envelopeById.has(id)) {
    throw new Error(
      `Duplicate envelope: ${id}`
    );
  }

  envelopeById.set(id, envelope);
}

const inputById =
  new Map();

const taxGroups =
  new Map();

for (const row of inputRows) {
  const co = String(
    row.source_record_id
  );

  if (inputById.has(co)) {
    throw new Error(
      `Duplicate input row: ${co}`
    );
  }

  inputById.set(co, row);

  const detail =
    readJson(
      path.join(
        DETAILS_DIR,
        `${co}.json`
      )
    );

  if (
    String(
      detail.CO_REGISTRO
    ) !== co
  ) {
    throw new Error(
      `Detail identity mismatch: ${co}`
    );
  }

  const taxId =
    normalizeTaxId(
      detail.NIF_CIF_NIE_DNI
    );

  if (taxId) {
    if (
      !taxGroups.has(taxId)
    ) {
      taxGroups.set(
        taxId,
        []
      );
    }

    taxGroups
      .get(taxId)
      .push(co);
  }
}

const taxCollisions =
  new Map(
    [...taxGroups.entries()]
      .filter(
        ([, ids]) =>
          ids.length > 1
      )
  );

const rows = [];

const counters = {
  email_present: 0,
  phone_present: 0,
  website_present: 0,
  postal_code_present: 0,
  address_present: 0,
  address_enriched: 0,
  tax_collision_records: 0,
  relevance_keep: 0,
  relevance_review: 0,
};

const websiteOrigins = {
  structured: 0,
  email_promoted: 0,
  text_recovered: 0,
};

const exceptions = {
  email_invalid: [],
  phone_null: [],
  email_promoted_to_website: [],
  website_recovered_from_text: [],
  postal_code_recovered: [],
  postal_code_malformed_kept: [],
  address_prefix_variant_enriched: [],
};

for (const input of inputRows) {
  const sourceRecordId =
    String(
      input.source_record_id
    );

  const detail =
    readJson(
      path.join(
        DETAILS_DIR,
        `${sourceRecordId}.json`
      )
    );

  if (
    String(
      detail.CO_REGISTRO
    ) !==
    sourceRecordId
  ) {
    throw new Error(
      `Detail identity mismatch: ${sourceRecordId}`
    );
  }

  const name =
    clean(
      detail.RAZON_SOCIAL
    );

  const description =
    clean(
      detail.FINES
    );

  const originalCategory =
    clean(
      detail.CLASE
    );

  const scope =
    clean(
      detail.AMBITO
    );

  const municipalityName =
    clean(
      detail.MUNICIPIO_ENTIDAD
    ) ||
    clean(
      detail.LOCALIDAD_ENTIDAD
    );

  const taxId =
    normalizeTaxId(
      detail.NIF_CIF_NIE_DNI
    );

  if (
    input.name !== name
  ) {
    throw new Error(
      `Name drift: ${sourceRecordId}`
    );
  }

  if (
    input.description !==
    description
  ) {
    throw new Error(
      `Description drift: ${sourceRecordId}`
    );
  }

  if (
    input.original_category !==
    originalCategory
  ) {
    throw new Error(
      `Original category drift: ${sourceRecordId}`
    );
  }

  if (
    input.scope !== scope
  ) {
    throw new Error(
      `Scope drift: ${sourceRecordId}`
    );
  }

  if (
    input.municipality_name !==
    municipalityName
  ) {
    throw new Error(
      `Municipality drift: ${sourceRecordId}`
    );
  }

  if (
    input.tax_id !== taxId
  ) {
    throw new Error(
      `Tax id drift: ${sourceRecordId}`
    );
  }

  const expectedDedupeStatus =
    taxId &&
    taxCollisions.has(taxId)
      ? "tax_id_collision"
      : "new_candidate";

  if (
    input.dedupe.status !==
    expectedDedupeStatus
  ) {
    throw new Error(
      `Dedupe drift: ${sourceRecordId}`
    );
  }

  const envelope =
    envelopeById.get(
      sourceRecordId
    );

  if (!envelope) {
    throw new Error(
      `Missing envelope: ${sourceRecordId}`
    );
  }

  if (
    envelope.candidate_id !==
    input.candidate_id
  ) {
    throw new Error(
      `Envelope candidate drift: ${sourceRecordId}`
    );
  }

  if (
    envelope.content_hash !==
    input.content_hash
  ) {
    throw new Error(
      `Envelope hash drift: ${sourceRecordId}`
    );
  }

  if (
    envelope.name !== name
  ) {
    throw new Error(
      `Envelope name drift: ${sourceRecordId}`
    );
  }

  if (
    envelope.description !==
    description
  ) {
    throw new Error(
      `Envelope description drift: ${sourceRecordId}`
    );
  }

  if (
    !envelope.relevance ||
    typeof envelope.relevance.status !==
    "string"
  ) {
    throw new Error(
      `Missing relevance: ${sourceRecordId}`
    );
  }

  const emailRaw =
    clean(
      detail.EMAIL_ENTIDAD
    );

  let email = null;

  if (emailRaw) {
    const lower =
      emailRaw.toLowerCase();

    const check =
      validateEmail(lower);

    if (check.valid) {
      email = lower;
    } else {
      exceptions.email_invalid.push({
        source_record_id: sourceRecordId,
        value: lower,
        reason: check.reason,
      });
    }
  }

  const webRaw =
    clean(
      detail.DIRECCION_WEB
    );

  let website = null;
  let websiteOrigin = null;
  let websiteField = null;

  if (webRaw) {
    const normalized =
      normalizeUrl(webRaw);

    if (normalized) {
      website = normalized;
      websiteOrigin = "structured";
      websiteField = "DIRECCION_WEB";
    }
  }

  if (
    !website &&
    emailRaw &&
    isUrlLike(emailRaw)
  ) {
    website = normalizeUrl(
      emailRaw
    );

    websiteOrigin = "email_promoted";
    websiteField = "EMAIL_ENTIDAD";

    exceptions.email_promoted_to_website.push({
      source_record_id: sourceRecordId,
      value: emailRaw.toLowerCase(),
      website,
    });
  }

  if (!website) {
    const fines =
      clean(
        detail.FINES
      );

    if (fines) {
      const match =
        fines.match(
          FINES_URL_RE
        );

      if (match) {
        const candidate =
          match[1].replace(
            /[.,;:!?]+$/,
            ""
          );

        const recovered =
          normalizeUrl(
            candidate
          );

        if (recovered) {
          website = recovered;
          websiteOrigin = "text_recovered";
          websiteField = "FINES";

          exceptions.website_recovered_from_text.push({
            source_record_id: sourceRecordId,
            value: candidate,
            website,
          });
        }
      }
    }
  }

  const phoneCandidates = [
    {
      field: "TELEFONO1_ENTIDAD",
      value: detail.TELEFONO1_ENTIDAD,
    },
    {
      field: "TELEFONO2_ENTIDAD",
      value: detail.TELEFONO2_ENTIDAD,
    },
    {
      field: "TELEFONO3_ENTIDAD",
      value: detail.TELEFONO3_ENTIDAD,
    },
  ];

  let phone = null;
  let phoneField = null;

  for (const candidate of phoneCandidates) {
    const normalized =
      normalizePhoneValue(
        candidate.value
      );

    if (normalized) {
      phone = normalized;
      phoneField = candidate.field;
      break;
    }
  }

  const telefono1 = clean(
    detail.TELEFONO1_ENTIDAD
  );
  const telefono2 = clean(
    detail.TELEFONO2_ENTIDAD
  );
  const telefono3 = clean(
    detail.TELEFONO3_ENTIDAD
  );

  if (!phone && (telefono1 || telefono2 || telefono3)) {
    exceptions.phone_null.push({
      source_record_id: sourceRecordId,
      telefono1: telefono1,
      telefono2: telefono2,
      telefono3: telefono3,
    });
  }

  const addressRaw =
    clean(
      detail.DIRECCION_ENTIDAD
    );

  const tipoVial =
    clean(
      detail.TIPO_VIAL
    );

  let address =
    addressRaw;

  let addressEnriched =
    false;

  if (
    addressRaw &&
    tipoVial &&
    !addressRaw.startsWith(
      tipoVial
    )
  ) {
    address =
      `${tipoVial}, ${addressRaw}`;

    addressEnriched = true;

    if (
      addressRaw
        .toLowerCase()
        .startsWith(
          tipoVial.toLowerCase()
        )
    ) {
      exceptions.address_prefix_variant_enriched.push(
        sourceRecordId
      );
    }
  }

  let postalCode =
    clean(
      detail.CODIGOPOSTAL_ENTIDAD
    );

  if (postalCode) {
    if (
      !/^\d{5}$/.test(
        postalCode
      )
    ) {
      exceptions.postal_code_malformed_kept.push({
        source_record_id: sourceRecordId,
        value: postalCode,
      });
    }
  } else if (addressRaw) {
    const match =
      addressRaw.match(
        /C\.?\s?P\.?\s*(\d{5})/
      );

    if (match) {
      postalCode =
        match[1];

      exceptions.postal_code_recovered.push({
        source_record_id: sourceRecordId,
        value: postalCode,
      });
    }
  }

  const contactProvenance = {};

  if (email) {
    contactProvenance.email = {
      method: "structured",
      source_field:
        "EMAIL_ENTIDAD",
    };
  }

  if (phone) {
    contactProvenance.phone = {
      method: "structured",
      source_field:
        phoneField,
    };
  }

  if (website) {
    contactProvenance.website = {
      method:
        websiteOrigin,
      source_field:
        websiteField,
    };
  }

  const semanticHashPayload = {
    source_id: SOURCE_ID,
    source_record_id:
      sourceRecordId,
    name,
    description,
    original_category:
      originalCategory,
    scope,
    province_key:
      "NAVARRA",
    municipality_name:
      municipalityName,
    address,
    postal_code:
      postalCode,
    email,
    phone,
    website,
    tax_id: taxId,
  };

  const row = {
    ...input,
    address,
    postal_code:
      postalCode,
    email,
    phone,
    website,
    contact_provenance:
      contactProvenance,
    content_hash:
      hashPayload(
        semanticHashPayload
      ),
    relevance:
      envelope.relevance,
  };

  rows.push(row);

  counters.email_present +=
    Boolean(email);

  counters.phone_present +=
    Boolean(phone);

  counters.website_present +=
    Boolean(website);

  counters.postal_code_present +=
    Boolean(postalCode);

  counters.address_present +=
    Boolean(address);

  counters.address_enriched +=
    addressEnriched;

  counters.tax_collision_records +=
    Boolean(
      taxId &&
      taxCollisions.has(
        taxId
      )
    );

  if (
    envelope.relevance.status ===
    "direct_relevance"
  ) {
    counters.relevance_keep += 1;
  } else if (
    envelope.relevance.status ===
    "needs_review"
  ) {
    counters.relevance_review += 1;
  }

  if (websiteOrigin) {
    websiteOrigins[websiteOrigin] += 1;
  }
}

if (
  new Set(
    rows.map(
      (row) =>
        row.candidate_id
    )
  ).size !== 10254
) {
  throw new Error(
    "Duplicate candidate_id"
  );
}

const invariants = {
  rows:
    rows.length ===
    EXPECTED.rows,

  email:
    counters.email_present ===
    EXPECTED.email,

  phone:
    counters.phone_present ===
    EXPECTED.phone,

  website:
    counters.website_present ===
    EXPECTED.website,

  postal_code:
    counters.postal_code_present ===
    EXPECTED.postal_code,

  address:
    counters.address_present ===
    EXPECTED.address,

  address_enriched:
    counters.address_enriched ===
    EXPECTED.address_enriched,

  tax_collision_records:
    counters.tax_collision_records ===
    EXPECTED.tax_collision_records,

  tax_collision_values:
    taxCollisions.size ===
    EXPECTED.tax_collision_values,

  relevance_keep:
    counters.relevance_keep ===
    EXPECTED.relevance_keep,

  relevance_review:
    counters.relevance_review ===
    EXPECTED.relevance_review,
};

const failures = Object
  .entries(invariants)
  .filter(
    ([, ok]) =>
      !ok
  )
  .map(
    ([key]) =>
      key
  );

if (
  failures.length > 0
) {
  throw new Error(
    `Invariant gate failed: ${failures.join(", ")}`
  );
}

const report = {
  format_version: "2",
  dataset:
    "navarra-normalized-v2",
  source_id:
    SOURCE_ID,
  input_rows:
    inputRows.length,
  output_rows:
    rows.length,
  envelope_rows:
    envelopeRows.length,
  counts: counters,
  tax_collision_values:
    taxCollisions.size,
  website_origins:
    websiteOrigins,
  invariants: {
    ...invariants,
    all_passed: true,
  },
  exceptions,
};

fs.writeFileSync(
  OUTPUT_PATH,
  rows
    .map(
      (row) =>
        JSON.stringify(row)
    )
    .join("\n") + "\n"
);

fs.writeFileSync(
  REPORT_PATH,
  JSON.stringify(
    report,
    null,
    2
  ) + "\n"
);

console.log(
  "INPUT_ROWS=",
  report.input_rows
);
console.log(
  "OUTPUT_ROWS=",
  report.output_rows
);
console.log(
  "EMAIL_PRESENT=",
  counters.email_present
);
console.log(
  "PHONE_PRESENT=",
  counters.phone_present
);
console.log(
  "WEBSITE_PRESENT=",
  counters.website_present
);
console.log(
  "POSTAL_CODE_PRESENT=",
  counters.postal_code_present
);
console.log(
  "ADDRESS_PRESENT=",
  counters.address_present
);
console.log(
  "ADDRESS_ENRICHED=",
  counters.address_enriched
);
console.log(
  "TAX_COLLISION_VALUES=",
  taxCollisions.size
);
console.log(
  "TAX_COLLISION_RECORDS=",
  counters.tax_collision_records
);
console.log(
  "RELEVANCE_KEEP=",
  counters.relevance_keep
);
console.log(
  "RELEVANCE_REVIEW=",
  counters.relevance_review
);
console.log(
  "NAVARRA_NORMALIZATION_V2=PASS"
);
