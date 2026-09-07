# Design — add-canarias-semantic-envelope-v1

## Context

- Branch `copilot-ong/integration`, HEAD de salida `415982def84928152180f627c53ada8cd705e71d`, arbol tracked limpio (verificacion git por la gate externa de aceptacion).
- Precedente primario cerrado: `backend/scripts/build-navarra-semantic-envelope-v1.js` (input `data/acquisition/navarra_registro_asociaciones/normalized.jsonl`, 10.254 registros; outputs `data/curation/semantic/envelopes/navarra-semantic-envelope-v1.jsonl` + `.report.json`; guardas `UNEXPECTED_NAVARRA_NORMALIZED_ROWS`, `NAVARRA_ENVELOPE_PARITY_FAIL`, `NAVARRA_ENVELOPE_DUPLICATE_IDS`, `NAVARRA_ROUTE_PARTITION_FAIL`, `NAVARRA_TAXONOMY_UNMATCHED`; marcador `NAVARRA_SEMANTIC_ENVELOPE_V1=PASS`).
- Funnel Canarias conocido (evidencia en repo): 23.036 normalizados, 471 `direct_relevance` (strict), 462 `tagging.unmapped`, 9 `high_associations`, 9 runtime (`runtime-preflight.json`; tags canonicos `ALCOHOLISMO`, `LUDOPATIA`, `TRASTORNOS_ALIMENTARIOS`, `INMIGRACION_REFUGIO`, `ACOSO_ESCOLAR`).
- WIP protegido ya provee la evidencia de origen: `canarias-taxonomy-map-v1.proposal.json` (`format_version "1"`, `source_records 23036`, `status "proposal"`, 141 clases = 140 actividades unicas del registro + sentinela `<missing>`; `summary.mode_records` 3264/1094/2825/12612/3241 suma 23.036; bloques `contract` y `governance`) y `canarias-source-taxonomy-mapper-v1.js` (mismos 5 modos, sentinela `<missing>`, errores `INVALID_CANARIAS_SOURCE_TAXONOMY_V1` / `UNKNOWN_CANARIAS_TAXONOMY_MODE:<mode>`, export `getCanariasSourceTaxonomyCoverageV1`).
- Diff de input respecto a Navarra: el registro normalizado v1 de Canarias no emite `content_hash` ni `source_id` top-level (provenance bajo `source.source_row_index` / `source.source_url` / `source.raw_file`); `description` es mayoritariamente `null` (el registro canario no trae FINES); anade `island`, `tax_id`, `service_coverage`, `contact_channels`, entre otros.

## Goals / Non-Goals

Goals:

- Anadir el stage `canarias-semantic-envelope-v1` como el menor incremento aditivo posible, patron 1:1 de Navarra.
- Evidencia determinista por candidata (4 dimensiones + routing) que alimente curation v2 (join de `relevance` por `source_record_id`) y futuros workloads LLM.
- Reporte de contadores comparable con el de Navarra.

Non-Goals:

- No framework generico multi-fuente (un builder, una fuente).
- No curation v2, no run-input LLM, no proyeccion runtime, no importacion BD, sin migraciones.
- No crear ni modificar taxonomias de tags de runtime ni `data/master/tags.json`.
- No tocar los 5 artefactos WIP protegidos ni `db/local/init/010_communities.sql`.
- No re-descarga ni re-normalizacion de la fuente; el input normalizado v1 es fijo.

## Decisions

### D1. Patron exacto del builder de Navarra (sin framework)

Unico script ESM `backend/scripts/build-canarias-semantic-envelope-v1.js` que replica la estructura de `build-navarra-semantic-envelope-v1.js`: `ROOT = process.cwd()`, rutas hardcodeadas de input/output, los mismos 5 lib gates (`association-relevance-v1`, `association-tag-mapper-v1`, `association-semantic-candidate-gate-v1`, `association-function-evidence-gate-v1`, `association-utility-gate-v1`) y el mapper de taxonomia de origen (`mapCanariasSourceTaxonomyV1`). La clase oficial se procesa exclusivamente via el mapper; los gates genericos inspeccionan solo `name` y `description` (la clase no se pasa como categoria a los gates).

