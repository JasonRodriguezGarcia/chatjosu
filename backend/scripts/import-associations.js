import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import ExcelJS from "exceljs";
import pg from "pg";

const { Pool } = pg;

const filename = fileURLToPath(import.meta.url);
const scriptsDirectory = path.dirname(filename);
const backendDirectory = path.resolve(scriptsDirectory, "..");
const envPath = path.join(backendDirectory, ".env");
const workbookPath = path.join(
  backendDirectory,
  "data",
  "ExcelwebAsociaciones.xlsx"
);

dotenv.config({ path: envPath, override: true });

const schemaName = process.env.SCHEMA_NAME;

if (!schemaName || !/^[A-Za-z0-9_]+$/.test(schemaName)) {
  throw new Error("SCHEMA_NAME no es válido.");
}

if (!process.env.DATABASE_DETAILS) {
  throw new Error("DATABASE_DETAILS no está configurado.");
}

const databaseDetails = JSON.parse(process.env.DATABASE_DETAILS);

const pool = new Pool({
  user: databaseDetails.DATABASE_USER,
  host: databaseDetails.DATABASE_HOST,
  database: databaseDetails.DATABASE_DATABASE,
  password: databaseDetails.DATABASE_PASSWORD,
  port: Number(
    process.env.DATABASE_PORT ||
    databaseDetails.DATABASE_PORT ||
    5432
  ),
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

function cleanText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "object") {
    if (Array.isArray(value.richText)) {
      value = value.richText
        .map(part => part?.text || "")
        .join("");
    } else if (typeof value.text === "string") {
      value = value.text;
    } else if (typeof value.result !== "undefined") {
      value = value.result;
    }
  }

  const text = String(value)
    .replace(/\s+/g, " ")
    .trim();

  return text || null;
}

function cellText(cell) {
  const renderedText = cleanText(cell?.text);

  if (renderedText) {
    return renderedText;
  }

  return cleanText(cell?.value);
}

function normalizeKey(value) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("es-ES")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function numericValue(value) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  const parsed = Number(text.replace(",", "."));

  return Number.isFinite(parsed) ? parsed : null;
}

function recordDedupeKey(record) {
  return [
    normalizeKey(record.name),
    record.provinceKey,
    record.municipalityKey,
    normalizeKey(record.address),
  ]
    .map(value => value || "")
    .join("|");
}

function recordContentHash(record) {
  return sha256(
    JSON.stringify({
      sourceSheet: record.sourceSheet,
      sourceRow: record.sourceRow,
      sourceRecordId: record.sourceRecordId,
      name: record.name,
      scope: record.scope,
      pathology: record.pathology,
      helpType: record.helpType,
      province: record.province,
      municipality: record.municipality,
      address: record.address,
      phone: record.phone,
      email: record.email,
      website: record.website,
      description: record.description,
      latitude: record.latitude,
      longitude: record.longitude,
      socialNetworks: record.socialNetworks,
    })
  );
}

function readHeaderMap(worksheet) {
  const map = new Map();

  worksheet
    .getRow(1)
    .eachCell((cell, columnNumber) => {
      const header = normalizeKey(cellText(cell));

      if (header) {
        map.set(header, columnNumber);
      }
    });

  return map;
}

function valueFromRow(row, headerMap, header) {
  const columnNumber = headerMap.get(normalizeKey(header));

  if (!columnNumber) {
    return null;
  }

  return cellText(row.getCell(columnNumber));
}

function parseOriginalSheet(worksheet) {
  const headerMap = readHeaderMap(worksheet);
  const records = [];
  let skippedEmpty = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const name = valueFromRow(
      row,
      headerMap,
      "NOMBRE DE LA ASOCIACIÓN"
    );

    if (!name) {
      skippedEmpty += 1;
      return;
    }

    const province = valueFromRow(
      row,
      headerMap,
      "PROVINCIA"
    );

    const municipality = valueFromRow(
      row,
      headerMap,
      "MUNICIPIO"
    );

    const record = {
      sourceSheet: worksheet.name,
      sourceRow: rowNumber,
      sourceRecordId: null,

      name,
      scope: null,
      pathology: null,
      helpType: valueFromRow(
        row,
        headerMap,
        "TIPO AYUDA"
      ),

      province,
      provinceKey: normalizeKey(province),
      municipality,
      municipalityKey: normalizeKey(municipality),

      address: valueFromRow(
        row,
        headerMap,
        "DIRECCIÓN"
      ),
      phone: valueFromRow(
        row,
        headerMap,
        "TELÉFONO"
      ),
      email: valueFromRow(
        row,
        headerMap,
        "E-MAIL DE CONTACTO"
      ),
      website: valueFromRow(
        row,
        headerMap,
        "PAGINA WEB"
      ),

      description: null,
      latitude: null,
      longitude: null,
      socialNetworks: null,
    };

    record.dedupeKey = recordDedupeKey(record);
    record.contentHash = recordContentHash(record);

    records.push(record);
  });

  return {
    records,
    skippedEmpty,
  };
}

