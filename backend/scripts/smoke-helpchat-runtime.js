import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

import {
  findAssociationsForHelpchat,
} from "../services/helpchat-association-service.js";

const { Pool } = pg;

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

const schema =
  process.env.SCHEMA_NAME || "copilot_ong";

if (!/^[A-Za-z0-9_]+$/.test(schema)) {
  throw new Error("SCHEMA_NAME inválido");
}

const details = JSON.parse(
  process.env.DATABASE_DETAILS || "{}"
);

const pool = new Pool({
  user: details.DATABASE_USER,
  host: details.DATABASE_HOST,
  database: details.DATABASE_DATABASE,
  password: details.DATABASE_PASSWORD,
  port: Number(
    process.env.DATABASE_PORT ||
    details.DATABASE_PORT ||
    5432
  ),
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERT_FAIL: ${message}`);
  }
}

async function tagId(description) {
  const result = await pool.query(
    `
    SELECT tag_id
    FROM ${schema}.tags
    WHERE descripcion = $1
    LIMIT 1
    `,
    [description]
  );

  assert(
    result.rows.length === 1,
    `No existe tag ${description}`
  );

  return result.rows[0].tag_id;
}

async function search(tag, province) {
  return findAssociationsForHelpchat({
    pool,
    schemaName: schema,
    tagId: await tagId(tag),
    selectedProvince: province,
    limit: 5,
  });
}

async function main() {
  console.log(
    "============================================================"
  );
  console.log("HELPCHAT RUNTIME SMOKE");
  console.log(
    "============================================================"
  );

  /*
   * 1. Invariantes del catálogo.
   */
  const counts = await pool.query(
    `
    SELECT
      COUNT(*) FILTER (
        WHERE active = TRUE
      )::int AS active,
      COUNT(*) FILTER (
        WHERE active = FALSE
      )::int AS inactive
    FROM ${schema}.associations
    `
  );

  console.log("CATALOG_COUNTS=", counts.rows[0]);

  assert(
    counts.rows[0].active === 270,
    `Se esperaban 270 asociaciones activas y hay ${counts.rows[0].active}`
  );

  /*
   * No debe quedar Markdown estructural en contactos activos.
   */
  const markdown = await pool.query(
    `
    SELECT association_id
    FROM ${schema}.associations
    WHERE active = TRUE
      AND (
        COALESCE(email, '') LIKE '%](%'
        OR COALESCE(website, '') LIKE '%](%'
      )
    LIMIT 1
    `
  );

  assert(
    markdown.rows.length === 0,
    "Hay Markdown residual en contactos activos"
  );

  /*
   * El duplicado retirado debe permanecer inactivo y sin tags.
   */
  const duplicate = await pool.query(
    `
    SELECT
      a.active,
      COUNT(at.tag_id)::int AS tag_count
    FROM ${schema}.associations a
    LEFT JOIN ${schema}.association_tags at
      ON at.association_id = a.association_id
    WHERE a.association_id = 216
    GROUP BY a.active
    `
  );

  assert(
    duplicate.rows.length === 1,
    "No existe association_id=216"
  );

  assert(
    duplicate.rows[0].active === false,
    "association_id=216 debería estar inactiva"
  );

  assert(
    duplicate.rows[0].tag_count === 0,
    "association_id=216 conserva tags"
  );

  console.log("CATALOG_INVARIANTS=PASS");

  /*
   * 2. Caso LOCAL:
   * SALUD MENTAL + Álava -> ASAFES.
   */
  const local = await search(
    "SALUD MENTAL",
    "Álava"
  );

  console.log("LOCAL=", {
    localCount: local.localCount,
    neighborCount: local.neighborCount,
    nationalCount: local.nationalCount,
    fallbackType: local.fallbackType,
    ids: local.associations.map(a => a.id),
  });

  assert(
    local.localCount >= 1,
    "SALUD MENTAL + Álava debería tener resultado local"
  );

  assert(
    local.associations.some(
      association =>
        String(association.id) === "24"
    ),
    "ASAFES (24) no aparece en búsqueda local"
  );

  assert(
    local.fallbackUsed === false,
    "No debería marcar fallback cuando existe resultado local"
  );

  console.log("LOCAL_SEARCH=PASS");

  /*
   * 3. Caso PROVINCIA VECINA:
   * ALZHEIMER + Álava -> Burgos/Navarra.
   */
  const neighbor = await search(
    "ALZHEIMER",
    "Álava"
  );

  console.log("NEIGHBOR=", {
    localCount: neighbor.localCount,
    neighborCount: neighbor.neighborCount,
    nationalCount: neighbor.nationalCount,
    fallbackType: neighbor.fallbackType,
    ids: neighbor.associations.map(a => a.id),
    provinces: neighbor.associations.map(
      a => a.province
    ),
  });

  assert(
    neighbor.localCount === 0,
    "ALZHEIMER + Álava no debería tener resultado local actualmente"
  );

  assert(
    neighbor.neighborCount >= 1,
    "ALZHEIMER + Álava debería encontrar provincia vecina"
  );

  assert(
    neighbor.fallbackType ===
      "neighbor_province",
    "Fallback vecino incorrecto"
  );

  assert(
    neighbor.associations.some(
      association =>
        String(association.id) === "198"
    ),
    "AFA Burgos (198) no aparece"
  );

  assert(
    neighbor.associations.every(
      association =>
        String(association.id) !== "216"
    ),
    "El duplicado 216 reapareció"
  );

  console.log("NEIGHBOR_SEARCH=PASS");

  /*
   * 4. Caso NACIONAL.
   *
   * No fijamos provincia/tag porque el catálogo evoluciona.
   * Elegimos automáticamente una combinación donde:
   *
   * - exista al menos un recurso nacional para el tag;
   * - no exista resultado local;
   * - no exista resultado en provincias vecinas.
   */
  const nationalCandidate = await pool.query(
    `
    SELECT
      t.descripcion AS tag,
      p.name AS province
    FROM ${schema}.tags t

    CROSS JOIN ${schema}.provinces p

    WHERE EXISTS (
      SELECT 1
      FROM ${schema}.association_tags at
      JOIN ${schema}.associations a
        ON a.association_id = at.association_id
       AND a.active = TRUE
      WHERE at.tag_id = t.tag_id
        AND UPPER(COALESCE(a.scope, '')) = 'NACIONAL'
    )

    AND NOT EXISTS (
      SELECT 1
      FROM ${schema}.association_tags at
      JOIN ${schema}.associations a
        ON a.association_id = at.association_id
       AND a.active = TRUE
      WHERE at.tag_id = t.tag_id
        AND a.province_key = p.province_key
    )

    AND NOT EXISTS (
      SELECT 1
      FROM ${schema}.province_neighbors pn
      JOIN ${schema}.associations a
        ON a.province_key = pn.neighbor_key
       AND a.active = TRUE
      JOIN ${schema}.association_tags at
        ON at.association_id = a.association_id
       AND at.tag_id = t.tag_id
      WHERE pn.province_key = p.province_key
    )

    ORDER BY
      t.descripcion,
      p.name

    LIMIT 1
    `
  );

  assert(
    nationalCandidate.rows.length === 1,
    "No se encontró ningún escenario válido de fallback nacional"
  );

  const nationalCase =
    nationalCandidate.rows[0];

  const national = await search(
    nationalCase.tag,
    nationalCase.province
  );

  console.log("NATIONAL_CASE=", nationalCase);

  console.log("NATIONAL=", {
    localCount: national.localCount,
    neighborCount: national.neighborCount,
    nationalCount: national.nationalCount,
    fallbackType: national.fallbackType,
    ids: national.associations.map(a => a.id),
  });

  assert(
    national.localCount === 0,
    "El caso nacional seleccionado tiene resultados locales"
  );

  assert(
    national.neighborCount === 0,
    "El caso nacional seleccionado tiene resultados vecinos"
  );

  assert(
    national.nationalCount >= 1,
    "El caso nacional no devolvió recursos nacionales"
  );

  assert(
    national.fallbackUsed === true,
    "El fallback nacional debería marcar fallbackUsed=true"
  );

  assert(
    national.fallbackType === "national",
    "Fallback nacional incorrecto"
  );

  console.log("NATIONAL_SEARCH=PASS");

  /*
   * 5. Caso SIN RESULTADOS.
   *
   * Elegimos automáticamente un tag operativo y una provincia
   * donde no haya:
   *
   * - resultado local;
   * - resultado vecino;
   * - resultado nacional.
   */
  const emptyCandidate = await pool.query(
    `
    SELECT
      t.descripcion AS tag,
      p.name AS province
    FROM ${schema}.tags t

    CROSS JOIN ${schema}.provinces p

    WHERE EXISTS (
      SELECT 1
      FROM ${schema}.association_tags at
      JOIN ${schema}.associations a
        ON a.association_id = at.association_id
       AND a.active = TRUE
      WHERE at.tag_id = t.tag_id
    )

    AND NOT EXISTS (
      SELECT 1
      FROM ${schema}.association_tags at
      JOIN ${schema}.associations a
        ON a.association_id = at.association_id
       AND a.active = TRUE
      WHERE at.tag_id = t.tag_id
        AND a.province_key = p.province_key
    )

    AND NOT EXISTS (
      SELECT 1
      FROM ${schema}.province_neighbors pn
      JOIN ${schema}.associations a
        ON a.province_key = pn.neighbor_key
       AND a.active = TRUE
      JOIN ${schema}.association_tags at
        ON at.association_id = a.association_id
       AND at.tag_id = t.tag_id
      WHERE pn.province_key = p.province_key
    )

    AND NOT EXISTS (
      SELECT 1
      FROM ${schema}.association_tags at
      JOIN ${schema}.associations a
        ON a.association_id = at.association_id
       AND a.active = TRUE
      WHERE at.tag_id = t.tag_id
        AND UPPER(COALESCE(a.scope, '')) = 'NACIONAL'
    )

    ORDER BY
      t.descripcion,
      p.name

    LIMIT 1
    `
  );

  assert(
    emptyCandidate.rows.length === 1,
    "No se encontró ningún escenario válido de cero resultados"
  );

  const emptyCase =
    emptyCandidate.rows[0];

  const empty = await search(
    emptyCase.tag,
    emptyCase.province
  );

  console.log("NO_RESULTS_CASE=", emptyCase);

  console.log("NO_RESULTS=", {
    localCount: empty.localCount,
    neighborCount: empty.neighborCount,
    nationalCount: empty.nationalCount,
    fallbackType: empty.fallbackType,
    count: empty.associations.length,
  });

  assert(
    empty.localCount === 0,
    "El caso vacío tiene resultados locales"
  );

  assert(
    empty.neighborCount === 0,
    "El caso vacío tiene resultados vecinos"
  );

  assert(
    empty.nationalCount === 0,
    "El caso vacío tiene resultados nacionales"
  );

  assert(
    empty.associations.length === 0,
    "El caso esperado sin resultados devolvió asociaciones"
  );

  assert(
    empty.fallbackUsed === false,
    "Sin resultados fallbackUsed debería ser false"
  );

  assert(
    empty.fallbackType === null,
    "Sin resultados fallbackType debería ser null"
  );

  console.log("NO_RESULTS_SEARCH=PASS");

  console.log(
    "============================================================"
  );
  console.log("HELPCHAT_RUNTIME_SMOKE=PASS");
  console.log(
    "============================================================"
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
