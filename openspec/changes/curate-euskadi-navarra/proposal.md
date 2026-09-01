## Why

La app helpchat solo sirve 270 asociaciones activas curadas a mano y consultas reales como «tengo 70 años y me siento sola» (Bizkaia, feedback #13) devuelven 0 resultados. Los registros oficiales de Euskadi (28.091 normalizadas, 751 candidatas runtime estrictas ya proyectadas, baseline regenerada) y Navarra (10.254 normalizadas, sin proyectar) están adquiridos en `lum-compute-01` pero **no están en PostgreSQL**, el clasificador runtime solo conoce 34 tags legacy (y 3 de ellos son nombres de proveedor), y 27 de las 50 necesidades v2 usadas por las candidatas no tienen equivalente legacy. Ahora es el momento de promover la primera ola (Euskadi + Navarra) con la taxonomía canónica v2 y los pools decididos por el usuario: Euskadi gate estricto (751 candidatas) y Navarra **pool B** (`direct_relevance` + ≥1 necesidad high-confidence, 265 candidatas).

## What Changes

- **Sync** de artefactos curados (Euskadi + Navarra) y scripts de pipeline no versionados desde `lum-compute-01` al repo local; commit de artefactos curados (`data/**/raw/` queda fuera de git, re-descargable y verificado por sha256 en manifest).
- **Curación de contactos Navarra v2** (`build-navarra-normalized-v2.js`, determinista sobre el raw del registro): valida email (RFC-5322 + dominio), teléfono (9 dígitos, `TELEFONO1`→`TELEFONO2`→`TELEFONO3`), website (http/https, con promoción de emails malformados y recuperación de URLs en texto), código postal (5 dígitos + recuperación determinística), dirección (concatenación + enriquecimiento `TIPO_VIAL`) y `tax_id` (collision flag, sin exclusión) → `normalized-v2.jsonl` + `curation-report.json`. Invariantes fijados (simulación sobre raw): n=10.254, email 1.685, teléfono 97, web 10, CP 9.552, dirección 10.218 (9.959 con TIPO_VIAL), tax collisions 24 records/12 values.
- **Proyección de Navarra con pool B** (`direct_relevance` + ≥1 necesidad high-confidence, 265 candidatas) con `build-acquisition-runtime-candidates-v1.js` (hoy hardcodea Euskadi; se parametriza mínimamente por directorio de origen y nombre de archivo de entrada, y toma la clasificación de relevancia del envelope semántico por `source_record_id`). Decisión de usuario: pool B (265), no el gate estricto (77). → `runtime-candidates.jsonl` + `runtime-preflight.json`.
- **BREAKING (vocabulario de tags)**: migración `db/local/init/009_tags_v2.sql` — los 54 needs de `tag-taxonomy-v2.proposal.json` pasan a `copilot_ong.tags` (nueva columna `tag_key`), re-key de las 270 asociaciones activas vía `legacy_mapping` (29 legacy ids → 24 v2 keys), eliminación de filas `association_tags` de los 3 tags legacy contaminados por proveedor y reporte de legacy ids sin mapeo.
- **Extensión del clasificador runtime**: `backend/helpchat/semantic-prototypes.js` añade entradas v2 (`{tagId, tag, text}` para los 54 needs) sin cambiar la lógica de `helpchat-semantic-classifier.js`.
- **Nuevo importador** `backend/scripts/import-runtime-candidates-v1.js`: importa las candidatas (751 Euskadi + 265 Navarra) a `copilot_ong` con columnas de provenance nuevas (`source_record_id`, `record_url`, `detail_url`, `relevance_status`, `resource_role`), `ON CONFLICT (content_hash)`, modo `--dry-run` y conteos antes/después.
- **Verificación**: tests de clasificador e importador, conteos psql, E2E smoke contra el backend del servidor (:5174) incluyendo el caso feedback #13.

## Capabilities

### New Capabilities

- `association-curation`: promoción end-to-end de asociaciones de registros oficiales (Euskadi + Navarra) a PostgreSQL: proyección de candidatas runtime estrictas, vocabulario de tags canónico v2 con re-key de legacy, import con deduplicación y provenance, y alcanzabilidad desde el runtime de helpchat.

### Modified Capabilities

(ninguna — `openspec/specs/` está vacío)

## Impact

- **Código nuevo**: `db/local/init/009_tags_v2.sql`, `backend/scripts/import-runtime-candidates-v1.js`, tests en `backend/tests/`.
- **Código modificado**: `backend/helpchat/semantic-prototypes.js` (extensión), `backend/scripts/build-acquisition-runtime-candidates-v1.js` (parametrización mínima de rutas), `backend/tests/helpchat-semantic-classifier.test.js` (casos v2).
- **Archivos sincronizados desde servidor (untracked → versionados)**: `data/acquisition/{euskadi,navarra}_registro_asociaciones/` (sin `raw/`), `data/curation/` (overrides, canonical, semantic, `tag-taxonomy-v2.proposal.json`), `data/master/`, `data/enrichment/`, `data/reports/`, ~25 scripts de `backend/scripts/` + `backend/scripts/lib/association-resource-role-v1.js`.
- **BD `copilot_ong`**: cambio de schema (`tags.tag_key`, columnas provenance en `associations`), re-key de `association_tags`, ~751+N inserciones. Punto de restauración ya creado (dump custom 105 KB sha256 `c4db99c8…` + tags git `restore-point/pre-curation-2026-08-31` en local y servidor).
- **Runtime helpchat (workstream HELPCHAT)**: el vocabulario de tags pasa a v2 → el clasificador emite ids v2 y el retrieval de `helpchat-association-service.js` (por `association_tags.tag_id`) sirve las nuevas asociaciones.
- **No objetivos**: las otras ~10 fuentes de CCAA; pools `needs_review`/`contextual`; re-inferencia semántica LLM; cambios de frontend; refactors no relacionados.
