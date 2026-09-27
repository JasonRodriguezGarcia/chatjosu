import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

const dataPath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!dataPath) {
  console.error('Uso: node import-normalized-associations-json.js <json> [--dry-run]');
  process.exit(2);
}

const scriptDir = path.dirname(
  fileURLToPath(import.meta.url)
);

const backendDir = path.resolve(
  scriptDir,
  ".."
);

dotenv.config({
  path: path.join(backendDir, ".env"),
});

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
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text || null;
}

function unwrapMarkdownLink(value) {
  const text = clean(value);

  if (!text) return null;

  /*
   * Formatos heredados:
   *
   *   [correo@dominio.es](mailto:correo@dominio.es)
   *   [correo@dominio.es](mailto\\:correo@dominio.es)
   *   [https://ejemplo.org/](https://ejemplo.org/)
   *
   * Evitamos regex complejo deliberadamente: el formato
   * Markdown se puede separar de forma determinista.
   */
  if (
    text.startsWith("[") &&
    text.endsWith(")")
  ) {
    const separator = text.indexOf("](");

    if (separator > 1) {
      const label = clean(
        text.slice(1, separator)
      );

      let target = clean(
        text.slice(separator + 2, -1)
      );

      if (target) {
        const lower = target.toLowerCase();

        if (lower.startsWith("mailto\\:")) {
          target = target.slice(8);
        } else if (lower.startsWith("mailto:")) {
          target = target.slice(7);
        }
      }

      if (label?.includes("@")) {
        return label;
      }

      if (
        target?.startsWith("http://") ||
        target?.startsWith("https://")
      ) {
        return target;
      }

      return label || target || null;
    }
  }

  return text;
}

function cleanEmail(value) {
  return unwrapMarkdownLink(value);
}

function cleanWebsite(value) {
  const cleaned = unwrapMarkdownLink(value);

  if (!cleaned) return null;

  const normalized = cleaned
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

  const placeholders = new Set([
    'CONSULTAR EN WEB',
    'CONSULTAR EN WEB SEDE',
    'CONSULTAR WEB SEDE',
    'CONSULTAR EN SEDE',
  ]);

  return placeholders.has(normalized)
    ? null
    : cleaned;
}

