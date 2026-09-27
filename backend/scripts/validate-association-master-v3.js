import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

const BASE_PATH = path.join(
  ROOT,
  "data/master/associations.base.jsonl"
);

const OVERRIDES_PATH = path.join(
  ROOT,
  "data/curation/association-overrides.jsonl"
);

const OUTPUT_PATH = path.join(
  ROOT,
  "backend/data/Asociaciones_ONG_normalizadas_v3.json"
);

const CANONICAL_PATH = path.join(
  ROOT,
  "backend/data/Asociaciones_ONG_normalizadas.json"
);

function readJsonl(pathname) {
  return fs
    .readFileSync(
      pathname,
      "utf8"
    )
    .split(/\r?\n/)
    .filter(Boolean)
    .map(
      (line) =>
        JSON.parse(line)
    );
}

function fail(message) {
  throw new Error(
    `VALIDATION_FAIL: ${message}`
  );
}

function isYes(value) {
  return [
    "sí",
    "si",
    "yes",
    "true",
    "1",
  ].includes(
    String(value ?? "")
      .trim()
      .toLocaleLowerCase(
        "es"
      )
  );
}

const base =
  readJsonl(
    BASE_PATH
  );

const overrides =
  readJsonl(
    OVERRIDES_PATH
  );

const generated =
  JSON.parse(
    fs.readFileSync(
      OUTPUT_PATH,
      "utf8"
    )
  );

const canonical =
  JSON.parse(
    fs.readFileSync(
      CANONICAL_PATH,
      "utf8"
    )
  );

const baseIds =
  base.map(
    (row) =>
      Number(
        row.association_id
      )
  );

const overrideIds =
  overrides.map(
    (row) =>
      Number(
        row.association_id
      )
  );

if (
  new Set(
    baseIds
  ).size !==
  baseIds.length
) {
  fail(
    "association_id duplicado en base"
  );
}

if (
  new Set(
    overrideIds
  ).size !==
  overrideIds.length
) {
  fail(
    "association_id duplicado en curation"
  );
}

if (
  base.length !==
  overrides.length
) {
  fail(
    `base=${base.length} overrides=${overrides.length}`
  );
}

const baseSet =
  new Set(baseIds);

const overrideSet =
  new Set(
    overrideIds
  );

for (
  const id
  of baseSet
) {
  if (
    !overrideSet.has(id)
  ) {
    fail(
      `falta override para ${id}`
    );
  }
}

const allowedStatuses =
  new Set([
    "ready",
    "needs_enrichment",
    "needs_review",
    "duplicate",
    "rejected",
  ]);

for (
  const row
  of overrides
) {
  if (
    !allowedStatuses.has(
      row.record_status
    )
  ) {
    fail(
      `record_status inválido en ${row.association_id}: ${row.record_status}`
    );
  }

  if (
    row.record_status ===
      "duplicate" &&
    !Number.isSafeInteger(
      Number(
        row.duplicate_of
      )
    )
  ) {
    fail(
      `duplicate sin duplicate_of en ${row.association_id}`
    );
  }

  if (
    row.record_status ===
      "duplicate" &&
    row.runtime_enabled
  ) {
    fail(
      `duplicate activo en runtime: ${row.association_id}`
    );
  }

  if (
    row.runtime_enabled &&
    (!Array.isArray(
      row.tags
    ) ||
      row.tags.length === 0)
  ) {
    fail(
      `runtime_enabled sin tags: ${row.association_id}`
    );
  }
}

const generatedRows =
  generated.associations ??
  [];

if (
  generatedRows.length !==
  base.length
) {
  fail(
    `generated=${generatedRows.length} base=${base.length}`
  );
}

const generatedImportable =
  generatedRows.filter(
    (row) =>
      isYes(
        row.importar
      )
  );

if (
  generatedImportable.length !==
  generated.associations_importable
) {
  fail(
    "metadata associations_importable no coincide"
  );
}

const canonicalImportableIds =
  new Set(
    canonical.associations
      .filter(
        (row) =>
          isYes(
            row.importar
          )
      )
      .map(
        (row) =>
          Number(
            row.association_id
          )
      )
  );

const generatedImportableIds =
  new Set(
    generatedImportable.map(
      (row) =>
        Number(
          row.association_id
        )
    )
  );

const onlyCanonical =
  [...canonicalImportableIds]
    .filter(
      (id) =>
        !generatedImportableIds.has(
          id
        )
    )
    .sort(
      (a, b) =>
        a - b
    );

const onlyGenerated =
  [...generatedImportableIds]
    .filter(
      (id) =>
        !canonicalImportableIds.has(
          id
        )
    )
    .sort(
      (a, b) =>
        a - b
    );

if (
  onlyCanonical.length ||
  onlyGenerated.length
) {
  fail(
    `runtime parity rota; onlyCanonical=${JSON.stringify(
      onlyCanonical
    )} onlyGenerated=${JSON.stringify(
      onlyGenerated
    )}`
  );
}

const duplicate216 =
  overrides.find(
    (row) =>
      Number(
        row.association_id
      ) === 216
  );

if (
  !duplicate216 ||
  duplicate216.record_status !==
    "duplicate" ||
  Number(
    duplicate216.duplicate_of
  ) !== 198 ||
  duplicate216.runtime_enabled
) {
  fail(
    "curación 216 -> 198 no preservada"
  );
}

const statusCounts =
  overrides.reduce(
    (acc, row) => {
      acc[
        row.record_status
      ] =
        (
          acc[
            row.record_status
          ] ?? 0
        ) + 1;

      return acc;
    },
    {}
  );

console.log(
  `BASE_ROWS=${base.length}`
);

console.log(
  `CURATION_ROWS=${overrides.length}`
);

console.log(
  `GENERATED_ROWS=${generatedRows.length}`
);

console.log(
  `GENERATED_IMPORTABLE=${generatedImportable.length}`
);

console.log(
  `CANONICAL_IMPORTABLE=${canonicalImportableIds.size}`
);

console.log(
  `STATUS_COUNTS=${JSON.stringify(statusCounts)}`
);

console.log(
  "DUPLICATE_216=PASS"
);

console.log(
  "RUNTIME_ID_PARITY=PASS"
);

console.log(
  "MASTER_V3_VALIDATION=PASS"
);
