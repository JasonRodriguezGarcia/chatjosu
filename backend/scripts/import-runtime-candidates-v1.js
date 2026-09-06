import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(backendDir, '..');

dotenv.config({ path: path.join(backendDir, '.env') });

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

const SOURCE_FILES = {
  euskadi: path.join(
    'data',
    'acquisition',
    'euskadi_registro_asociaciones',
    'runtime-candidates.jsonl'
  ),
  navarra: path.join(
    'data',
    'acquisition',
    'navarra_registro_asociaciones',
    'runtime-candidates.jsonl'
  ),
};

/*
 * Helpers puros (sin pg), exportados para tests unitarios (D6).
 * El mapeo candidato->fila es determinista y estable entre re-ejecuciones.
 */
function cleanText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text || null;
}

function cleanName(value) {
  let text = cleanText(value);
  if (!text) return null;
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1).trim();
  }
  return text || null;
}

function normalizeScope(raw) {
  if (raw === null || raw === undefined) return 'Desconocido';
  const text = String(raw).trim();
  if (!text) return 'Desconocido';
  const upper = text.toUpperCase();
  if (upper === 'L') return 'Local';
  if (upper === 'N') return 'Nacional';
  if (upper === 'LOCAL' || upper === 'MUNICIPAL') return 'Local';
  if (upper === 'COMARCAL') return 'Desconocido';
  if (upper.includes('C.A.')) return 'Autonómico';
  if (upper.includes('T.H.')) return 'Provincial';
  return 'Desconocido';
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function contentHash({ name, provinceKey, address, website }) {
  const payload = [name || '', provinceKey || '', address || '', website || ''].join('|');
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

function nifToRow(tax) {
  const digits = String(tax).replace(/[^0-9]/g, '');
  if (!digits) return 0;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}

function validateCanonicalTags(candidates, tagMap) {
  const unknown = [];

  for (const candidate of candidates) {
    const candidateIdentity =
      candidate.source_record_id ||
      candidate.source_id ||
      'unknown';

    for (const tag of candidate.tags) {
      if (!tagMap.has(tag.key)) {
        unknown.push({
          tagKey: tag.key,
          candidateIdentity,
        });
      }
    }
  }

  if (!unknown.length) return;

  unknown.sort((a, b) => {
    const identityOrder =
      String(a.candidateIdentity)
        .localeCompare(
          String(b.candidateIdentity)
        );

    if (identityOrder) {
      return identityOrder;
    }

    return a.tagKey.localeCompare(b.tagKey);
  });

  const diagnostic = unknown
    .map(
      ({ tagKey, candidateIdentity }) =>
        `${tagKey} (candidate: ${candidateIdentity})`
    )
    .join('; ');

  throw new Error(
    `Unknown canonical tag(s) found: ${diagnostic}`
  );
}

function mapCandidate(row, source) {
  const name = cleanName(row.name);
  const provinceKey = cleanText(row.province_key);
  const address = cleanText(row.address);
  const website = cleanText(row.website);

  const tax = (row.tax_id || '').trim();
  const registryId =
    source === 'euskadi'
      ? cleanText(row.source && row.source.record_id)
      : cleanText(row.source && row.source.num_registro);
  const idValue = tax || registryId;

  return {
    name,
    scope: normalizeScope(row.scope),
    province_key: provinceKey,
    municipality_id: null,
    address,
    postal_code: cleanText(row.postal_code),
    phone: cleanText(row.phone),
    email: cleanText(row.email),
    website,
    description: cleanText(row.description),
    latitude: numberOrNull(row.latitude),
    longitude: numberOrNull(row.longitude),
    location_precision:
      source === 'euskadi' ? cleanText(row.source && row.source.coordinate_method) : null,
    source_sheet: idValue || 'unknown',
    source_row: tax ? nifToRow(tax) : 0,
    source_id: idValue || null,
    source_quality: null,
    content_hash: contentHash({ name, provinceKey, address, website }),
    source_record_id: idValue || null,
    record_url: source === 'euskadi' ? cleanText(row.source && row.source.record_url) : null,
    detail_url: source === 'euskadi' ? cleanText(row.source && row.source.detail_url) : null,
    relevance_status: cleanText(row.relevance && row.relevance.status),
    resource_role: cleanText(row.resource_role),
    tags: (Array.isArray(row.tags) ? row.tags : [])
      .map(tag => ({ key: cleanText(tag.key), category: cleanText(tag.category) }))
      .filter(tag => tag.key),
  };
}

function parseArgs(argv) {
  const args = { source: null, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--source') args.source = argv[++i];
    else if (arg.startsWith('--source=')) args.source = arg.slice('--source='.length);
  }
  return args;
}

async function main() {
  const { source, dryRun } = parseArgs(process.argv);
  if (source !== 'euskadi' && source !== 'navarra') {
    console.error('Uso: node import-runtime-candidates-v1.js --source euskadi|navarra [--dry-run]');
    process.exit(2);
  }

  const dataFile = path.join(repoRoot, SOURCE_FILES[source]);
  if (!fs.existsSync(dataFile)) {
    throw new Error(`Archivo no encontrado: ${dataFile}`);
  }

  const lines = fs
    .readFileSync(dataFile, 'utf8')
    .split('\n')
    .filter(line => line.trim());
  const candidates = lines.map(line => JSON.parse(line));
  const mapped = candidates.map(candidate => mapCandidate(candidate, source));
  const valid = mapped.filter(row => row.name);
  const invalid = mapped.length - valid.length;

  const scopeDist = {};
  const provinceDist = {};
  let nifPresent = 0;
  for (const row of mapped) {
    scopeDist[row.scope] = (scopeDist[row.scope] || 0) + 1;
    provinceDist[row.province_key || 'null'] = (provinceDist[row.province_key || 'null'] || 0) + 1;
  }
  for (const candidate of candidates) {
    if ((candidate.tax_id || '').trim()) nifPresent += 1;
  }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const reportsDir = path.join(repoRoot, 'data', 'reports');
  const reportFile = path.join(reportsDir, `import-${source}-${dateStr}.json`);

  const client = await pool.connect();
  let result;
  try {
    await client.query(
      dryRun ? 'BEGIN READ ONLY' : 'BEGIN'
    );

    const tagRes = await client.query(
      `SELECT tag_key, tag_id FROM ${schema}.tags WHERE tag_key IS NOT NULL`
    );
    const tagMap = new Map(tagRes.rows.map(row => [row.tag_key, row.tag_id]));

    validateCanonicalTags(valid, tagMap);

    const uniqueHashes = [...new Set(valid.map(row => row.content_hash))];
    const existingRes = uniqueHashes.length
      ? await client.query(
          `SELECT content_hash FROM ${schema}.associations WHERE content_hash = ANY($1)`,
          [uniqueHashes]
        )
      : { rows: [] };
    const existingSet = new Set(existingRes.rows.map(row => String(row.content_hash).trim()));

    const seen = new Set();
    const toInsert = [];
    let skippedExisting = 0;
    let skippedIntra = 0;
    for (const row of valid) {
      if (existingSet.has(row.content_hash)) {
        skippedExisting += 1;
        continue;
      }
      if (seen.has(row.content_hash)) {
        skippedIntra += 1;
        continue;
      }
      seen.add(row.content_hash);
      toInsert.push(row);
    }

    let ids = [];

    if (dryRun) {
      if (toInsert.length) {
        const maxIdRes = await client.query(
          `SELECT COALESCE(MAX(association_id), 0) AS max_id FROM ${schema}.associations`
        );

        const maxId =
          Number(maxIdRes.rows[0]?.max_id || 0);

        const firstId =
          maxId > 0 ? maxId + 1 : 1;

        ids = Array.from(
          { length: toInsert.length },
          (_, index) => firstId + index
        );
      }
    } else {
      await client.query(
        `CREATE SEQUENCE IF NOT EXISTS ${schema}.association_id_seq`
      );

      await client.query(
        `SELECT setval('${schema}.association_id_seq', GREATEST(COALESCE(MAX(association_id),0), 1), COALESCE(MAX(association_id),0) > 0) FROM ${schema}.associations`
      );

      if (toInsert.length) {
        const idRes = await client.query(
          `SELECT nextval('${schema}.association_id_seq') AS id FROM generate_series(1, $1)`,
          [toInsert.length]
        );

        ids = idRes.rows.map(
          row => Number(row.id)
        );
      }
    }

    toInsert.forEach((row, index) => {
      row.association_id = ids[index];
    });

    if (!dryRun) {
      for (const row of toInsert) {
      await client.query(
        `INSERT INTO ${schema}.associations (
          association_id, name, scope, province_key, municipality_id,
          address, postal_code, phone, email, website, description,
          latitude, longitude, location_precision,
          source_sheet, source_row, source_id, source_quality, content_hash,
          source_record_id, record_url, detail_url, relevance_status, resource_role,
          active
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
          $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
          TRUE
        )
        ON CONFLICT (content_hash) DO NOTHING`,
        [
          row.association_id,
          row.name,
          row.scope,
          row.province_key,
          row.municipality_id,
          row.address,
          row.postal_code,
          row.phone,
          row.email,
          row.website,
          row.description,
          row.latitude,
          row.longitude,
          row.location_precision,
          row.source_sheet,
          row.source_row,
          row.source_id,
          row.source_quality,
          row.content_hash,
          row.source_record_id,
          row.record_url,
          row.detail_url,
          row.relevance_status,
          row.resource_role,
        ]
        );
      }
    }

    let tagsInserted = 0;

    if (dryRun) {
      for (const row of toInsert) {
        tagsInserted += new Set(
          row.tags.map(tag => tag.key)
        ).size;
      }
    } else {
      for (const row of toInsert) {
      for (const tag of row.tags) {
        const tagId = tagMap.get(tag.key);

        if (tagId === undefined) {
          const candidateIdentity =
            row.source_record_id ||
            row.source_id ||
            'unknown';

          throw new Error(
            `Unknown canonical tag after validation: ${tag.key} ` +
            `(candidate: ${candidateIdentity})`
          );
        }

        const res = await client.query(
          `INSERT INTO ${schema}.association_tags (association_id, tag_id, category_source, mapping_source)
           VALUES ($1, $2, $3, 'runtime_candidates_v1')
           ON CONFLICT (association_id, tag_id) DO NOTHING`,
          [row.association_id, tagId, tag.category]
        );
        if (res.rowCount) {
          tagsInserted += res.rowCount;
        }
      }
    }
    }

    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }

    result = {
      new: toInsert.length,
      skippedExisting,
      skippedIntra,
      tagsInserted,
      unknownTags: [],
      associationIdRange: toInsert.length
        ? [toInsert[0].association_id, toInsert[toInsert.length - 1].association_id]
        : null,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  const summary = {
    source,
    dry_run: dryRun,
    generated_at: new Date().toISOString(),
    total_candidates: candidates.length,
    invalid_no_name: invalid,
    new: result.new,
    skipped_existing: result.skippedExisting,
    skipped_intra_duplicate: result.skippedIntra,
    tags_inserted: result.tagsInserted,
    unknown_tags: result.unknownTags,
    association_id_range: result.associationIdRange,
    nif_present: nifPresent,
    nif_absent: candidates.length - nifPresent,
    scope_distribution: scopeDist,
    province_distribution: provinceDist,
    report_file:
      dryRun ? null : reportFile,
  };

  if (!dryRun) {
    fs.mkdirSync(
      reportsDir,
      { recursive: true }
    );

    fs.writeFileSync(
      reportFile,
      `${JSON.stringify(summary, null, 2)}\n`,
      'utf8'
    );
  }

  console.log(JSON.stringify(summary, null, 2));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch(async error => {
    console.error(error);
    try {
      await pool.end();
    } catch {
      /* noop */
    }
    process.exitCode = 1;
  });
}

export { mapCandidate, normalizeScope, contentHash, cleanName, nifToRow, validateCanonicalTags };
