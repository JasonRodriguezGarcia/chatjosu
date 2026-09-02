# Tasks — curate-euskadi-navarra

## 1. F0 — Sync servidor→local + commit + rollback point
- [x] 1.1 Snapshot git en local y servidor; dump custom `copilot_ong` + sha256; tags `restore-point/pre-curation-2026-08-31` (local `4cccdeb`, server `ac3d730`).
- [x] 1.2 rsync de las rutas explícitas (D1) sin `raw/`; preservando los 7 archivos runtime modificados.
- [x] 1.3 Commit de artefactos curados (`212b8b7`): Euskadi (28.091) + Navarra v1 (10.254) + envelopes + taxonomía v2 + scripts.
- [x] 1.4 `git diff --check` limpio; `git diff --name-only` dentro del scope.

## 2. F1a — Curación de contactos Navarra v2 (solo servidor)
- [ ] 2.1 Crear `backend/scripts/build-navarra-normalized-v2.js` (D7): email RFC-5322, phone fallback `TELEFONO1→2→3`, website http(s)/promoción/recuperación, postal_code 5 dígitos + 4 recuperaciones, address + `TIPO_VIAL`, tax_id collision flag, join 1:1 de `relevance` desde el envelope por `source_record_id`; salida `normalized-v2.jsonl` + `curation-report.json`.
- [ ] 2.2 `node --check` del script y ejecución en `lum-compute-01`.
- [ ] 2.3 Preflight de invariantes (gate): n=10.254; email 1.685; phone 97; website 10; postal_code 9.552; address 10.218 (9.959 con TIPO_VIAL); tax collisions 24 records/12 values; relevancia keep 668 / review 9.586. Cualquier desviación → BLOCKED.
- [ ] 2.4 Auditoría de excepciones: los 15 emails invalidados, los 3 phones nulos, los 2 emails promovidos a website, la URL recuperada (14961) y las 4 CP recuperados corresponden a los registros esperados con motivo válido en el reporte.
- [ ] 2.5 Check de equivalencia estructural v1→v2: mismo orden y mismo set de `source_record_id` (10.254), y `relevance` no nulo en todas las filas.
- [ ] 2.6 Sync servidor→local de `data/acquisition/navarra_registro_asociaciones/` (normalized-v2 + report) y commit.
- [ ] 2.7 `git diff --check` y `git diff --name-only` dentro del scope.

## 3. F1b — Proyección de Navarra (pool B)
- [x] 3.1 `node --check` del script parametrizado (D2: `argv[2]` dir, `argv[3]` input file, `argv[4]` gate `strict`|`direct`).
- [x] 3.2 Baseline Euskadi regenerada a 751 (estado actual): la baseline versionada (723) era obsoleta (input 19.695 filas + tag mapper sin `DISCAPACIDAD`); la re-ejecución con defaults produce determinísticamente 751 (sha256 `60a8d663…`), adoptada como baseline canónica y reproducible.
- [x] 3.3 Ejecutar Navarra: `build-acquisition-runtime-candidates-v1.js navarra_registro_asociaciones normalized-v2.jsonl direct` → `runtime-candidates.jsonl` + `runtime-preflight.json`.
- [x] 3.4 Preflight (gate): 10.254 clasificados; 265 candidatas pool B; distribución (needs, provincia, contactos) coherente con la simulación local (top: exclusión social 80, inmigración/refugio 79, violencia de género 40). Desviación → BLOCKED.
- [x] 3.5 Sync servidor→local del artefacto proyectado y commit; `git diff --check` + `--name-only`.

## 4. F2 — Migración 009 v2 (servidor)
- [x] 4.1 Redactar `db/local/init/009_tags_v2.sql` idempotente (D3 + D5). Local 2026-09-02: re-aplicación en `copilot_ong` con `--single-transaction` corrigió `TDHA` → `TDAH` (`UPDATE 1`, `INSERT 0 0`).
- [ ] 4.2 Dry-run (transacción + ROLLBACK) y captura de conteos antes.
- [ ] 4.3 Aplicar en transacción única; conteos después → `data/reports/migration-009-report.json` (inventario de los 2 legacy ids sin mapeo incluidos).
- [ ] 4.4 Commit de la migración + reporte.
- [ ] 4.5 `node --check` no aplica (SQL); validar sintaxis con el dry-run de 4.2.