### D2. Contrato de input y diferencias Canarias

Input: `data/acquisition/canarias_registro_asociaciones/normalized.jsonl`, guard de filas exactas 23.036. Campos leidos por el builder (todos presentes en el normalizado v1): `candidate_id`, `source_record_id`, `name`, `description` (nullable), `original_category`, `scope`, `province_key`, `municipality_name`. Decisiones de contrato:

- `content_hash` del envelope = `candidate.content_hash ?? null`, es decir `null` para Canarias (el normalizado v1 no emite `content_hash`; la provenance la portan `source.source_row_index` y `source.source_url`). El campo se conserva por paridad de contrato con Navarra.
- `source_id` del envelope = `candidate.source_id ?? "canarias_registro_asociaciones"` (el normalizado v1 de Canarias anida `source.source_id`; el fallback al constante replica el patron de Navarra).
- `description` mayoritariamente `null`: los gates corren sobre `name` (y `description` cuando exista). Se espera un sesgo de routing hacia `constrained` / `llm_open` mayor que en Navarra; por la requirement de `tag-taxonomy` sobre predicciones previas, los conteos de routing esperados NO son criterio de aceptacion.

### D3. Semantica de la taxonomia de origen

La taxonomia es evidencia semantica/de-origen, no tagging de runtime. Modos (bloques `contract` y `governance` del proposal, ya fijados en WIP protegido):

- `source_assertion` (3264 registros): la clase oficial aporta `assertions` (conceptos canonicos directos).
- `strong_candidate` (1094) y `candidate_set` (2825): aportan `candidates` (conjunto acotado de conceptos canonicos).
- `context` (12612): solo `hints` de dominio (routing); los FINES/otros evidencia establecen la semantica canonica.
- `none` (3241, incluye `<missing>` 2092): no aporta concepto.
- Gobernanza: la clase nunca descarta registro por si sola; FINES pueden refinar; las actividades no implican utilidad asistiva; el LLM no promueve; el contacto personal no se promueve.
- Coverage completa: el set de 141 clases cubre las 140 actividades unicas del registro mas `<missing>` (`unique_actividades: 140` en `normalization-report-v1.json`), por lo que `taxonomy.unmatched` debe ser 0; el guard duro lo exige.

### D4. Relacion con el tagging canonico de runtime

El envelope NO crea una segunda taxonomia de tags de runtime:

- `deterministic.neads.keys` provienen exclusivamente de `mapAssociationTagsV1` (`association-tag-mapper-v1.js`), el mismo mapeador que usa la proyeccion runtime existente (`build-acquisition-runtime-candidates-v1.js`).
- Las claves de `deterministic.populations` / `deterministic.activities` pertenecen al vocabulario canonico de conceptos ya usado por los gates (p. ej. `FAMILIAS`, `JUVENTUD`, `MUSICA` en la taxonomia de origen; `REPRESENTACION`, `LECTURA`, `INVESTIGACION` en el envelope de Navarra).
- La proyeccion runtime de Canarias (`runtime-candidates.jsonl` con `tags[]`, 9 candidatas) NO se regenera ni modifica por este change; el envelope es evidencia para curation v2 y routing LLM, no una fuente de tags runtime.
- La taxonomia de origen sigue en estado `proposal`; su promocion es responsabilidad del stage de curacion, no de este builder.

### D5. Guardas deterministas y report

Guardas (fallo explicito antes de escribir artefactos, mismo orden que Navarra):

1. `UNEXPECTED_CANARIAS_NORMALIZED_ROWS:<n>` si el input no tiene exactamente 23.036 filas.
2. `CANARIAS_ENVELOPE_PARITY_FAIL` si `output.length !== candidates.length`.
3. `CANARIAS_ENVELOPE_DUPLICATE_IDS` si `candidate_id` no es unico.
4. `CANARIAS_ROUTE_PARTITION_FAIL` si la suma de `report.routing` no es 23.036.
5. `CANARIAS_TAXONOMY_UNMATCHED:<n>` si `report.taxonomy.unmatched !== 0`.
6. `INVALID_CANARIAS_SOURCE_TAXONOMY_V1` y `UNKNOWN_CANARIAS_TAXONOMY_MODE:<mode>` (en el mapper WIP protegido).