function parseNormalizedSheet(worksheet) {
  const headerMap = readHeaderMap(worksheet);
  const records = [];

  let skippedEmpty = 0;
  let skippedMissingOrganization = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const hasAnyContent = row.values
      .slice(1)
      .some(value => cleanText(value));

    if (!hasAnyContent) {
      skippedEmpty += 1;
      return;
    }

    const name = valueFromRow(
      row,
      headerMap,
      "organizacion"
    );

    if (!name) {
      skippedMissingOrganization += 1;
      return;
    }

    const province = valueFromRow(
      row,
      headerMap,
      "provincia"
    );

    const municipality = valueFromRow(
      row,
      headerMap,
      "municipio"
    );

    const record = {
      sourceSheet: worksheet.name,
      sourceRow: rowNumber,
      sourceRecordId: valueFromRow(
        row,
        headerMap,
        "id"
      ),

      name,
      scope: valueFromRow(
        row,
        headerMap,
        "ambito"
      ),
      pathology: valueFromRow(
        row,
        headerMap,
        "patologia"
      ),
      helpType:
        valueFromRow(row, headerMap, "patologia") ||
        valueFromRow(row, headerMap, "ambito"),

      province,
      provinceKey: normalizeKey(province),
      municipality,
      municipalityKey: normalizeKey(municipality),

      address: valueFromRow(
        row,
        headerMap,
        "direccion"
      ),
      phone: valueFromRow(
        row,
        headerMap,
        "telefono"
      ),
      email: valueFromRow(
        row,
        headerMap,
        "email"
      ),
      website: valueFromRow(
        row,
        headerMap,
        "web"
      ),
      description: valueFromRow(
        row,
        headerMap,
        "descripcion"
      ),

      latitude: numericValue(
        valueFromRow(row, headerMap, "lat")
      ),
      longitude: numericValue(
        valueFromRow(row, headerMap, "lng")
      ),
      socialNetworks: valueFromRow(
        row,
        headerMap,
        "redes_sociales"
      ),
    };

    record.dedupeKey = recordDedupeKey(record);
    record.contentHash = recordContentHash(record);

    records.push(record);
  });

  return {
    records,
    skippedEmpty,
    skippedMissingOrganization,
  };
}

async function loadTagMap(client) {
  const result = await client.query(`
    SELECT tag_id, descripcion
    FROM ${schemaName}.tags
    ORDER BY tag_id;
  `);

  return new Map(
    result.rows.map(tag => [
      normalizeKey(tag.descripcion),
      tag,
    ])
  );
}

function findTag(record, tagMap) {
  const candidates = [
    record.helpType,
    record.pathology,
    record.scope,
  ];

  for (const candidate of candidates) {
    const key = normalizeKey(candidate);

    if (key && tagMap.has(key)) {
      return tagMap.get(key);
    }
  }

  return null;
}

