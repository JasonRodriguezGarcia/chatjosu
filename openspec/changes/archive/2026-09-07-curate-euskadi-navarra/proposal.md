## Why

Este change nació cuando helpchat servía únicamente el conjunto histórico de asociaciones y la primera proyección disponible era Euskadi 751 / Navarra 265. Desde entonces el propio workstream completó la curación Navarra v2 y una evolución posterior, `canonicalize-tag-taxonomy-v2`, amplió y validó la cobertura runtime de las 54 necesidades canónicas.

La autoridad versionada actual es Euskadi **958** candidatas y Navarra **319** candidatas, regeneradas y aceptadas en `227b143`. Los valores 751/265 se conservan únicamente como linaje histórico de la primera proyección. La operación aún pendiente en este change es promover de forma segura el estado canónico actual a la **BD target/servidor**, con migración, dry-run, importación y reportes verificables.

## What Changes

- **Sync** de artefactos curados (Euskadi + Navarra) y scripts de pipeline no versionados desde `lum-compute-01` al repo local; commit de artefactos curados (`data/**/raw/` queda fuera de git, re-descargable y verificado por sha256 en manifest).
- **Curación de contactos Navarra v2** (`build-navarra-normalized-v2.js`, determinista sobre el raw del registro): valida email (RFC-5322 + dominio), teléfono (9 dígitos, `TELEFONO1`→`TELEFONO2`→`TELEFONO3`), website (http/https, con promoción de emails malformados y recuperación de URLs en texto), código postal (5 dígitos + recuperación determinística), dirección (concatenación + enriquecimiento `TIPO_VIAL`) y `tax_id` (collision flag, sin exclusión) → `normalized-v2.jsonl` + `curation-report.json`. Invariantes fijados (simulación sobre raw): n=10.254, email 1.685, teléfono 97, web 10, CP 9.552, dirección 10.218 (9.959 con TIPO_VIAL), tax collisions 24 records/12 values.
- **Proyección de Navarra con pool B**: la primera proyección produjo 265 candidatas; tras completar la taxonomía canónica v2, la regeneración aceptada produce **319** candidatas Navarra. El artefacto versionado actual y no la baseline histórica de 265 es la autoridad para las operaciones posteriores.
- **BREAKING (vocabulario de tags)**: migración `db/local/init/009_tags_v2.sql` — los 54 needs de `tag-taxonomy-v2.proposal.json` pasan a `copilot_ong.tags` (nueva columna `tag_key`), re-key de las 270 asociaciones activas vía `legacy_mapping` (29 legacy ids → 24 v2 keys), eliminación de filas `association_tags` de los 3 tags legacy contaminados por proveedor y reporte de legacy ids sin mapeo.
- **Extensión del clasificador runtime**: `backend/helpchat/semantic-prototypes.js` añade entradas v2 (`{tagId, tag, text}` para los 54 needs) sin cambiar la lógica de `helpchat-semantic-classifier.js`.
- **Nuevo importador** `backend/scripts/import-runtime-candidates-v1.js`: importa los artefactos runtime canónicos actuales (**958 Euskadi + 319 Navarra**) a `copilot_ong` con provenance, `ON CONFLICT (content_hash)`, rechazo explícito de canonical tags desconocidos, modo `--dry-run` y conteos verificables. La primera baseline 751/265 queda como contexto histórico.
- **Verificación**: tests de clasificador e importador, conteos psql, E2E smoke contra el backend del servidor (:5174) incluyendo el caso feedback #13.

## Capabilities

### New Capabilities

- `association-curation`: promoción end-to-end de asociaciones de registros oficiales (Euskadi + Navarra) a PostgreSQL: proyección de candidatas runtime estrictas, vocabulario de tags canónico v2 con re-key de legacy, import con deduplicación y provenance, y alcanzabilidad desde el runtime de helpchat.

### Modified Capabilities

Ninguna adicional para este change. Desde la creación de esta propuesta, la capacidad canónica `tag-taxonomy` fue completada y archivada por `canonicalize-tag-taxonomy-v2`; este change consume esa autoridad y no redefine su vocabulario.

## Impact

- **Código nuevo**: `db/local/init/009_tags_v2.sql`, `backend/scripts/import-runtime-candidates-v1.js`, tests en `backend/tests/`.
- **Código modificado**: `backend/helpchat/semantic-prototypes.js` (extensión), `backend/scripts/build-acquisition-runtime-candidates-v1.js` (parametrización mínima de rutas), `backend/tests/helpchat-semantic-classifier.test.js` (casos v2).
- **Archivos sincronizados desde servidor (untracked → versionados)**: `data/acquisition/{euskadi,navarra}_registro_asociaciones/` (sin `raw/`), `data/curation/` (overrides, canonical, semantic, `tag-taxonomy-v2.proposal.json`), `data/master/`, `data/enrichment/`, `data/reports/`, ~25 scripts de `backend/scripts/` + `backend/scripts/lib/association-resource-role-v1.js`.
- **BD `copilot_ong`**: cambio de schema (`tags.tag_key`, columnas provenance en `associations`), re-key de `association_tags` y promoción de los artefactos runtime canónicos actuales; el número real de inserciones se determina mediante dry-run y deduplicación por `content_hash`. El punto de restauración previo permanece como autoridad de rollback.
- **Runtime helpchat (workstream HELPCHAT)**: el vocabulario de tags pasa a v2 → el clasificador emite ids v2 y el retrieval de `helpchat-association-service.js` (por `association_tags.tag_id`) sirve las nuevas asociaciones.
- **No objetivos**: las otras ~10 fuentes de CCAA; pools `needs_review`/`contextual`; re-inferencia semántica LLM; cambios de frontend; refactors no relacionados.
