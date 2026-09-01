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
- [ ] 4.1 Redactar `db/local/init/009_tags_v2.sql` idempotente (D3 + D5).
- [ ] 4.2 Dry-run (transacción + ROLLBACK) y captura de conteos antes.
- [ ] 4.3 Aplicar en transacción única; conteos después → `data/reports/migration-009-report.json` (inventario de los 2 legacy ids sin mapeo incluidos).
- [ ] 4.4 Commit de la migración + reporte.
- [ ] 4.5 `node --check` no aplica (SQL); validar sintaxis con el dry-run de 4.2.

## 5. F3 — Importador (servidor)
- [ ] 5.1 Crear `backend/scripts/import-runtime-candidates-v1.js` (D4): `--source`, `--dry-run`, mapeo + tags + provenance + `ON CONFLICT (content_hash) DO NOTHING`.
- [ ] 5.2 Dry-run Euskadi (751) → inspeccionar resumen → importar Euskadi.
- [ ] 5.3 Dry-run Navarra (265) → inspeccionar resumen → importar Navarra.
- [ ] 5.4 Commit del importador + reportes de importación en `data/reports/`.

## 6. F4 — Verificación
- [ ] 6.1 `npm test` (tests existentes + nuevos: clasificador v2 «soledad», mapeo del importador como función pura).
- [ ] 6.2 E2E: smoke del backend (`:5174`) + caso feedback #13 (limitación documentada si requiere LLM).
- [ ] 6.3 Prueba de rollback (opcional, en ventana aprobada): `pg_restore` en BD de prueba, NO sobre la BD en producción.
- [ ] 6.4 `git diff --check`, `git diff --name-only`, y verificación de que ningún archivo fuera de scope fue modificado.
