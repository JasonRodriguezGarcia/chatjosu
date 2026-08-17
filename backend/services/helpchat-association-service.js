function normalizeLookup(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("es-ES")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PROVINCE_ALIASES = new Map([
  ["ARABA", "ALAVA"],
  ["ALAVA", "ALAVA"],

  ["GIPUZKOA", "GUIPUZCOA"],
  ["GUIPUZCOA", "GUIPUZCOA"],

  ["BIZKAIA", "VIZCAYA"],
  ["VIZCAYA", "VIZCAYA"],

  ["A CORUNA", "A CORUNA"],
  ["LA CORUNA", "A CORUNA"],
  ["CORUNA", "A CORUNA"],

  ["ALICANTE ALACANT", "ALICANTE"],
  ["ALICANTE", "ALICANTE"],
  ["ALACANT", "ALICANTE"],

  ["CASTELLON CASTELLO", "CASTELLON"],
  ["CASTELLON", "CASTELLON"],
  ["CASTELLO", "CASTELLON"],

  ["VALENCIA VALENCIA", "VALENCIA"],
]);

function canonicalProvinceLookup(value) {
  const normalized = normalizeLookup(value);

  return PROVINCE_ALIASES.get(normalized) || normalized;
}

function provinceCandidates(value) {
  const result = new Set();

  const whole = canonicalProvinceLookup(value);

  if (whole) {
    result.add(whole);
  }

  for (const part of String(value || "").split("/")) {
    const normalized = canonicalProvinceLookup(part);

    if (normalized) {
      result.add(normalized);
    }
  }

  return [...result];
}

/*
 * Algunos registros de origen contienen:
 *
 *   [correo@dominio.es](mailto:correo@dominio.es)
 *   [https://web.es/](https://web.es/)
 *
 * Incluso pueden conservar una barra invertida antes de ":".
 *
 * Lo limpiamos al presentar el resultado sin alterar todavía
 * el dato fuente.
 */
function unwrapMarkdownLink(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const markdownMatch = text.match(
    /^\[([^\]]+)\]\((.+)\)$/
  );

  if (!markdownMatch) {
    return text;
  }

  const label = markdownMatch[1].trim();

  const target = markdownMatch[2]
    .trim()
    .replace(/^mailto\\?:/i, "")
    .replace(/^mailto:/i, "");

  if (label.includes("@")) {
    return label;
  }

  if (/^https?:\/\//i.test(target)) {
    return target;
  }

  return label || target || null;
}

const CONTACT_PLACEHOLDERS =
  new Set([
    "CONSULTAR EN WEB",
    "CONSULTAR EN WEB SEDE",
    "CONSULTAR WEB SEDE",
    "CONSULTAR EN SEDE",
    "NO DISPONIBLE",
    "CONTACTO POR EMAIL TELEFONO",
    "CONTACTO POR TELEFONO EMAIL",
    "CONTACTO POR EMAIL",
    "CONTACTO POR TELEFONO",
  ]);

function cleanPlaceholder(value) {
  const cleaned = unwrapMarkdownLink(value);

  if (!cleaned) {
    return null;
  }

  const normalized =
    normalizeLookup(cleaned);

  return CONTACT_PLACEHOLDERS.has(
    normalized
  )
    ? null
    : cleaned;
}