async function upsertAssociation(client, record) {
  const result = await client.query(
    `
    INSERT INTO ${schemaName}.associations (
      source_sheet,
      source_row,
      source_record_id,
      name,
      scope,
      pathology,
      help_type,
      province,
      province_key,
      municipality,
      municipality_key,
      address,
      phone,
      email,
      website,
      description,
      latitude,
      longitude,
      social_networks,
      dedupe_key,
      content_hash,
      active,
      imported_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13, $14,
      $15, $16, $17, $18, $19, $20, $21,
      TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (dedupe_key)
    DO UPDATE SET
      source_sheet = EXCLUDED.source_sheet,
      source_row = EXCLUDED.source_row,
      source_record_id = COALESCE(
        EXCLUDED.source_record_id,
        ${schemaName}.associations.source_record_id
      ),
      name = EXCLUDED.name,
      scope = COALESCE(
        EXCLUDED.scope,
        ${schemaName}.associations.scope
      ),
      pathology = COALESCE(
        EXCLUDED.pathology,
        ${schemaName}.associations.pathology
      ),
      help_type = COALESCE(
        EXCLUDED.help_type,
        ${schemaName}.associations.help_type
      ),
      province = COALESCE(
        EXCLUDED.province,
        ${schemaName}.associations.province
      ),
      province_key = COALESCE(
        EXCLUDED.province_key,
        ${schemaName}.associations.province_key
      ),
      municipality = COALESCE(
        EXCLUDED.municipality,
        ${schemaName}.associations.municipality
      ),
      municipality_key = COALESCE(
        EXCLUDED.municipality_key,
        ${schemaName}.associations.municipality_key
      ),
      address = COALESCE(
        EXCLUDED.address,
        ${schemaName}.associations.address
      ),
      phone = COALESCE(
        EXCLUDED.phone,
        ${schemaName}.associations.phone
      ),
      email = COALESCE(
        EXCLUDED.email,
        ${schemaName}.associations.email
      ),
      website = COALESCE(
        EXCLUDED.website,
        ${schemaName}.associations.website
      ),
      description = COALESCE(
        EXCLUDED.description,
        ${schemaName}.associations.description
      ),
      latitude = COALESCE(
        EXCLUDED.latitude,
        ${schemaName}.associations.latitude
      ),
      longitude = COALESCE(
        EXCLUDED.longitude,
        ${schemaName}.associations.longitude
      ),
      social_networks = COALESCE(
        EXCLUDED.social_networks,
        ${schemaName}.associations.social_networks
      ),
      content_hash = EXCLUDED.content_hash,
      active = TRUE,
      updated_at = CURRENT_TIMESTAMP
    RETURNING association_id;
    `,
    [
      record.sourceSheet,
      record.sourceRow,
      record.sourceRecordId,
      record.name,
      record.scope,
      record.pathology,
      record.helpType,
      record.province,
      record.provinceKey,
      record.municipality,
      record.municipalityKey,
      record.address,
      record.phone,
      record.email,
      record.website,
      record.description,
      record.latitude,
      record.longitude,
      record.socialNetworks,
      record.dedupeKey,
      record.contentHash,
    ]
  );

  return result.rows[0].association_id;
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);

  const originalSheet = workbook.getWorksheet("Hoja 1");
  const normalizedSheet = workbook.getWorksheet("Normal");

  if (!originalSheet) {
    throw new Error('No se encontró la hoja "Hoja 1".');
  }

  if (!normalizedSheet) {
    throw new Error('No se encontró la hoja "Normal".');
  }

  const original = parseOriginalSheet(originalSheet);
  const normalized = parseNormalizedSheet(normalizedSheet);

  /*
   * Procesamos primero la hoja original y después la normalizada.
   * Si ambas contienen la misma asociación, la normalizada puede
   * enriquecer el registro existente mediante el upsert.
   */
  const records = [
    ...original.records,
    ...normalized.records,
  ];

  const client = await pool.connect();

  const report = {
    originalParsed: original.records.length,
    normalizedParsed: normalized.records.length,
    originalSkippedEmpty: original.skippedEmpty,
    normalizedSkippedEmpty: normalized.skippedEmpty,
    normalizedSkippedMissingOrganization:
      normalized.skippedMissingOrganization,

    upserted: 0,
    tagMappings: 0,
    unmatchedTags: new Map(),
  };

  try {
    await client.query("BEGIN");

    await client.query(`
      UPDATE ${schemaName}.associations
      SET active = FALSE,
          updated_at = CURRENT_TIMESTAMP;
    `);

    const tagMap = await loadTagMap(client);

    for (const record of records) {
      const associationId = await upsertAssociation(
        client,
        record
      );

      report.upserted += 1;

      const tag = findTag(record, tagMap);

      if (tag) {
        await client.query(
          `
          INSERT INTO ${schemaName}.association_tags (
            association_id,
            tag_id,
            mapping_source
          )
          VALUES ($1, $2, 'exact')
          ON CONFLICT (association_id, tag_id)
          DO NOTHING;
          `,
          [associationId, tag.tag_id]
        );

        report.tagMappings += 1;
      } else {
        const unmatched =
          cleanText(record.helpType) ||
          cleanText(record.pathology) ||
          cleanText(record.scope) ||
          "(sin categoría)";

        report.unmatchedTags.set(
          unmatched,
          (report.unmatchedTags.get(unmatched) || 0) + 1
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log("===== INFORME DE IMPORTACIÓN =====");
  console.log(
    `ORIGINAL_PARSED=${report.originalParsed}`
  );
  console.log(
    `NORMALIZED_PARSED=${report.normalizedParsed}`
  );
  console.log(
    `ORIGINAL_SKIPPED_EMPTY=${report.originalSkippedEmpty}`
  );
  console.log(
    `NORMALIZED_SKIPPED_EMPTY=${report.normalizedSkippedEmpty}`
  );
  console.log(
    `NORMALIZED_SKIPPED_MISSING_ORGANIZATION=` +
    report.normalizedSkippedMissingOrganization
  );
  console.log(`UPSERTED=${report.upserted}`);
  console.log(`TAG_MAPPINGS=${report.tagMappings}`);

  console.log();
  console.log("===== CATEGORÍAS SIN MATCH EXACTO =====");

  const unmatchedEntries = [
    ...report.unmatchedTags.entries(),
  ].sort(
    (left, right) =>
      right[1] - left[1] ||
      left[0].localeCompare(right[0], "es")
  );

  for (const [value, count] of unmatchedEntries) {
    console.log(`${count}\t${value}`);
  }

  console.log();
  console.log("ASSOCIATION_IMPORT=PASS");
}

main().catch(error => {
  console.error("ASSOCIATION_IMPORT=FAIL");
  console.error(error);
  process.exitCode = 1;
});
