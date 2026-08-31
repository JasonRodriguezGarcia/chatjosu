import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workbookPath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!workbookPath) {
  console.error('Uso: node import-normalized-associations.js <xlsx> [--dry-run]');
  process.exit(2);
}

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const schema = process.env.SCHEMA_NAME || 'copilot_ong';
if (!/^[A-Za-z0-9_]+$/.test(schema)) throw new Error('SCHEMA_NAME inválido');

const details = JSON.parse(process.env.DATABASE_DETAILS || '{}');
const pool = new Pool({
  user: details.DATABASE_USER,
  host: details.DATABASE_HOST,
  database: details.DATABASE_DATABASE,
  password: details.DATABASE_PASSWORD,
  port: Number(process.env.DATABASE_PORT || details.DATABASE_PORT || 5432),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

function clean(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && Array.isArray(value.richText)) {
    value = value.richText.map(part => part.text || '').join('');
  }
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text || null;
}

function boolYes(value) {
  return ['sí', 'si', 'yes', 'true', '1'].includes(String(value || '').trim().toLowerCase());
}

function numberOrNull(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function headersFor(sheet) {
  const headers = [];
  sheet.getRow(1).eachCell((cell, col) => { headers[col] = clean(cell.text || cell.value); });
  return headers;
}

function rowsFor(sheet) {
  const headers = headersFor(sheet);
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record = {};
    headers.forEach((header, col) => {
      if (header) record[header] = clean(row.getCell(col).text || row.getCell(col).value);
    });
    if (Object.values(record).some(Boolean)) rows.push(record);
  });
  return rows;
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.resolve(workbookPath));
  const associationsSheet = workbook.getWorksheet('Asociaciones');
  const tagsSheet = workbook.getWorksheet('Tags');
  if (!associationsSheet || !tagsSheet) throw new Error('Faltan hojas Asociaciones o Tags');

  const allAssociations = rowsFor(associationsSheet);
  const importable = allAssociations.filter(row => boolYes(row.importar));
  const tags = rowsFor(tagsSheet).filter(row => row.tag_id && row.tag_canonico);

  const problems = [];
  for (const row of importable) {
    if (!row.association_id) problems.push('association_id ausente');
    if (!row.nombre) problems.push(`Nombre ausente en ${row.association_id}`);
    if (!row.tag_canonico) problems.push(`Tag ausente en ${row.association_id}`);
    if (row.alcance !== 'Nacional' && !row.provincia_key) {
      problems.push(`Provincia ausente en ${row.association_id}`);
    }
    if (!row.hash_contenido) problems.push(`Hash ausente en ${row.association_id}`);
  }
  if (problems.length) throw new Error(`Validación fallida:\n${problems.slice(0, 30).join('\n')}`);

  console.log(`TOTAL=${allAssociations.length}`);
  console.log(`IMPORTABLE=${importable.length}`);
  console.log(`TAGS=${tags.length}`);
  if (dryRun) {
    console.log('DRY_RUN=PASS');
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const tag of tags) {
      await client.query(
        `INSERT INTO ${schema}.tags (tag_id, descripcion)
         VALUES ($1, $2)
         ON CONFLICT (tag_id) DO UPDATE SET descripcion = EXCLUDED.descripcion`,
        [Number(tag.tag_id), tag.tag_canonico]
      );
    }

    const provinceNames = new Map();
    for (const row of importable) {
      if (row.provincia_key) provinceNames.set(row.provincia_key, row.provincia || row.provincia_key);
    }
    for (const [key, name] of provinceNames) {
      await client.query(
        `INSERT INTO ${schema}.provinces (province_key, name)
         VALUES ($1, $2)
         ON CONFLICT (province_key) DO UPDATE SET name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP`,
        [key, name]
      );
    }

    const tagMapResult = await client.query(`SELECT tag_id, descripcion FROM ${schema}.tags`);
    const tagMap = new Map(tagMapResult.rows.map(row => [row.descripcion, row.tag_id]));

    let imported = 0;
    for (const row of importable) {
      let municipalityId = null;
      if (row.provincia_key && row.municipio_key) {
        const municipality = await client.query(
          `INSERT INTO ${schema}.municipalities (municipality_key, province_key, name)
           VALUES ($1, $2, $3)
           ON CONFLICT (province_key, municipality_key)
           DO UPDATE SET name = EXCLUDED.name
           RETURNING municipality_id`,
          [row.municipio_key, row.provincia_key, row.municipio || row.municipio_key]
        );
        municipalityId = municipality.rows[0].municipality_id;
      }

      const associationId = Number(row.association_id);
      await client.query(
        `INSERT INTO ${schema}.associations (
           association_id, name, scope, province_key, municipality_id,
           address, postal_code, phone, email, website, description,
           latitude, longitude, location_precision,
           source_sheet, source_row, source_id, source_quality, content_hash,
           active, updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,TRUE,CURRENT_TIMESTAMP
         )
         ON CONFLICT (association_id) DO UPDATE SET
           name=EXCLUDED.name, scope=EXCLUDED.scope, province_key=EXCLUDED.province_key,
           municipality_id=EXCLUDED.municipality_id, address=EXCLUDED.address,
           postal_code=EXCLUDED.postal_code, phone=EXCLUDED.phone, email=EXCLUDED.email,
           website=EXCLUDED.website, description=EXCLUDED.description,
           latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
           location_precision=EXCLUDED.location_precision, source_sheet=EXCLUDED.source_sheet,
           source_row=EXCLUDED.source_row, source_id=EXCLUDED.source_id,
           source_quality=EXCLUDED.source_quality, content_hash=EXCLUDED.content_hash,
           active=TRUE, updated_at=CURRENT_TIMESTAMP`,
        [
          associationId, row.nombre, row.alcance || 'Desconocido', row.provincia_key,
          municipalityId, row.direccion, row.codigo_postal, row.telefono, row.email,
          row.web, row.descripcion, numberOrNull(row.latitud), numberOrNull(row.longitud),
          row.precision_ubicacion, row.hoja_origen, Number(row.fila_origen), row.id_origen,
          row.calidad_origen, row.hash_contenido,
        ]
      );

      const tagId = tagMap.get(row.tag_canonico);
      if (!tagId) throw new Error(`Tag inexistente: ${row.tag_canonico}`);
      await client.query(
        `INSERT INTO ${schema}.association_tags (association_id, tag_id, category_source)
         VALUES ($1, $2, $3)
         ON CONFLICT (association_id, tag_id)
         DO UPDATE SET category_source = EXCLUDED.category_source`,
        [associationId, tagId, row.categoria_origen]
      );
      imported += 1;
    }

    await client.query('COMMIT');
    console.log(`IMPORTED=${imported}`);
    console.log('IMPORT=PASS');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