Reporte `canarias-semantic-envelope-v1.report.json` (misma forma que Navarra): `format_version` (1), `source_id` (`canarias_registro_asociaciones`), `source_candidates` (23036), `taxonomy` (`matched`, `unmatched`, `modes` con los 5 modos), `relevance` (distribucion `decision:status`), `utility` (`keep` / `drop` / `protected`), `routing` (`out_of_scope`, `deterministic_only`, `constrained`, `llm_open`), `dimensions` (`needs`, `functions`, `populations`, `activities`), `signals` (`need_or_function`, `population_only`, `activity_only`, `no_signal`). Salida por consola: secciones de contadores y marcador final `CANARIAS_SEMANTIC_ENVELOPE_V1=PASS`.

### D6. Verificacion

- `node --check` sobre el nuevo builder.
- Ejecucion desde la raiz: `node backend/scripts/build-canarias-semantic-envelope-v1.js` y verificacion del marcador `CANARIAS_SEMANTIC_ENVELOPE_V1=PASS`.
- Determinismo: segunda ejecucion produce artefactos con sha256 identico.
- Checks estructurales: 23.036 lineas en el envelope; mismo set de `source_record_id` que el input; `report.source_candidates = 23036`; suma de `taxonomy.modes = 23036`; `taxonomy.unmatched = 0`; suma de `routing = 23036`.
- `git diff --check` limpio; `git diff --name-only` = exactamente los 3 archivos nuevos.
- Validacion CLI de OpenSpec: trabajo de la gate externa de aceptacion (OPENSPEC_VALIDATION=EXTERNAL_REQUIRED).

### D7. Rollback

Change puramente aditivo (0 archivos existentes modificados): rollback = eliminar `backend/scripts/build-canarias-semantic-envelope-v1.js` y los 2 artefactos generados, y revertir el commit correspondiente. Sin efectos en BD, runtime helpchat, WIP protegido ni demas fuentes.

## Risks / Trade-offs

- **Evidencia debil por `description` null**: la mayoria de las 23.036 candidatas solo aporta `name`; el routing se sesgara hacia `constrained` / `llm_open`. Aceptado: es el proposito del stage (clasificar evidencia, no etiquetar), y no es criterio de aceptacion fijar conteos de routing.
- **462/471 strict unmapped por el mapeador deterministico**: la mayoria de las candidatas strict no recibe needs canonicos por `name` solo; el envelope las clasifica y las deja disponibles para curation v2 / LLM. Aceptado.
- **`content_hash` ausente**: la deduplicacion por `content_hash` de una futura importacion BD de Canarias debe resolversse en el stage de curacion/import (fuera de scope). Documentado para el siguiente change.
- **Taxonomia en estado `proposal`**: el builder la consume tal cual; su validacion/promocion es trabajo de curacion. Aceptado.
- **Sesgo de conteos vs Navarra**: los contadores del reporte de Canarias no son comparables 1:1 con los de Navarra por la diferencia de fuentes (sin FINES, 2 provincias, 8 islas). El reporte usa la misma forma para permitir comparacion estructural, no numrica.

## Migration Plan

No aplica: sin BD, sin migraciones, sin servicios. Secuencia de aplicacion: (1) crear el builder, (2) ejecutarlo y verificar PASS + artefactos, (3) verificar determinismo y scope git, (4) gate externa de aceptacion.

## Open Questions

- Passthrough de `island` en el registro del envelope: decidido NO incluirlo por paridad de contrato con Navarra; se reevaluara en curation v2 de Canarias si el join de relevancia o los workloads LLM lo requieren.
- Workload / run-input LLM para Canarias (p. ej. `build-canarias-semantic-qwen-run-input-v1.js`): change futuro, fuera de scope.