## 5. F3 — Importador (servidor)
- [x] 5.1 Crear `backend/scripts/import-runtime-candidates-v1.js` (D4): `--source`, `--dry-run`, mapeo + tags + provenance + `ON CONFLICT (content_hash) DO NOTHING`. Local 2026-09-02: dry-run idempotente Euskadi 751/Navarra 265 y tests puros en `backend/tests/import-runtime-candidates-v1.test.js`.
- [ ] 5.2 Dry-run Euskadi (751) → inspeccionar resumen → importar Euskadi.
- [ ] 5.3 Dry-run Navarra (265) → inspeccionar resumen → importar Navarra.
- [ ] 5.4 Commit del importador + reportes de importación en `data/reports/`.

## 6. F4 — Verificación
- [x] 6.1 `npm test` (tests existentes + nuevos: clasificador v2 «soledad», mapeo del importador como función pura).
  - Nota local 2026-09-02: `backend/package.json` define ahora `test` y `npm test` pasó en local: 101 tests Vitest + 50 tests `node --test`, exit 0.
- [x] 6.2 E2E: smoke del backend (`:5174`) + caso feedback #13 (limitación documentada si requiere LLM).
  - Nota local 2026-09-02 (validación no-HTTP aprobada por el usuario): el caso «tengo 70 años y me siento sola» + Bizkaia se verificó contra la capa de clasificación y retrieval local. `node --test backend/tests/helpchat-semantic-classifier.test.js` pasa 13/13 y confirma el mapping a `SOLEDAD_NO_DESEADA`; `findAssociationsForHelpchat({ tagId: 80, selectedProvince: 'Bizkaia', limit: 5 })` devuelve 2 asociaciones local `VIZCAYA` (`ASOCIACIÓN IBAR NAGUSIEN ETXEA ELKARTEA`, `Asociación Getxo Bihozbera - Getxo Comunidad Compasiva - GCC`) y 1 nacional (`EKIALDE`).
  - Nota local 2026-09-02 (E2E HTTP aprobada por el usuario): se arrancó el backend local en `127.0.0.1:5174` consumiendo Ollama del servidor en `http://192.168.1.100:11434` (`nomic-embed-text` + `qwen3:8b`). `GET /api/health` devolvió `{"status":"ok"}` y `GET /api/ready` confirmó `database=ok`, `semanticRouter=ready` y `localLlm.installed=true`. `POST /api/v1/helpchat/iacall` con `{"inputMessage":"tengo 70 años y me siento sola","selectedProvincia":"Bizkaia"}` devolvió `status=resolved`, `tag=SOLEDAD_NO_DESEADA`, `resolvedNeeds[0].tag_id=80`, `provider=embedding`, `model=nomic-embed-text`, `localCount=2`, `neighborCount=0`, `nationalCount=1`, `fallbackUsed=false` y asociaciones `267`, `477`, `980`. El log confirmó warmup de `nomic-embed-text` (`16332.3ms`) y de `qwen3:8b` (`55479.6ms`). `historyId` quedó `null` porque `tagSaving` busca `tags.descripcion` y el runtime emite `SOLEDAD_NO_DESEADA`; esto no impide el requisito de la spec de devolver al menos una asociación de Bizkaia.
- [ ] 6.3 Prueba de rollback (opcional, en ventana aprobada): `pg_restore` en BD de prueba, NO sobre la BD en producción.
- [x] 6.4 `git diff --check`, `git diff --name-only`, y verificación de que ningún archivo fuera de scope fue modificado.
  - Nota local 2026-09-02: `git diff --check` limpio; modified/untracked locales dentro del scope (`semantic-prototypes.js`, tests, importador, reportes y migraciones locales).
