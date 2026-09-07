## Why

El pipeline aceptado `normalization v1 -> semantic envelope -> curation v2 -> runtime projection` está implementado para Euskadi y Navarra (precedente primario), pero para Canarias solo existe el primer escalón: `data/acquisition/canarias_registro_asociaciones/normalized.jsonl` (23.036 registros) + `normalization-report-v1.json`, y una proyección determinística ya emitida (`runtime-preflight.json`: 471 candidatas strict, 462 `tagging.unmapped`, 9 `high_associations`, 9 runtime). Falta el stage `canarias-semantic-envelope-v1`, por lo que Canarias no puede entrar en curation v2 ni tener routing por candidata (`out_of_scope` / `deterministic_only` / `constrained` / `llm_open`) para los workloads LLM posteriores.

La evidencia semántica/de-origen ya existe como WIP protegido (solo lectura): `canarias-taxonomy-map-v1.proposal.json` (141 clases, 5 modos, coverage 23.036) y `canarias-source-taxonomy-mapper-v1.js` (contrato idéntico al mapper de Navarra). Este change añade únicamente el builder faltante y sus dos artefactos generados, patrón exacto de `build-navarra-semantic-envelope-v1.js`.

## What Changes

- **Nuevo builder** `backend/scripts/build-canarias-semantic-envelope-v1.js`: determinista, se ejecuta desde la raíz del repo (`node backend/scripts/build-canarias-semantic-envelope-v1.js`). Lee `data/acquisition/canarias_registro_asociaciones/normalized.jsonl` (exactamente 23.036 registros) y, por candidata, produce: mapeo de taxonomía de origen (`mapCanariasSourceTaxonomyV1`), gate de relevancia (`association-relevance-v1`), needs canónicos (`mapAssociationTagsV1`), gate de candidato semántico, gate de evidencia de funciones, gate de utilidad y routing 4-vía.
- **Artefactos generados** (versionados): `data/curation/semantic/envelopes/canarias-semantic-envelope-v1.jsonl` (23.036 líneas, paridad 1:1 con el input) y `data/curation/semantic/envelopes/canarias-semantic-envelope-v1.report.json` (contadores de taxonomy/relevance/utility/routing/dimensions/signals).
- **Source-taxonomy**: consume `data/curation/semantic/source-taxonomies/canarias-taxonomy-map-v1.proposal.json` (141 clases; modos `source_assertion` / `strong_candidate` / `candidate_set` / `context` / `none`; sentinela `<missing>`) como evidencia semántica/de-origen. La clase oficial nunca descarta registros por sí sola; guard duro `taxonomy.unmatched === 0`.
- **Relación con el tagging canónico**: el envelope reutiliza el mapeador canónico de needs (`association-tag-mapper-v1.js`) y el vocabulario canónico de conceptos de los gates deterministas. No crea una segunda taxonomía de tags de runtime: la proyección runtime sigue emitiendo tags canónicos por la vía existente (`build-acquisition-runtime-candidates-v1.js` → `runtime-candidates.jsonl` con `tags[]`).
- **Guardas deterministas** (fallo explícito): `UNEXPECTED_CANARIAS_NORMALIZED_ROWS`, `CANARIAS_ENVELOPE_PARITY_FAIL`, `CANARIAS_ENVELOPE_DUPLICATE_IDS`, `CANARIAS_ROUTE_PARTITION_FAIL`, `CANARIAS_TAXONOMY_UNMATCHED`, `INVALID_CANARIAS_SOURCE_TAXONOMY_V1`, `UNKNOWN_CANARIAS_TAXONOMY_MODE`; marcador final `CANARIAS_SEMANTIC_ENVELOPE_V1=PASS`.
- **Verificación**: ejecución del builder + marcador PASS, determinismo por sha256 en doble ejecución, checks estructurales de envelope/report, `git diff --check` limpio y `git diff --name-only` dentro del scope aprobado.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `association-curation`: añade el requirement del stage `canarias-semantic-envelope-v1` (stage reproducible, contrato de registro del envelope, semántica de la taxonomía de origen, relación con el tagging canónico, guardas deterministas) sin modificar requirements existentes.

## Impact

- **Código nuevo**: `backend/scripts/build-canarias-semantic-envelope-v1.js` (único archivo de código nuevo).
- **Artefactos generados nuevos**: `data/curation/semantic/envelopes/canarias-semantic-envelope-v1.jsonl`, `data/curation/semantic/envelopes/canarias-semantic-envelope-v1.report.json`.
- **Código modificado**: ninguno. `backend/scripts/lib/canarias-source-taxonomy-mapper-v1.js` se consume tal cual (WIP protegido).
- **BD `copilot_ong`**: sin migraciones, sin importación. **Runtime helpchat**: sin cambios (la vía canónica de tags no se toca).
- **WIP protegido (solo lectura)**: `build-canarias-normalized-v1.js`, `canarias-source-taxonomy-mapper-v1.js`, `data/acquisition/canarias_registro_asociaciones/`, `canarias-taxonomy-map-v1.proposal.json` — no se editan, mueven, borran ni versionan cambios sobre ellos. `db/local/init/010_communities.sql` queda fuera de scope.
- **No objetivos**: curation v2 de Canarias; workloads/run-input LLM de Canarias; proyección runtime o importación BD de Canarias; framework genérico multi-fuente; re-descarga o re-normalización de la fuente; refactors no relacionados.
