import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  classifyAssociationRelevance,
} from "./lib/association-relevance-v1.js";
import {
  buildAssociationUtilityGateV1,
} from "./lib/association-utility-gate-v1.js";
import {
  normalizeContactFieldsV1,
} from "./lib/association-contact-normalization-v1.js";

const ROOT = process.cwd();

const SOURCE_ID = "canarias_registro_asociaciones";

const SOURCE_ROOT = path.join(ROOT, "data/acquisition", SOURCE_ID);

const MANIFEST_FILE = path.join(SOURCE_ROOT, "manifest.json");

const OUT_JSONL = path.join(SOURCE_ROOT, "normalized.jsonl");

const OUT_REPORT = path.join(SOURCE_ROOT, "normalization-report-v1.json");

const EXPECTED_HEADER = [
  "id",
  "registro",
  "nif",
  "denominacion",
  "ambito",
  "seccion",
  "actividades",
  "fecha_constitucion",
  "direccion_nombre_via",
  "direccion_provincia_nombre",
  "direccion_isla_nombre",
  "direccion_municipio_nombre",
  "direccion_codigo_postal",
  "teléfono",
  "dominio_internet",
  "email",
];

const PROVINCES = {
  "Santa Cruz de Tenerife": {
    key: "SANTA CRUZ DE TENERIFE",
    name: "Santa Cruz de Tenerife",
    ine: "38",
  },
  "Las Palmas": {
    key: "LAS PALMAS",
    name: "Las Palmas",
    ine: "35",
  },
};

const ISLANDS = {
  TENERIFE: "Tenerife",
  "GRAN CANARIA": "Gran Canaria",
  LANZAROTE: "Lanzarote",
  "LA PALMA": "La Palma",
  FUERTEVENTURA: "Fuerteventura",
  "LA GOMERA": "La Gomera",
  "EL HIERRO": "El Hierro",
  "LA GRACIOSA": "La Graciosa",
};

const SCOPE_BY_AMBITO = {
  AUTONÓMICO: "Autonómico",
  NACIONAL: "Nacional",
  PROVINCIAL: "Provincial",
  INSULAR: "Desconocido",
  COMARCAL: "Desconocido",
  LOCAL: "Local",
  MUNICIPAL: "Local",
};

const ROLE_BY_SECCION = {
  "Sección 1 - Asociaciones": "asociacion",
  "Sección 1 - Asoc. Nacionales/Extranjeras": "nacional_extranjera",
  "Sección 2 - Federaciones": "federacion",
  "Sección 2 - Registro Especial": "registro_especial",
};

const NIF_PATTERN = /^[A-Z]\d{8}$|^\d{8}[A-Z]$/;

function clean(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();

  if (trimmed === "" || trimmed === "_U") {
    return null;
  }

  return trimmed;
}

