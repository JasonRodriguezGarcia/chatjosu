import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

const CANONICAL = path.join(
  ROOT,
  "backend/data/Asociaciones_ONG_normalizadas.json"
);

const MASTER_DIR = path.join(
  ROOT,
  "data/master"
);

const CURATION_DIR = path.join(
  ROOT,
  "data/curation"
);

const BASE_PATH = path.join(
  MASTER_DIR,
  "associations.base.jsonl"
);

const OVERRIDES_PATH = path.join(
  CURATION_DIR,
  "association-overrides.jsonl"
);

const FIELD_ENRICHMENT_PATH = path.join(
  ROOT,
  "data/enrichment/field-enrichment.jsonl"
);

const TAGS_PATH = path.join(
  MASTER_DIR,
  "tags.json"
);

const PROVINCES_PATH = path.join(
  MASTER_DIR,
  "provinces.json"
);

const MANIFEST_PATH = path.join(
  MASTER_DIR,
  "manifest.json"
);

const OUTPUT_PATH = path.join(
  ROOT,
  "backend/data/Asociaciones_ONG_normalizadas_v3.json"
);

function clean(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
}

function isYes(value) {
  return ["sí", "si", "yes", "true", "1"].includes(
    String(value ?? "").trim().toLocaleLowerCase("es")
  );
}

function writeJson(pathname, value) {
  fs.writeFileSync(
    pathname,
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

function writeJsonl(pathname, rows) {
  const output = rows
    .map((row) => JSON.stringify(row))
    .join("\n");

  fs.writeFileSync(
    pathname,
    `${output}\n`,
    "utf8"
  );
}

function readJsonl(pathname) {
  const text = fs.readFileSync(
    pathname,
    "utf8"
  );

  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(
          `JSONL inválido ${pathname}:${index + 1}: ${error.message}`
        );
      }
    });
}

function reasonCodes(row) {
  const observation = clean(
    row.observaciones
  );

  if (!observation) {
    return [];
  }

  const normalized = observation.toLocaleLowerCase("es");
  const result = [];

  if (normalized.includes("duplicad")) {
    result.push("structural_duplicate");
  }

  if (
    normalized.includes(
      "sin categoría explícita"
    )
  ) {
    result.push(
      "missing_source_category"
    );
  }

  if (
    normalized.includes(
      "tag canónico pendiente"
    )
  ) {
    result.push(
      "canonical_tag_pending"
    );
  }

  if (
    normalized.includes(
      "sin contacto verificable"
    )
  ) {
    result.push(
      "unverified_contact"
    );
  }

  if (result.length === 0) {
    result.push(
      "curation_note"
    );
  }

  return result;
}

function duplicateOf(row) {
  const observation = clean(
    row.observaciones
  );

  if (!observation) {
    return null;
  }

  const match = observation.match(
    /association_id\s+(\d+)/i
  );

  return match
    ? Number(match[1])
    : null;
}

function statusFor(row) {
  const enabled = isYes(
    row.importar
  );

  const duplicate = reasonCodes(
    row
  ).includes(
    "structural_duplicate"
  );

  if (duplicate) {
    return "duplicate";
  }

  if (enabled) {
    return "ready";
  }

  if (!clean(row.tag_canonico)) {
    return "needs_enrichment";
  }

  return "needs_review";
}