function boolYes(value) {
  return ['sí', 'si', 'yes', 'true', '1'].includes(String(value || '').trim().toLowerCase());
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

async function main() {
  const absolutePath = path.resolve(dataPath);
  const payload = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));

  const allAssociations = Array.isArray(payload.associations) ? payload.associations : [];
  const importable = allAssociations.filter(row => boolYes(row.importar));

  const managedAssociationIds = allAssociations
    .map(row => Number(row.association_id))
    .filter(id => Number.isSafeInteger(id) && id > 0);

  const uniqueManagedAssociationIds =
    [...new Set(managedAssociationIds)];

  if (
    managedAssociationIds.length !==
    uniqueManagedAssociationIds.length
  ) {
    throw new Error(
      'Hay association_id duplicados en el dataset normalizado'
    );
  }
  const tags = (Array.isArray(payload.tags) ? payload.tags : [])
    .filter(row => row.tag_id && row.tag_canonico);
  const provinces = (Array.isArray(payload.provinces) ? payload.provinces : [])
    .filter(row =>
      row.provincia_key &&
      String(row.provincia_key).trim().toUpperCase() !== 'NACIONAL'
    );

  const problems = [];

  if (
    managedAssociationIds.length !==
    allAssociations.length
  ) {
    problems.push(
      'Hay association_id ausentes o inválidos en el dataset'
    );
  }

  for (const row of importable) {
    if (!row.association_id) problems.push('association_id ausente');
    if (!clean(row.nombre)) problems.push(`Nombre ausente en ${row.association_id}`);
    if (!clean(row.tag_canonico)) problems.push(`Tag ausente en ${row.association_id}`);
    if (clean(row.alcance) !== 'Nacional' && !clean(row.provincia_key)) {
      problems.push(`Provincia ausente en ${row.association_id}`);
    }
    if (!clean(row.hash_contenido)) problems.push(`Hash ausente en ${row.association_id}`);
  }

  if (problems.length) {
    throw new Error(`Validación fallida:\n${problems.slice(0, 30).join('\n')}`);
  }

  console.log(`TOTAL=${allAssociations.length}`);
  console.log(`IMPORTABLE=${importable.length}`);
  console.log(`TAGS=${tags.length}`);
  console.log(`PROVINCES_CATALOG=${provinces.length}`);

  if (dryRun) {
    console.log('DRY_RUN=PASS');
    await pool.end();
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    /*
     * Reconciliación canónica:
     *
     * El JSON completo define el universo que gestiona este
     * importador. Primero desactivamos sus asociaciones y
     * eliminamos sus relaciones de tags. Después, las filas
     * importables se reconstruyen y vuelven a active=TRUE.
     *
     * Esto permite:
     *   Sí -> No
     *   No -> Sí
     *   cambio de tag
     *
     * sin afectar asociaciones ajenas al dataset.
     */
    if (uniqueManagedAssociationIds.length > 0) {
      await client.query(
        `UPDATE ${schema}.associations
         SET
           active = FALSE,
           updated_at = CURRENT_TIMESTAMP
         WHERE association_id = ANY($1::bigint[])`,
        [uniqueManagedAssociationIds]
      );

      await client.query(
        `DELETE FROM ${schema}.association_tags
         WHERE association_id = ANY($1::bigint[])`,
        [uniqueManagedAssociationIds]
      );
    }

    for (const tag of tags) {
      await client.query(
        `INSERT INTO ${schema}.tags (tag_id, descripcion)
         VALUES ($1, $2)
         ON CONFLICT (tag_id) DO UPDATE SET descripcion = EXCLUDED.descripcion`,
        [Number(tag.tag_id), clean(tag.tag_canonico)]
      );
    }

    // Prefer the canonical province catalog from the normalized dataset.
    for (const province of provinces) {
      await client.query(
        `INSERT INTO ${schema}.provinces (
           province_key, name, geocoding_precision, source
         )
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (province_key) DO UPDATE SET
           name = EXCLUDED.name,
           geocoding_precision = COALESCE(EXCLUDED.geocoding_precision, ${schema}.provinces.geocoding_precision),
           source = COALESCE(EXCLUDED.source, ${schema}.provinces.source),
           updated_at = CURRENT_TIMESTAMP`,
        [
          clean(province.provincia_key),
          clean(province.provincia) || clean(province.provincia_key),
          clean(province.geocodificacion),
          'normalized_dataset',
        ]
      );
    }

    // Also ensure any province referenced by importable rows exists.
    for (const row of importable) {
      const provinceKey = clean(row.provincia_key);
      if (!provinceKey) continue;

      await client.query(
        `INSERT INTO ${schema}.provinces (province_key, name, source)
         VALUES ($1, $2, 'normalized_dataset')
         ON CONFLICT (province_key) DO UPDATE SET
           name = EXCLUDED.name,
           updated_at = CURRENT_TIMESTAMP`,
        [provinceKey, clean(row.provincia) || provinceKey]
      );
    }

    const tagMapResult = await client.query(
      `SELECT tag_id, descripcion FROM ${schema}.tags`
    );
    const tagMap = new Map(
      tagMapResult.rows.map(row => [clean(row.descripcion), row.tag_id])
    );

    let imported = 0;

    for (const row of importable) {
      let municipalityId = null;
      const provinceKey = clean(row.provincia_key);
      const municipalityKey = clean(row.municipio_key);

      if (provinceKey && municipalityKey) {
        const municipality = await client.query(
          `INSERT INTO ${schema}.municipalities (
             municipality_key, province_key, name, source
           )
           VALUES ($1, $2, $3, 'normalized_dataset')
           ON CONFLICT (province_key, municipality_key)
           DO UPDATE SET name = EXCLUDED.name
           RETURNING municipality_id`,
          [municipalityKey, provinceKey, clean(row.municipio) || municipalityKey]
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
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
           TRUE,CURRENT_TIMESTAMP
         )
         ON CONFLICT (association_id) DO UPDATE SET
           name=EXCLUDED.name,
           scope=EXCLUDED.scope,
           province_key=EXCLUDED.province_key,
           municipality_id=EXCLUDED.municipality_id,
           address=EXCLUDED.address,
           postal_code=EXCLUDED.postal_code,
           phone=EXCLUDED.phone,
           email=EXCLUDED.email,
           website=EXCLUDED.website,
           description=EXCLUDED.description,
           latitude=EXCLUDED.latitude,
           longitude=EXCLUDED.longitude,
           location_precision=EXCLUDED.location_precision,
           source_sheet=EXCLUDED.source_sheet,
           source_row=EXCLUDED.source_row,
           source_id=EXCLUDED.source_id,
           source_quality=EXCLUDED.source_quality,
           content_hash=EXCLUDED.content_hash,
           active=TRUE,
           updated_at=CURRENT_TIMESTAMP`,
        [
          associationId,
          clean(row.nombre),
          clean(row.alcance) || 'Desconocido',
          provinceKey,
          municipalityId,
          clean(row.direccion),
          clean(row.codigo_postal),
          clean(row.telefono),
          cleanEmail(row.email),
          cleanWebsite(row.web),
          clean(row.descripcion),
          numberOrNull(row.latitud),
          numberOrNull(row.longitud),
          clean(row.precision_ubicacion),
          clean(row.hoja_origen) || 'normalized_dataset',
          Number(row.fila_origen || 0),
          clean(row.id_origen),
          clean(row.calidad_origen),
          clean(row.hash_contenido),
        ]
      );

      const tagId = tagMap.get(clean(row.tag_canonico));
      if (!tagId) throw new Error(`Tag inexistente: ${row.tag_canonico}`);

      await client.query(
        `INSERT INTO ${schema}.association_tags (
           association_id, tag_id, category_source
         )
         VALUES ($1, $2, $3)
         ON CONFLICT (association_id, tag_id)
         DO UPDATE SET category_source = EXCLUDED.category_source`,
        [associationId, tagId, clean(row.categoria_origen)]
      );

      imported += 1;
    }

    await client.query('COMMIT');

    const nonImportableManaged =
      uniqueManagedAssociationIds.length - imported;

    console.log(`IMPORTED=${imported}`);
    console.log(`MANAGED=${uniqueManagedAssociationIds.length}`);
    console.log(`NON_IMPORTABLE_MANAGED=${nonImportableManaged}`);
    console.log('IMPORT=PASS');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async error => {
  console.error(error);
  try { await pool.end(); } catch {}
  process.exitCode = 1;
});