function sameArray(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function parseSemicolonCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ";") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\r") {
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += ch;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function titleCase(value) {
  return value
    .split(/\s+/)
    .map((word) =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function municipalityKeyFrom(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function classifyNif(rawValue) {
  if (rawValue === null) {
    return {
      tax_id: null,
      tax_id_status: "missing",
    };
  }

  const upper = rawValue.toUpperCase();

  if (NIF_PATTERN.test(upper)) {
    return {
      tax_id: upper,
      tax_id_status: "valid_format",
    };
  }

  return {
    tax_id: null,
    tax_id_status: "malformed",
  };
}

function serviceCoverage(ambito, provinceName, municipalityName) {
  switch (ambito) {
    case "AUTONÓMICO":
      return {
        geo_type: "comunidad_autonoma",
        geo_value: "Canarias",
        confidence: "high",
      };
    case "NACIONAL":
      return {
        geo_type: "nacion",
        geo_value: "España",
        confidence: "high",
      };
    case "PROVINCIAL":
      return {
        geo_type: "provincia",
        geo_value: provinceName,
        confidence: "low",
      };
    case "INSULAR":
      return {
        geo_type: "island",
        geo_value: null,
        evidence:
          "ambito=INSULAR; isla de servicio no declarada",
        confidence: "low",
      };
    case "COMARCAL":
      return {
        geo_type: "comarca",
        geo_value: null,
        confidence: "low",
      };
    case "LOCAL":
    case "MUNICIPAL":
      return {
        geo_type: "municipio",
        geo_value: municipalityName,
        confidence: "medium",
      };
    default:
      return null;
  }
}

function classifyPostalCode(postalCode, provinceKey) {
  if (!postalCode) {
    return "missing";
  }

  if (!provinceKey) {
    return "unverifiable";
  }

  let expected = null;

  if (postalCode.startsWith("35")) {
    expected = "LAS PALMAS";
  } else if (postalCode.startsWith("38")) {
    expected = "SANTA CRUZ DE TENERIFE";
  }

  if (expected === null) {
    return "foreign_prefix";
  }

  if (expected !== provinceKey) {
    return "mismatch";
  }

  return "match";
}

function distribution(entries) {
  const counts = new Map();

  for (const entry of entries) {
    const label = entry === null ? "null" : entry;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort(
    (a, b) =>
      b[1] - a[1] ||
      String(a[0]).localeCompare(String(b[0]))
  );

  return Object.fromEntries(sorted);
}

async function probeSourceFreshness(manifest) {
  const url =
    "https://datos.canarias.es/catalogos/general/api/3/action/package_show?id=" +
    manifest.ckan_dataset_id;

  const probe = {
    url,
    status: "failed",
    fetched_at: new Date().toISOString(),
    metadata_modified: null,
    resource_last_modified_max: null,
    error: null,
  };

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "copilot-ong-normalization/1.0",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      probe.error = `http_${response.status}`;
      return probe;
    }

    const body = await response.json();

    if (!body || body.success !== true || !body.result) {
      probe.error = "unexpected_body";
      return probe;
    }

    probe.status = "ok";
    probe.metadata_modified =
      body.result.metadata?.modified ?? null;

    const lastModified = (body.result.resources ?? [])
      .map((resource) => resource.last_modified)
      .filter(Boolean)
      .sort();

    probe.resource_last_modified_max =
      lastModified.length > 0
        ? lastModified[lastModified.length - 1]
        : null;
  } catch (error) {
    probe.error = String(error?.message ?? error);
  }

  return probe;
}

async function main() {
  const manifest = JSON.parse(
    fs.readFileSync(MANIFEST_FILE, "utf8")
  );

  const rawFile = path.join(ROOT, manifest.raw_file);

  const rawText = fs.readFileSync(rawFile, "utf8");

  const rawSha256 = crypto
    .createHash("sha256")
    .update(rawText)
    .digest("hex");

  if (rawSha256 !== manifest.sha256) {
    throw new Error(
      `raw sha256 mismatch: ${rawSha256} != ${manifest.sha256}`
    );
  }

  const parsed = parseSemicolonCsv(rawText);

  if (
    parsed.length === 0 ||
    !sameArray(parsed[0], EXPECTED_HEADER)
  ) {
    throw new Error(
      `header mismatch: ${JSON.stringify(parsed[0])}`
    );
  }

  const header = parsed[0];

  const index = Object.fromEntries(
    header.map((name, i) => [name, i])
  );

  const dataRows = parsed.slice(1);

  const badLength = dataRows.findIndex(
    (row) => row.length !== header.length
  );

  if (badLength !== -1) {
    throw new Error(
      `column count drift at data row ${badLength}: ` +
      `${dataRows[badLength].length} != ${header.length}`
    );
  }

  const probe = await probeSourceFreshness(manifest);

  const records = [];
  const candidateIds = new Set();
  const recordIds = new Set();
  const activityParts = new Set();
  const activityCells = new Set();

  const nameMissing = { count: 0 };
  const nifStats = {
    valid_format: 0,
    malformed: 0,
    missing: 0,
  };
  const postalStats = {
    match: 0,
    missing: 0,
    mismatch: 0,
    foreign_prefix: 0,
    unverifiable: 0,
  };
  const contactStats = {
    phone_present: 0,
    email_present: 0,
    website_present: 0,
    multi_phone_rows: 0,
    multi_email_rows: 0,
    multi_actividad_rows: 0,
  };
  const unknowns = {
    province: 0,
    island: 0,
    ambito: 0,
    seccion: 0,
  };

  const scopeEntries = [];
  const roleEntries = [];
  const provinceEntries = [];
  const islandEntries = [];
  const ambitoEntries = [];
  const relevanceEntries = [];
  const utilityEntries = [];

  for (let i = 0; i < dataRows.length; i += 1) {
    const row = dataRows[i];

    const cell = (name) => clean(row[index[name]]);

    const registro = cell("registro");
    const nifRaw = cell("nif");
    const denominacion = cell("denominacion");
    const ambito = cell("ambito");
    const seccion = cell("seccion");
    const actividades = cell("actividades");
    const provinciaRaw = cell("direccion_provincia_nombre");
    const islaRaw = cell("direccion_isla_nombre");
    const municipioRaw = cell("direccion_municipio_nombre");
    const cpRaw = cell("direccion_codigo_postal");
    const viaRaw = cell("direccion_nombre_via");
    const telefonoRaw = cell("teléfono");
    const webRaw = cell("dominio_internet");
    const emailRaw = cell("email");

    const recordId = registro ?? cell("id");

    if (recordId === null) {
      throw new Error(
        `data row ${i}: registro and id both missing`
      );
    }

    const name =
      denominacion === null
        ? null
        : denominacion.toUpperCase();

    if (name === null) {
      nameMissing.count += 1;
    }

    const province =
      provinciaRaw === null
        ? null
        : PROVINCES[provinciaRaw] ?? null;

    if (provinciaRaw !== null && province === null) {
      unknowns.province += 1;
    }

    const island =
      islaRaw === null
        ? null
        : ISLANDS[islaRaw] ?? null;

    if (islaRaw !== null && island === null) {
      unknowns.island += 1;
    }

    const municipalityName =
      municipioRaw === null
        ? null
        : titleCase(municipioRaw);

    const municipalityKey =
      municipioRaw === null
        ? null
        : municipalityKeyFrom(municipioRaw);

    const scope =
      ambito === null
        ? "Desconocido"
        : SCOPE_BY_AMBITO[ambito] ?? "Desconocido";

    if (ambito !== null && SCOPE_BY_AMBITO[ambito] === undefined) {
      unknowns.ambito += 1;
    }

    const coverage = serviceCoverage(
      ambito,
      province?.name ?? null,
      municipalityName
    );

    const resourceRole =
      seccion === null
        ? null
        : ROLE_BY_SECCION[seccion] ?? null;

    if (seccion !== null && ROLE_BY_SECCION[seccion] === undefined) {
      unknowns.seccion += 1;
    }

    const nif = classifyNif(nifRaw);

    nifStats[nif.tax_id_status] += 1;

    const canonicalId = nif.tax_id ?? recordId;

    const candidateId = `${SOURCE_ID}:${recordId}`;

    candidateIds.add(candidateId);
    recordIds.add(recordId);

    const postalClass = classifyPostalCode(
      cpRaw,
      province?.key ?? null
    );

    postalStats[postalClass] += 1;

    const contact = normalizeContactFieldsV1({
      phone: telefonoRaw,
      email: emailRaw,
      website: webRaw,
    });

    if (contact.phone !== null) {
      contactStats.phone_present += 1;
    }

    if (contact.email !== null) {
      contactStats.email_present += 1;
    }

    if (contact.website !== null) {
      contactStats.website_present += 1;
    }

    if (telefonoRaw !== null && telefonoRaw.includes(";")) {
      contactStats.multi_phone_rows += 1;
    }

    if (emailRaw !== null && emailRaw.includes(";")) {
      contactStats.multi_email_rows += 1;
    }

    const sourceCategories =
      actividades === null
        ? []
        : actividades
          .split(";")
          .map((part) => part.trim())
          .filter((part) => part !== "");

    if (actividades !== null && actividades.includes(";")) {
      contactStats.multi_actividad_rows += 1;
    }

    for (const part of sourceCategories) {
      activityParts.add(part);
    }

    if (actividades !== null) {
      activityCells.add(actividades);
    }

    const originalCategory =
      sourceCategories.length > 0
        ? sourceCategories.join(" | ")
        : null;

    const relevance = classifyAssociationRelevance({
      name,
      categories: sourceCategories,
      text: [],
    });

    const utility = buildAssociationUtilityGateV1({
      relevanceDecision: relevance.decision,
      needKeys: [],
      functionKeys: [],
      hints: [],
    });

    scopeEntries.push(scope);
    roleEntries.push(resourceRole);
    provinceEntries.push(province?.key ?? null);
    islandEntries.push(island);
    ambitoEntries.push(ambito);
    relevanceEntries.push(relevance.status);
    utilityEntries.push(utility.decision);

    records.push({
      candidate_id: candidateId,
      source_record_id: recordId,
      name,
      tax_id: nif.tax_id,
      scope,
      province_key: province?.key ?? null,
      province_name: province?.name ?? null,
      province_ine_code: province?.ine ?? null,
      municipality_key: municipalityKey,
      municipality_name: municipalityName,
      municipality_source_code: null,
      address: viaRaw,
      postal_code: cpRaw,
      phone: contact.phone,
      email: contact.email,
      website: contact.website,
      contact_provenance: contact.provenance,
      latitude: null,
      longitude: null,
      location_precision:
        municipalityName !== null
          ? "municipality"
          : "province",
      description: null,
      original_category: originalCategory,
      source_categories: sourceCategories,
      relevance,
      utility,
      resource_role: resourceRole,
      source: {
        source_id: SOURCE_ID,
        publisher: manifest.publisher,
        record_id: recordId,
        source_url: manifest.source_url,
        record_url: null,
        detail_url: null,
        acquired_at: manifest.acquired_at,
        raw_file: manifest.raw_file,
        source_row_index: i,
        territory_resolution: "source_address_fields",
        coordinate_method: null,
      },
      dedupe: {
        status: "new_candidate",
        method: null,
        master_association_ids: [],
      },
      island,
      service_coverage: coverage,
      contact_channels: [
        "phone",
        "email",
        "website",
      ].filter((channel) => contact[channel] !== null),
      delivery_modes: [],
      delivery_modes_resolution: "no_delivery_field_in_source",
      tax_id_provenance: {
        source_field: "nif",
        raw_value: nifRaw,
        source: "registro_asociaciones_canarias",
      },
      tax_id_status: nif.tax_id_status,
      canonical_id: canonicalId,
    });
  }

  const updatedSinceAcquisition =
    probe.status === "ok" &&
    probe.resource_last_modified_max !== null &&
    new Date(probe.resource_last_modified_max) >
      new Date(manifest.acquired_at);

  const report = {
    format_version: 1,
    dataset: SOURCE_ID,
    generated_at: new Date().toISOString(),
    source_rows: dataRows.length,
    output_rows: records.length,
    source_record_ids_unique: recordIds.size,
    name_missing: nameMissing.count,
    tax_id_status: nifStats,
    postal_code: postalStats,
    contact: contactStats,
    unique_actividades: activityParts.size,
    distinct_actividades_cells: activityCells.size,
    distributions: {
      scope: distribution(scopeEntries),
      resource_role: distribution(roleEntries),
      province_key: distribution(provinceEntries),
      island: distribution(islandEntries),
      ambito: distribution(ambitoEntries),
      relevance_status: distribution(relevanceEntries),
      utility_decision: distribution(utilityEntries),
    },
    unknowns,
    invariants: {
      source_output_parity:
        dataRows.length === records.length,
      unique_candidate_ids:
        candidateIds.size === records.length,
      personal_contact_promoted: false,
    },
    source_freshness: {
      manifest: {
        source_issued: manifest.source_issued,
        source_modified: manifest.source_modified,
        acquired_at: manifest.acquired_at,
        publisher_snapshot_date: "2021-01-20",
        publisher_snapshot_date_source:
          "raw_file_name:resultado_asociaciones_20012021.csv",
      },
      probe,
      updated_since_acquisition: updatedSinceAcquisition,
      source_stale:
        probe.status === "ok"
          ? updatedSinceAcquisition
          : null,
      note:
        "resource last_modified <= acquired_at; " +
        "publisher registry snapshot (2021-01-20) predates " +
        "acquisition; re-verify content before production import",
    },
    production_import: "no — requiere revisión",
  };

  const jsonl =
    records.map((record) => JSON.stringify(record)).join("\n") +
    "\n";

  fs.writeFileSync(OUT_JSONL, jsonl, "utf8");

  fs.writeFileSync(
    OUT_REPORT,
    JSON.stringify(report, null, 2) + "\n",
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        rows: records.length,
        jsonl_sha256: crypto
          .createHash("sha256")
          .update(jsonl)
          .digest("hex"),
        normalized: path.relative(ROOT, OUT_JSONL),
        report: path.relative(ROOT, OUT_REPORT),
        probe: probe.status,
        invariants: report.invariants,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
