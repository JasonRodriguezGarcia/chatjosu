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

const LIST_PATH = path.join(
  ACQ_DIR,
  "raw/asociaciones.json"
);

const DETAILS_DIR = path.join(
  ACQ_DIR,
  "raw/details"
);

const OUTPUT_PATH = path.join(
  ACQ_DIR,
  "normalized.jsonl"
);

const REPORT_PATH = path.join(
  ACQ_DIR,
  "normalization-report-v1.json"
);

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

function normalizeEmail(value) {
  const text = clean(value);

  if (!text) {
    return null;
  }

  return text.toLowerCase();
}

function normalizeWebsite(value) {
  let text = clean(value);

  if (!text) {
    return null;
  }

  if (
    !/^https?:\/\//i.test(text)
  ) {
    text = `https://${text}`;
  }

  return text;
}

function normalizePhone(value) {
  const text = clean(value);

  if (!text) {
    return null;
  }

  return text;
}

function municipalityKey(value) {
  const text = clean(value);

  if (!text) {
    return null;
  }

  return text
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toUpperCase()
    .replace(
      /[^A-Z0-9]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    ) || null;
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

const list = readJson(
  LIST_PATH
);

if (
  !Array.isArray(list) ||
  list.length !== 10254
) {
  throw new Error(
    `Unexpected source rows: ${
      Array.isArray(list)
        ? list.length
        : "not-array"
    }`
  );
}

const sourceIds =
  new Set();

const taxGroups =
  new Map();

for (const base of list) {
  const co = String(
    base.CO_REGISTRO
  );

  if (sourceIds.has(co)) {
    throw new Error(
      `Duplicate CO_REGISTRO: ${co}`
    );
  }

  sourceIds.add(co);

  const detailPath =
    path.join(
      DETAILS_DIR,
      `${co}.json`
    );

  if (
    !fs.existsSync(
      detailPath
    )
  ) {
    throw new Error(
      `Missing detail: ${co}`
    );
  }

  const detail =
    readJson(detailPath);

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
  fines_present: 0,
  email_present: 0,
  phone_present: 0,
  website_present: 0,
  address_present: 0,
  municipality_present: 0,
  tax_id_present: 0,
  tax_id_collision_records: 0,
};

for (const base of list) {
  const sourceRecordId =
    String(
      base.CO_REGISTRO
    );

  const detail =
    readJson(
      path.join(
        DETAILS_DIR,
        `${sourceRecordId}.json`
      )
    );

  /*
   * Detail and list names matched
   * 10,254 / 10,254 in the source
   * quality audit. Detail is therefore
   * the richer canonical source here.
   */
  const name =
    clean(
      detail.RAZON_SOCIAL
    );

  const description =
    clean(
      detail.FINES
    );

  const taxId =
    normalizeTaxId(
      detail.NIF_CIF_NIE_DNI
    );

  const email =
    normalizeEmail(
      detail.EMAIL_ENTIDAD
    );

  /*
   * HelpChat currently has one normalized
   * phone slot. Preserve the first available
   * institutional phone. All originals remain
   * losslessly available in raw/details.
   */
  const phone =
    normalizePhone(
      detail.TELEFONO1_ENTIDAD
    ) ||
    normalizePhone(
      detail.TELEFONO2_ENTIDAD
    ) ||
    normalizePhone(
      detail.TELEFONO3_ENTIDAD
    );

  const website =
    normalizeWebsite(
      detail.DIRECCION_WEB
    );

  const address =
    clean(
      detail.DIRECCION_ENTIDAD
    );

  const postalCode =
    clean(
      detail.CODIGOPOSTAL_ENTIDAD
    );

  const municipalityName =
    clean(
      detail.MUNICIPIO_ENTIDAD
    ) ||
    clean(
      detail.LOCALIDAD_ENTIDAD
    );

  const locality =
    clean(
      detail.LOCALIDAD_ENTIDAD
    );

  const originalCategory =
    clean(
      detail.CLASE
    );

  const scope =
    clean(
      detail.AMBITO
    );

  const candidateId =
    `${SOURCE_ID}:${sourceRecordId}`;

  const contactProvenance = {};

  if (email) {
    contactProvenance.email = {
      method: "structured",
      source_field:
        "EMAIL_ENTIDAD",
    };
  }

  if (phone) {
    const phoneField =
      clean(
        detail.TELEFONO1_ENTIDAD
      )
        ? "TELEFONO1_ENTIDAD"
        : clean(
            detail.TELEFONO2_ENTIDAD
          )
        ? "TELEFONO2_ENTIDAD"
        : "TELEFONO3_ENTIDAD";

    contactProvenance.phone = {
      method: "structured",
      source_field:
        phoneField,
    };
  }

  if (website) {
    contactProvenance.website = {
      method: "structured",
      source_field:
        "DIRECCION_WEB",
    };
  }

  const hasTaxCollision =
    Boolean(
      taxId &&
      taxCollisions.has(
        taxId
      )
    );

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
    candidate_id:
      candidateId,

    source_id:
      SOURCE_ID,

    source_record_id:
      sourceRecordId,

    source: {
      source_id:
        SOURCE_ID,
      source_record_id:
        sourceRecordId,
      num_registro:
        clean(
          detail.NUM_REGISTRO
        ),
      tipo_registro:
        clean(
          detail.TIPO_REGISTRO
        ),
    },

    content_hash:
      hashPayload(
        semanticHashPayload
      ),

    name,
    description,

    original_category:
      originalCategory,

    source_categories: {
      clase:
        originalCategory,
      clase_eusk:
        clean(
          detail.CLASEEUSK
        ),
    },

    scope,

    province_key:
      "NAVARRA",

    province_name:
      "Navarra",

    municipality_name:
      municipalityName,

    municipality_key:
      municipalityKey(
        municipalityName
      ),

    locality_name:
      locality,

    address,
    postal_code:
      postalCode,

    email,
    phone,
    website,

    contact_provenance:
      contactProvenance,

    tax_id:
      taxId,

    /*
     * Same CIF/NIF is a review signal,
     * never an automatic merge.
     */
    dedupe: {
      status:
        hasTaxCollision
          ? "tax_id_collision"
          : "new_candidate",

      method:
        hasTaxCollision
          ? "tax_id"
          : null,

      source_record_ids:
        hasTaxCollision
          ? taxCollisions.get(
              taxId
            )
          : [],
    },

    /*
     * Semantic/resource decisions are
     * intentionally unset here.
     */
    relevance: null,
    utility: null,
    resource_role: null,

    location_precision:
      municipalityName
        ? "municipality"
        : "province",

    /*
     * PERSONA_CONTACTO intentionally
     * excluded from normalized/runtime.
     * It remains only in raw provenance.
     */
    privacy: {
      personal_contact_promoted:
        false,
    },
  };

  rows.push(row);

  counters.fines_present +=
    Boolean(description);

  counters.email_present +=
    Boolean(email);

  counters.phone_present +=
    Boolean(phone);

  counters.website_present +=
    Boolean(website);

  counters.address_present +=
    Boolean(address);

  counters.municipality_present +=
    Boolean(
      municipalityName
    );

  counters.tax_id_present +=
    Boolean(taxId);

  counters.tax_id_collision_records +=
    hasTaxCollision;
}