function bootstrap() {
  const payload = JSON.parse(
    fs.readFileSync(
      CANONICAL,
      "utf8"
    )
  );

  const baseRows = payload.associations
    .map((row) => ({
      association_id: Number(
        row.association_id
      ),
      name: clean(
        row.nombre
      ),
      scope: clean(
        row.alcance
      ),
      province_key: clean(
        row.provincia_key
      ),
      province_name: clean(
        row.provincia
      ),
      municipality_key: clean(
        row.municipio_key
      ),
      municipality_name: clean(
        row.municipio
      ),
      address: clean(
        row.direccion
      ),
      postal_code: clean(
        row.codigo_postal
      ),
      phone: clean(
        row.telefono
      ),
      email: clean(
        row.email
      ),
      website: clean(
        row.web
      ),
      description: clean(
        row.descripcion
      ),
      latitude:
        row.latitud ?? null,
      longitude:
        row.longitud ?? null,
      location_precision: clean(
        row.precision_ubicacion
      ),
      list_distance: clean(
        row.distancia_lista
      ),
      original_category: clean(
        row.categoria_origen
      ),
      source: {
        sheet: clean(
          row.hoja_origen
        ),
        row:
          Number(
            row.fila_origen
          ) || null,
        id: clean(
          row.id_origen
        ),
        quality: clean(
          row.calidad_origen
        ),
      },
      content_hash: clean(
        row.hash_contenido
      ),
    }))
    .sort(
      (a, b) =>
        a.association_id -
        b.association_id
    );

  const overrides = payload.associations
    .map((row) => ({
      association_id: Number(
        row.association_id
      ),
      tags: clean(
        row.tag_canonico
      )
        ? [
            clean(
              row.tag_canonico
            ),
          ]
        : [],
      record_status:
        statusFor(row),
      runtime_enabled:
        isYes(
          row.importar
        ),
      duplicate_of:
        duplicateOf(row),
      reason_codes:
        reasonCodes(row),
      notes: clean(
        row.observaciones
      ),
    }))
    .sort(
      (a, b) =>
        a.association_id -
        b.association_id
    );

  writeJsonl(
    BASE_PATH,
    baseRows
  );

  writeJsonl(
    OVERRIDES_PATH,
    overrides
  );

  writeJson(
    TAGS_PATH,
    payload.tags ?? []
  );

  writeJson(
    PROVINCES_PATH,
    payload.provinces ?? []
  );

  writeJson(
    MANIFEST_PATH,
    {
      format_version: 1,
      master_version: 3,
      source_dataset:
        "backend/data/Asociaciones_ONG_normalizadas.json",
      source_format_version:
        payload.format_version ?? null,
      source_normalization_version:
        payload.normalization_version ?? null,
      associations_total:
        baseRows.length,
      bootstrapped_from_canonical:
        true,
      invariant:
        "base + curation -> runtime dataset",
    }
  );

  console.log(
    `BOOTSTRAP_BASE=${baseRows.length}`
  );

  console.log(
    `BOOTSTRAP_OVERRIDES=${overrides.length}`
  );
}

