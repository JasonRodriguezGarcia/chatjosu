# Tasks — add-canarias-semantic-envelope-v1

## 1. F1 — Builder del envelope
- [ ] 1.1 Confirmar estado git (branch `copilot-ong/integration`, HEAD `415982def84928152180f627c53ada8cd705e71d`, tracked clean) y que los 5 artefactos WIP protegidos permanecen intactos.
- [ ] 1.2 Crear `backend/scripts/build-canarias-semantic-envelope-v1.js` patrón de `build-navarra-semantic-envelope-v1.js`: input `data/acquisition/canarias_registro_asociaciones/normalized.jsonl` (guard 23.036 filas), `mapCanariasSourceTaxonomyV1`, gates de relevancia/needs/semántico/funciones/utilidad, routing 4-vía, outputs `data/curation/semantic/envelopes/canarias-semantic-envelope-v1.jsonl` + `.report.json`, marcador `CANARIAS_SEMANTIC_ENVELOPE_V1=PASS`.
- [ ] 1.3 `node --check` del nuevo builder (sintaxis).
- [ ] 1.4 Ejecutar desde la raíz: `node backend/scripts/build-canarias-semantic-envelope-v1.js` → salida termina en `CANARIAS_SEMANTIC_ENVELOPE_V1=PASS`.

## 2. F2 — Artefactos y determinismo
- [ ] 2.1 Verificar `canarias-semantic-envelope-v1.jsonl`: 23.036 líneas, paridad 1:1 con el input por `source_record_id`, `candidate_id` únicos, contrato de registro completo por registro (`format_version`, `candidate_id`, `source_id`, `source_record_id`, `content_hash`, `name`, `description`, `province_key`, `municipality_name`, `relevance`, `utility`, `routing`, `source_taxonomy`, `deterministic` con 4 dimensiones `{keys, evidence}`).
- [ ] 2.2 Verificar `canarias-semantic-envelope-v1.report.json`: `source_candidates = 23036`, `taxonomy.matched = 23036`, `taxonomy.unmatched = 0`, suma de `taxonomy.modes = 23036`, suma de `routing = 23036`, bloques `relevance` / `utility` / `dimensions` / `signals` presentes.
- [ ] 2.3 Determinismo: re-ejecutar el builder; sha256 de ambos artefactos idéntico entre ejecuciones.

## 3. F3 — Scope, exclusiones y gates
- [ ] 3.1 `git diff --check` limpio; `git diff --name-only` = exactamente los 3 archivos nuevos (builder + 2 artefactos).
- [ ] 3.2 Confirmar que los WIP protegidos no se han editado, movido, borrado ni versionado: `backend/scripts/build-canarias-normalized-v1.js`, `backend/scripts/lib/canarias-source-taxonomy-mapper-v1.js`, `data/acquisition/canarias_registro_asociaciones/`, `data/curation/semantic/source-taxonomies/canarias-taxonomy-map-v1.proposal.json`; y que `db/local/init/010_communities.sql` permanece sin tocar (fuera de scope).
- [ ] 3.3 Confirmar exclusiones: sin cambios en `data/master/tags.json`, `backend/scripts/lib/association-tag-mapper-v1.js`, `backend/scripts/build-acquisition-runtime-candidates-v1.js`, ni en los artefactos runtime existentes de Canarias (`runtime-candidates.jsonl`, `runtime-preflight.json` no se regeneran).
- [ ] 3.4 Gate externa de aceptación: validación CLI de este change por `openspec` (OPENSPEC_VALIDATION=EXTERNAL_REQUIRED) y PASS final del controlador.