if (
  rows.length !== 10254
) {
  throw new Error(
    `Unexpected normalized rows: ${rows.length}`
  );
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

const report = {
  format_version: "1",
  dataset:
    "navarra-normalized-v1",

  source_id:
    SOURCE_ID,

  source_rows:
    list.length,

  output_rows:
    rows.length,

  source_record_ids_unique:
    sourceIds.size,

  tax_id_collision_values:
    taxCollisions.size,

  ...counters,

  invariants: {
    source_output_parity:
      rows.length ===
      list.length,

    unique_candidate_ids:
      true,

    personal_contact_promoted:
      false,
  },
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
  "SOURCE_ROWS=",
  report.source_rows
);
console.log(
  "NORMALIZED_ROWS=",
  report.output_rows
);
console.log(
  "FINES_PRESENT=",
  report.fines_present
);
console.log(
  "MUNICIPALITY_PRESENT=",
  report.municipality_present
);
console.log(
  "ADDRESS_PRESENT=",
  report.address_present
);
console.log(
  "EMAIL_PRESENT=",
  report.email_present
);
console.log(
  "PHONE_PRESENT=",
  report.phone_present
);
console.log(
  "WEBSITE_PRESENT=",
  report.website_present
);
console.log(
  "TAX_ID_PRESENT=",
  report.tax_id_present
);
console.log(
  "TAX_ID_COLLISION_VALUES=",
  report.tax_id_collision_values
);
console.log(
  "TAX_ID_COLLISION_RECORDS=",
  report.tax_id_collision_records
);
console.log(
  "PERSONAL_CONTACT_PROMOTED=0"
);
console.log(
  "NAVARRA_NORMALIZATION_V1=PASS"
);
