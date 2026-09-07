# Tasks — curate-euskadi-navarra

## 1. F0 — Sync servidor→local + commit + rollback point
- [x] 1.1 Snapshot git en local y servidor; dump custom `copilot_ong` + sha256; tags `restore-point/pre-curation-2026-08-31` (local `4cccdeb`, server `ac3d730`).
- [x] 1.2 rsync de las rutas explícitas (D1) sin `raw/`; preservando los 7 archivos runtime modificados.
- [x] 1.3 Commit de artefactos curados (`212b8b7`): Euskadi (28.091) + Navarra v1 (10.254) + envelopes + taxonomía v2 + scripts.
- [x] 1.4 `git diff --check` limpio; `git diff --name-only` dentro del scope.

## 2. F1a — Curación de contactos Navarra v2 (solo servidor)
- [x] 2.1 `backend/scripts/build-navarra-normalized-v2.js` implementado y versionado en `8aaf793` con las transformaciones deterministas definidas por D7.
- [x] 2.2 `node --check` del script PASS; los outputs de la ejecución están versionados en `8aaf793`. No se afirma una re-ejecución nueva en `lum-compute-01` durante esta reconciliación.
- [x] 2.3 Invariantes verificados sobre `curation-report.json`: n=10.254; email 1.685; phone 97; website 10; postal_code 9.552; address 10.218 (9.959 enriquecidas); tax collisions 24/12; relevancia keep 668 / review 9.586.
- [x] 2.4 Excepciones verificadas: 15 emails invalidados, 3 phones nulos, promociones website 6689/7001, URL recuperada 14961 y CP recuperados 2606/8805/8816/9052.
- [x] 2.5 Equivalencia estructural v1→v2 verificada: 10.254/10.254, mismo orden y set de `source_record_id`, IDs únicos y `relevance` no nulo en las 10.254 filas.
- [x] 2.6 Script, `normalized-v2.jsonl` y `curation-report.json` sincronizados/versionados conjuntamente en `8aaf793`.
- [x] 2.7 Scope histórico de `8aaf793` verificado y estado tracked actual limpio.

## 3. F1b — Proyección de Navarra (pool B)
- [x] 3.1 `node --check` del script parametrizado (D2: `argv[2]` dir, `argv[3]` input file, `argv[4]` gate `strict`|`direct`).
- [x] 3.2 La baseline histórica Euskadi 751 (`60a8d663…`) fue válida para la primera proyección; la regeneración posterior con taxonomía canónica completa la supersede. Autoridad actual: **958**, sha256 `dedbbb908146fc380c8d03a01b0d73c0ed9c1819a50d0a03f6161c4198d944e5`.
- [x] 3.3 Navarra fue proyectada originalmente a 265; la regeneración canónica posterior en `227b143` produce la autoridad actual de **319** candidatas.
- [x] 3.4 Preflights runtime regenerados y aceptados con la taxonomía canónica completa; autoridad actual: Euskadi 958 / Navarra 319.
- [x] 3.5 Artefactos runtime actuales sincronizados/versionados en `227b143`; hashes canónicos verificados.

## 4. F2 — Migración 009 v2 (servidor)
- [x] 4.1 Redactar `db/local/init/009_tags_v2.sql` idempotente (D3 + D5). Local 2026-09-02: re-aplicación en `copilot_ong` con `--single-transaction` corrigió `TDHA` → `TDAH` (`UPDATE 1`, `INSERT 0 0`).
- [x] 4.2 Preflight/dry-run ejecutado sobre la **BD target/servidor** con transacción + ROLLBACK; conteos y gates semánticos capturados, con estado post-rollback idéntico al baseline.
- [x] 4.3 `009_tags_v2.sql` aplicado en transacción única sobre la **BD target/servidor**. Se detectó drift de secuencia 89..142 causado por el dry-run previo y se reparó transaccionalmente a 35..88; estado final: 88 tags, 54 `tag_key`, 255 `association_tags`, 0 huérfanos. Reporte: `data/reports/migration-009-report.json`.
- [x] 4.4 Reporte/evidencia target consolidado en `data/reports/migration-009-report.json`; la implementación SQL estrictamente idempotente permanece fijada en `0b0ad87`.
- [x] 4.5 Ejecución SQL target validada mediante el dry-run transaccional de 4.2 y posterior verificación runtime↔BD 54/54; `node --check` no aplica.