function build() {
  const baseRows =
    readJsonl(
      BASE_PATH
    );

  const overrides =
    readJsonl(
      OVERRIDES_PATH
    );

  const fieldEnrichments =
    fs.existsSync(
      FIELD_ENRICHMENT_PATH
    )
      ? readJsonl(
          FIELD_ENRICHMENT_PATH
        )
      : [];

  const rawTags =
    JSON.parse(
      fs.readFileSync(
        TAGS_PATH,
        "utf8"
      )
    );

  const tags =
    rawTags.filter(
      (row) =>
        row.tag_id &&
        clean(
          row.tag_canonico
        )
    );

  const rawProvinces =
    JSON.parse(
      fs.readFileSync(
        PROVINCES_PATH,
        "utf8"
      )
    );

  const provinces =
    rawProvinces.filter(
      (row) =>
        clean(
          row.provincia_key
        ) &&
        clean(
          row.provincia_key
        ).toUpperCase() !==
          "NACIONAL"
    );

  const manifest =
    JSON.parse(
      fs.readFileSync(
        MANIFEST_PATH,
        "utf8"
      )
    );

  const overrideById =
    new Map(
      overrides.map(
        (row) => [
          Number(
            row.association_id
          ),
          row,
        ]
      )
    );

  const enrichmentByAssociation =
    new Map();

  for (
    const enrichment
    of fieldEnrichments
  ) {
    const id =
      Number(
        enrichment.association_id
      );

    if (
      !enrichmentByAssociation.has(
        id
      )
    ) {
      enrichmentByAssociation.set(
        id,
        {}
      );
    }

    const fields =
      enrichmentByAssociation.get(
        id
      );

    if (
      Object.hasOwn(
        fields,
        enrichment.field
      )
    ) {
      throw new Error(
        `Enrichment duplicado ${id}:${enrichment.field}`
      );
    }

    fields[
      enrichment.field
    ] =
      enrichment.value;
  }

  const associations =
    baseRows
      .map((base) => {
        const id = Number(
          base.association_id
        );

        const curation =
          overrideById.get(id);

        if (!curation) {
          throw new Error(
            `Falta curation override para association_id=${id}`
          );
        }

        const tagsForAssociation =
          Array.isArray(
            curation.tags
          )
            ? curation.tags.filter(
                Boolean
              )
            : [];

        const enrichment =
          enrichmentByAssociation.get(
            id
          ) ?? {};

        const effective = {
          ...base,
          ...enrichment,
        };

        return {
          association_id: id,
          nombre:
            effective.name,
          alcance:
            effective.scope,
          tag_canonico:
            tagsForAssociation[0] ??
            null,
          categoria_origen:
            effective.original_category,
          provincia:
            effective.province_name,
          provincia_key:
            effective.province_key,
          municipio:
            effective.municipality_name,
          municipio_key:
            effective.municipality_key,
          direccion:
            effective.address,
          codigo_postal:
            effective.postal_code,
          telefono:
            effective.phone,
          email:
            effective.email,
          web:
            effective.website,
          descripcion:
            effective.description,
          latitud:
            effective.latitude,
          longitud:
            effective.longitude,
          precision_ubicacion:
            effective.location_precision,
          distancia_lista:
            effective.list_distance,
          hoja_origen:
            base.source?.sheet ??
            null,
          fila_origen:
            base.source?.row ??
            null,
          id_origen:
            base.source?.id ??
            null,
          calidad_origen:
            base.source?.quality ??
            null,
          importar:
            curation.runtime_enabled
              ? "Sí"
              : "No",
          observaciones:
            curation.notes ??
            null,
          hash_contenido:
            effective.content_hash,
        };
      })
      .sort(
        (a, b) =>
          a.association_id -
          b.association_id
      );

  const importable =
    associations.filter(
      (row) =>
        isYes(
          row.importar
        )
    );

  const output = {
    format_version: 1,
    source: {
      type:
        "master_dataset_v3",
      master_version:
        manifest.master_version,
    },
    associations_total:
      associations.length,
    associations_importable:
      importable.length,
    tags_total:
      tags.length,
    provinces_total:
      provinces.length,
    associations,
    tags,
    provinces,
    normalization_version: 3,
  };

  writeJson(
    OUTPUT_PATH,
    output
  );

  console.log(
    `BUILD_TOTAL=${associations.length}`
  );

  console.log(
    `BUILD_IMPORTABLE=${importable.length}`
  );

  console.log(
    `BUILD_OUTPUT=${path.relative(ROOT, OUTPUT_PATH)}`
  );
}

const args =
  new Set(
    process.argv.slice(2)
  );

fs.mkdirSync(
  MASTER_DIR,
  {
    recursive: true,
  }
);

fs.mkdirSync(
  CURATION_DIR,
  {
    recursive: true,
  }
);

if (
  args.has(
    "--bootstrap"
  )
) {
  const masterExists =
    fs.existsSync(
      BASE_PATH
    ) ||
    fs.existsSync(
      OVERRIDES_PATH
    );

  if (
    masterExists &&
    !args.has(
      "--force-bootstrap"
    )
  ) {
    throw new Error(
      "Master V3 ya existe. --bootstrap no puede sobrescribirlo. " +
      "Use --force-bootstrap solo para reconstrucción deliberada desde el canónico."
    );
  }

  bootstrap();
}

build();