function cleanWebsite(value) {
  const cleaned =
    cleanPlaceholder(value);

  if (!cleaned) {
    return null;
  }

  /*
   * La columna website puede contener notas humanas.
   * Sólo exponemos valores que tengan forma de web.
   *
   * Admitimos:
   *   https://example.org
   *   http://example.org
   *   www.example.org
   *   example.org
   */
  if (
    /^https?:\/\//i.test(cleaned) ||
    /^www\./i.test(cleaned) ||
    /^[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}(?:[\/:?#].*)?$/.test(
      cleaned
    )
  ) {
    return cleaned;
  }

  return null;
}

function normalizeAssociationRow(row) {
  return {
    ...row,
    phone:
      cleanPlaceholder(row.phone),
    email:
      cleanPlaceholder(row.email),
    website:
      cleanWebsite(row.website),
  };
}

export function normalizeAssociationContactFieldsV1(
  row,
) {
  return normalizeAssociationRow(
    row
  );
}

export async function resolveProvince(
  pool,
  schemaName,
  selectedProvince
) {
  const result = await pool.query(
    `
    SELECT
      province_key,
      name
    FROM ${schemaName}.provinces
    ORDER BY name;
    `
  );

  const requestedCandidates =
    provinceCandidates(selectedProvince);

  for (const province of result.rows) {
    const dbCandidates = new Set([
      canonicalProvinceLookup(province.province_key),
      canonicalProvinceLookup(province.name),

      ...String(province.name || "")
        .split("/")
        .map(canonicalProvinceLookup),
    ]);

    if (
      requestedCandidates.some(candidate =>
        dbCandidates.has(candidate)
      )
    ) {
      return {
        requestedProvince: selectedProvince,
        provinceKey: province.province_key,
        provinceName: province.name,
        resolved: true,
      };
    }
  }

  return {
    requestedProvince: selectedProvince,
    provinceKey:
      canonicalProvinceLookup(selectedProvince) || null,
    provinceName: selectedProvince,
    resolved: false,
  };
}

async function queryAssociations({
  pool,
  schemaName,
  tagId,
  provinceKey,
  nationalOnly = false,
  limit,
}) {
  const conditions = [
    "a.active = TRUE",
    "at.tag_id = $1",
  ];

  const params = [tagId];

  if (nationalOnly) {
    conditions.push(
      `UPPER(COALESCE(a.scope, '')) = 'NACIONAL'`
    );
  } else {
    params.push(provinceKey);

    conditions.push(
      `a.province_key = $${params.length}`
    );
  }

  params.push(limit);

  const result = await pool.query(
    `
    SELECT
      a.association_id AS id,
      a.name,
      a.scope,
      a.province_key,
      p.name AS province,
      m.name AS municipality,
      a.address,
      a.postal_code,
      a.phone,
      a.email,
      a.website,
      a.description,
      a.latitude,
      a.longitude,
      a.location_precision,
      NULL::numeric AS distance_km
    FROM ${schemaName}.associations AS a

    JOIN ${schemaName}.association_tags AS at
      ON at.association_id = a.association_id

    LEFT JOIN ${schemaName}.provinces AS p
      ON p.province_key = a.province_key

    LEFT JOIN ${schemaName}.municipalities AS m
      ON m.municipality_id = a.municipality_id

    WHERE
      ${conditions.join("\n      AND ")}

    ORDER BY
      CASE
        WHEN a.phone IS NOT NULL
          OR a.email IS NOT NULL
          OR a.website IS NOT NULL
        THEN 0
        ELSE 1
      END,
      a.name

    LIMIT $${params.length};
    `,
    params
  );

  return result.rows.map(normalizeAssociationRow);
}

async function queryNeighborAssociations({
  pool,
  schemaName,
  tagId,
  provinceKey,
  limit,
}) {
  const result = await pool.query(
    `
    SELECT
      a.association_id AS id,
      a.name,
      a.scope,
      a.province_key,
      p.name AS province,
      m.name AS municipality,
      a.address,
      a.postal_code,
      a.phone,
      a.email,
      a.website,
      a.description,
      a.latitude,
      a.longitude,
      a.location_precision,
      pn.distance_km
    FROM ${schemaName}.province_neighbors AS pn

    JOIN ${schemaName}.associations AS a
      ON a.province_key = pn.neighbor_key
     AND a.active = TRUE

    JOIN ${schemaName}.association_tags AS at
      ON at.association_id = a.association_id
     AND at.tag_id = $1

    LEFT JOIN ${schemaName}.provinces AS p
      ON p.province_key = a.province_key

    LEFT JOIN ${schemaName}.municipalities AS m
      ON m.municipality_id = a.municipality_id

    WHERE
      pn.province_key = $2

    ORDER BY
      pn.distance_km NULLS LAST,
      CASE
        WHEN a.phone IS NOT NULL
          OR a.email IS NOT NULL
          OR a.website IS NOT NULL
        THEN 0
        ELSE 1
      END,
      p.name,
      a.name

    LIMIT $3;
    `,
    [tagId, provinceKey, limit]
  );

  return result.rows.map(normalizeAssociationRow);
}

export async function findAssociationsForHelpchat({
  pool,
  schemaName,
  tagId,
  selectedProvince,
  limit = 5,
}) {
  const province = await resolveProvince(
    pool,
    schemaName,
    selectedProvince
  );

  const local = province.provinceKey
    ? await queryAssociations({
        pool,
        schemaName,
        tagId,
        provinceKey: province.provinceKey,
        limit,
      })
    : [];

  let neighbors = [];

  if (
    local.length < limit &&
    province.provinceKey
  ) {
    neighbors = await queryNeighborAssociations({
      pool,
      schemaName,
      tagId,
      provinceKey: province.provinceKey,
      limit: limit - local.length,
    });
  }

  let national = [];

  if (
    local.length + neighbors.length < limit
  ) {
    national = await queryAssociations({
      pool,
      schemaName,
      tagId,
      nationalOnly: true,
      limit:
        limit -
        local.length -
        neighbors.length,
    });
  }

  const seenIds = new Set();
  const seenContactKeys = new Set();
  const associations = [];

  function usableContact(value) {
    const normalized = normalizeLookup(value);

    if (!normalized) {
      return null;
    }

    return CONTACT_PLACEHOLDERS.has(
      normalized
    )
      ? null
      : normalized;
  }

  function associationContactKey(association) {
    const province = usableContact(
      association.province_key
    );

    const address = usableContact(
      association.address
    );

    const phone = usableContact(
      association.phone
    );

    const website = usableContact(
      association.website
    );

    /*
     * Solo deduplicamos cuando existe información de contacto
     * suficientemente específica. No usamos placeholders.
     */
    if (!province || (!phone && !website)) {
      return null;
    }

    return [
      province,
      address || "",
      phone || "",
      website || "",
    ].join("|");
  }

  const scopedGroups = [
    [local, "local"],
    [neighbors, "neighbor_province"],
    [national, "national"],
  ];

  for (const [
    group,
    resultScope,
  ] of scopedGroups) {
    for (const association of group) {
      if (seenIds.has(association.id)) {
        continue;
      }

      const contactKey =
        associationContactKey(association);

      if (
        contactKey &&
        seenContactKeys.has(contactKey)
      ) {
        continue;
      }

      seenIds.add(association.id);

      if (contactKey) {
        seenContactKeys.add(contactKey);
      }

      associations.push({
        ...association,
        resultScope,
      });
    }
  }

  let fallbackType = null;

  if (local.length === 0) {
    if (neighbors.length > 0) {
      fallbackType = "neighbor_province";
    } else if (national.length > 0) {
      fallbackType = "national";
    }
  }

  return {
    requestedProvince: selectedProvince,

    resolvedProvince: province.resolved
      ? province.provinceName
      : selectedProvince,

    resolvedProvinceKey: province.provinceKey,

    localCount: local.length,
    neighborCount: neighbors.length,
    nationalCount: national.length,

    fallbackUsed: fallbackType !== null,
    fallbackType,

    associations,
  };
}