## 5. F3 — Importador (servidor)
- [x] 5.1 `backend/scripts/import-runtime-candidates-v1.js` implementado y endurecido para rechazar canonical tags desconocidos (`8692e39`). Dry-runs físicos locales sobre los artefactos actuales **958/319** pasaron sin mutación de BD ni reportes.
- [x] 5.2 Sobre la **BD target/servidor**, dry-run Euskadi **958** aceptado como físicamente read-only e import real completado: 958 nuevas, 1.213 `association_tags`, IDs 470..1427, 0 tags desconocidos. Reporte: `data/reports/import-euskadi-20260906.json`.
- [x] 5.3 Sobre la **BD target/servidor**, dry-run Navarra **319** aceptado con tablas/digests y `association_id_seq=1427` idénticos antes/después; import real completado: 319 nuevas, 448 `association_tags`, IDs 1428..1746, 0 tags desconocidos. Reporte: `data/reports/import-navarra-20260907.json`.
- [x] 5.4 Versionar los reportes de importación target Euskadi/Navarra y la reparación del importador que hace `--dry-run` realmente read-only respecto a secuencias (`planIds` puro + `BEGIN READ ONLY`; import real conserva `CREATE SEQUENCE`/`setval`/`nextval`).

## 6. F4 — Verificación
- [x] 6.1 `npm test` (tests existentes + nuevos: clasificador v2 «soledad», mapeo del importador como función pura).
  - Nota local 2026-09-02: `backend/package.json` define ahora `test` y `npm test` pasó en local: 101 tests Vitest + 50 tests `node --test`, exit 0.
- [x] 6.2 E2E: smoke del backend (`:5174`) + caso feedback #13 (limitación documentada si requiere LLM).
  - Nota local 2026-09-02 (validación no-HTTP aprobada por el usuario): el caso «tengo 70 años y me siento sola» + Bizkaia se verificó contra la capa de clasificación y retrieval local. `node --test backend/tests/helpchat-semantic-classifier.test.js` pasa 13/13 y confirma el mapping a `SOLEDAD_NO_DESEADA`; `findAssociationsForHelpchat({ tagId: 80, selectedProvince: 'Bizkaia', limit: 5 })` devuelve 2 asociaciones local `VIZCAYA` (`ASOCIACIÓN IBAR NAGUSIEN ETXEA ELKARTEA`, `Asociación Getxo Bihozbera - Getxo Comunidad Compasiva - GCC`) y 1 nacional (`EKIALDE`).
  - Nota local 2026-09-02 (E2E HTTP aprobada por el usuario): se arrancó el backend local en `127.0.0.1:5174` consumiendo Ollama del servidor en `http://192.168.1.100:11434` (`nomic-embed-text` + `qwen3:8b`). `GET /api/health` devolvió `{"status":"ok"}` y `GET /api/ready` confirmó `database=ok`, `semanticRouter=ready` y `localLlm.installed=true`. `POST /api/v1/helpchat/iacall` con `{"inputMessage":"tengo 70 años y me siento sola","selectedProvincia":"Bizkaia"}` devolvió `status=resolved`, `tag=SOLEDAD_NO_DESEADA`, `resolvedNeeds[0].tag_id=80`, `provider=embedding`, `model=nomic-embed-text`, `localCount=2`, `neighborCount=0`, `nationalCount=1`, `fallbackUsed=false` y asociaciones `267`, `477`, `980`. El log confirmó warmup de `nomic-embed-text` (`16332.3ms`) y de `qwen3:8b` (`55479.6ms`). `historyId` quedó `null` porque `tagSaving` busca `tags.descripcion` y el runtime emite `SOLEDAD_NO_DESEADA`; esto no impide el requisito de la spec de devolver al menos una asociación de Bizkaia.
- [ ] 6.3 Prueba de rollback (opcional, en ventana aprobada): `pg_restore` en BD de prueba, NO sobre la BD en producción.
- [x] 6.4 `git diff --check`, `git diff --name-only`, y verificación de que ningún archivo fuera de scope fue modificado.
  - Nota local 2026-09-02: `git diff --check` limpio; modified/untracked locales dentro del scope (`semantic-prototypes.js`, tests, importador, reportes y migraciones locales).
