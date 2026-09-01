## Context

Ver proposal.md (Why). Estado verificado en el repo y en `lum-compute-01`:

- **Git**: local HEAD `4cccdeb` (branch `copilot-ong/integration`, limpio) está 6 commits por delante del servidor (`ac3d730`). En el servidor hay ~25 scripts untracked (`backend/scripts/**` + `lib/association-resource-role-v1.js`) y datos untracked bajo `data/{acquisition,curation,master,enrichment,reports}/`; además 7 archivos runtime modificados sin commit que **no** se tocan.
- **BD** (`copilot_ong` en el contenedor `copilot-ong-postgres`): `associations` 271 filas (270 `active=true`), índice único `associations_content_hash_key`, **sin** columna `dedupe_key`, sin columnas semánticas/provenance. `tags`: 34 filas, `max(tag_id)=34`, solo `(tag_id, descripcion)`.
- **Pipeline (servidor)**: Euskadi 28.091 normalizadas → 751 estrictas (VIZ 371/ALA 194/GUI 186; 111 web, 0 tel/email, todas con `official_registry_url`) ya proyectadas (baseline regenerada a 751, ver D2). Navarra 10.254 normalizadas v1 (contactos crudos: email 1.700 / tel 100 / web 7) sin proyectar. `build-acquisition-runtime-candidates-v1.js` hardcodea las rutas de Euskadi; usa `lib/association-tag-mapper-v1.js` (heurística sobre nombre/descripción, source-agnóstico) que ya emite **keys v2**.
- **Envelope semántico Navarra v1** (local, PASS): `data/curation/semantic/envelopes/navarra-semantic-envelope-v1.jsonl` (10.254 líneas, keyed por `source_record_id`): `relevance` keep:`direct_relevance` 668 / review:`needs_review` 9.586; `utility` keep 10.254; routing deterministic_only 749 / constrained 6.440 / llm_open 3.065. Las filas de `normalized.jsonl` de Navarra llevan `relevance: null` (la clasificación vive solo en el envelope; en Euskadi va inline en el normalized).
- **Raw Navarra (solo servidor)**: `raw/details/{source_record_id}.json` por registro; cobertura verificada: TIPO_VIAL 10.059, TELEFONO1 10.254, TELEFONO2/3 parciales, CODIGO_POSTAL 9.548 (4 recuperables determinísticamente), EMAIL con defectos (15 inválidos + 2 valores que son URLs → website), 1 URL recuperable en texto (registro 14961).
- **Taxonomía**: `data/curation/tag-taxonomy-v2.proposal.json` → 54 needs v2; `legacy_mapping`: 29 ids legacy → 24 keys v2; `legacy_provider_tags`: ids 5, 8, 11.
- **Runtime**: `backend/helpchat/semantic-prototypes.js` expone `HELPCHAT_SEMANTIC_PROTOTYPES` (array de `{tagId, tag, text}`, 28 entradas legacy); el clasificador (`backend/services/helpchat-semantic-classifier.js`) es arrastrado por ese array; el retrieval (`helpchat-association-service.js`) filtra por `association_tags.tag_id`.
- **Punto de restauración**: dump custom de `copilot_ong` en `/mnt/ai-storage/backups/copilot_ong-pre-curation-2026-08-31.dump` (sha256 `c4db99c8…`) + tags git `restore-point/pre-curation-2026-08-31` en local y servidor.

## Goals / Non-Goals

**Goals:**
- Local == servidor para los artefactos curados de Euskadi+Navarra y los scripts que los producen (versionados).
- Navarra con contactos curados v2 (invariantes fijados sobre raw) y proyectado con **pool B** (`direct_relevance` + ≥1 necesidad high, 265 candidatas); Euskadi mantiene el gate estricto (751, baseline regenerada).
- `copilot_ong` con vocabulario v2 canónico (54 needs), las 270 activas re-keyadas, y 751+265 candidatas importadas con provenance.
- Runtime able: el clasificador emite ids v2 y el caso feedback #13 devuelve asociaciones.

**Non-Goals:**
- Otras fuentes CCAA, pools `needs_review`/`contextual`, re-inferencia LLM, frontend, y los 7 archivos runtime modificados sin commit del servidor (se preservan tal cual).

## Decisions

### D1. Sync unidireccional servidor→local de rutas explícitas (F0)
`rsync -avz --exclude='raw/'` sobre ssh, con lista explícita de rutas: `data/acquisition/{euskadi,navarra}_registro_asociaciones/`, `data/curation/` (overrides, canonical, semantic, `tag-taxonomy-v2.proposal.json`), `data/master/`, `data/enrichment/`, `data/reports/`; para `backend/scripts/` solo los archivos **no presentes en local** (lista obtenida de `git status --porcelain` en el servidor). Commit de artefactos curados; `raw/` queda fuera de git (re-descargable, sha256 en manifests).
- *Alternativa descartada*: espejo completo — sobreescribiría archivos local-tracked y los cambios no relacionados del servidor.

### D2. Proyección de Navarra: input v2 + gate parametrizado (F1b)
`build-acquisition-runtime-candidates-v1.js` acepta: `process.argv[2]` = directorio bajo `data/acquisition/` (default `euskadi_registro_asociaciones`), `process.argv[3]` = nombre del archivo de entrada (default `normalized.jsonl`), `process.argv[4]` = gate: `strict` (default) = `relevance.reasons ∩ {direct_category, hard_direct_purpose}` (gate actual, sin cambios) o `direct` = `relevance.status === "direct_relevance"`. Navarra se ejecuta con `normalized-v2.jsonl` + gate `direct` → pool B. El mapper no se toca (ya es source-agnóstico y emite keys v2). La clasificación de relevancia de Navarra viaja en `normalized-v2.jsonl` (F1a la une desde el envelope), así la proyección sigue leyendo solo `row.relevance`. Preflight Navarra: 10.254 clasificados, 265 candidatas pool B, invariantes de contacto v2 (email 1.685 / tel 97 / web 10 en el total normalizado). **Baseline Euskadi (decisión de usuario, F1b 3.2)**: la baseline versionada (723) era obsoleta — generada desde un input de 19.695 filas y un tag mapper sin `DISCAPACIDAD`; con el input actual (28.091 filas, pipeline v3) y el tag mapper actual (con `DISCAPACIDAD`), la re-ejecución con defaults produce determinísticamente **751** (sha256 `60a8d663…`), que se adopta como baseline canónica; la re-ejecución con defaults debe ser reproducible (misma sha256).
- *Alternativa descartada 1*: script duplicado para Navarra — duplicación de lógica de gate.
- *Alternativa descartada 2*: join del envelope dentro del proyecto — acopla la proyección a `data/curation/semantic/` y duplica la fuente de verdad de la relevancia.

### D3. Migración 009 v2 como SQL idempotente (F2)
`db/local/init/009_tags_v2.sql`:
1. `ALTER TABLE copilot_ong.tags ADD COLUMN IF NOT EXISTS tag_key TEXT UNIQUE;` (nullable; legacy sin key).
2. `INSERT ... ON CONFLICT (tag_key) DO NOTHING` de los 54 needs v2 (tag_ids 35..88 en orden del JSON).
3. Re-key transaccional de `association_tags`: para cada `(legacy_id → v2_key)`, si la asociación ya tiene el id v2 → `DELETE` la fila legacy; si no → `INSERT (association_id, v2_id)` + `DELETE` legacy. Solo asociaciones con `active=true` se re-keyan; las inactivas se dejan intactas (trazabilidad).
4. `DELETE` de filas de los 3 provider ids (5, 8, 11).
5. Los ids legacy sin mapeo (34 − 29 mapeados − 3 provider = 2) se conservan; su inventario se captura en `data/reports/migration-009-report.json` (salida psql generada en verificación, no escrita por la SQL).
- *Alternativa descartada*: borrado de tags legacy — se pierden trazabilidad e ids citados en overrides/procesos históricos.
- Prototipos: `HELPCHAT_SEMANTIC_PROTOTYPES` añade 54 entradas `{tagId: 35..88, tag: <KEY>, text: <need + aliases>}` derivadas del JSON de taxonomía. El clasificador **no cambia** (es arrastrado por el array); el retrieval no cambia (sigue por `tag_id`).

### D4. Importador nuevo dedicado (F3)
`backend/scripts/import-runtime-candidates-v1.js` (no extender `import-associations.js`, que es Excel legacy):
- Args: `--source euskadi|navarra`, `--dry-run`. Conexión con el mismo patrón de `.env` que los scripts existentes.
- Mapeo candidato→`associations`: `name`, `description`, `province_key` (VIZ/ALA/GUI; Navarra → NA), `website`, `phone`, `email`, `address`, `source_sheet`=id de registro, `source_row`=`record_id`, `source_id`, `source_quality`, `content_hash` (sha256 determinista de `name|province_key|address|website`, estable entre re-ejecuciones), + provenance: `source_record_id`, `record_url` (`official_registry_url`), `detail_url`, `relevance_status` (`strict` para Euskadi, `direct` para Navarra pool B), `resource_role` (del candidato si existe).
- Tags: `tag_key`→`tag_id` vía `SELECT` contra `tags`; `INSERT ... ON CONFLICT (association_id, tag_id) DO NOTHING`.
- `INSERT ... ON CONFLICT (content_hash) DO NOTHING` dentro de una transacción; resumen JSON a stdout y reporte en `data/reports/import-<source>-<YYYYMMDD>.json`.
- *Alternativa descartada*: reutilizar `ON CONFLICT (dedupe_key)` del importador legacy — esa columna no existe en `copilot_ong.associations`; el único candidato es `content_hash` (índice único existente).

### D5. Columnas provenance en la misma migración 009
`ALTER TABLE associations ADD COLUMN IF NOT EXISTS source_record_id TEXT, record_url TEXT, detail_url TEXT, relevance_status TEXT, resource_role TEXT;` — una sola migración, idempotente, backward-compatible (todas nullable).

### D6. Verificación (F4)
- Unit: `npm test` (node --test): tests existentes del clasificador + tests nuevos (clasificador emite v2 para «soledad»; mapeo candidato→fila del importador como función pura, sin pg).
- BD: conteos psql antes/después (associations, association_tags, tags) en `data/reports/`.
- E2E: smoke contra el backend del servidor `:5174` (health + caso feedback #13 por la API pública si está expuesta; si requiere LLM, usar el runtime ya desplegado en el servidor).
- Git: `git diff --check`, `git diff --name-only` (solo los archivos permitidos).

### D7. Curación de contactos Navarra v2 — determinística sobre raw (F1a)
`backend/scripts/build-navarra-normalized-v2.js` (solo servidor, donde está `raw/`): lee `normalized.jsonl` (v1, estructura) + `raw/details/{source_record_id}.json` + el envelope v1, y escribe `normalized-v2.jsonl` + `curation-report.json` (conteos + invariantes + lista de excepciones). Transformaciones (todas deterministas, sin LLM):
1. **email**: validación RFC-5322 (local@dominio.tld, tld ≥2); 15 inválidos → `null` (con motivo en el reporte); 2 registros cuyo EMAIL es una URL (6689, 7001) → mover al campo `website`.
2. **phone**: cadena de fallback `TELEFONO1`→`TELEFONO2`→`TELEFONO3`; válido = 9 dígitos (normalizando espacios/puntos/guión, prefijo +34/0034 opcional); 3 registros sin alternativa válida (`31630`, `0`, `0`) → `null`.
3. **website**: solo `http(s)://` (o `www.` → prefixar `https://`); +2 promovidos desde EMAIL +1 recuperado de texto (registro 14961, `www.lamemoriaperdida.com`).
4. **postal_code**: 5 dígitos; +4 recuperados determinísticamente (2606→31100, 8805→31313, 8816→31001, 9052→31520).
5. **address**: concatenación v1 + enriquecimiento `TIPO_VIAL` cuando exista (9.959 direcciones enriquecidas).
6. **tax_id**: mantener; collision flag (24 records / 12 values) solo informativo, sin exclusión.
7. **relevance**: join 1:1 desde el envelope por `source_record_id` (las filas v1 llevan `relevance: null`; la forma `{status, decision, confidence, reasons, evidence}` se preserva idéntica).
Invariantes fijados (simulación ejecutada sobre raw en servidor, gate de aceptación del preflight): n=10.254; email 1.685; phone 97; website 10; postal_code 9.552; address 10.218 (9.959 con TIPO_VIAL); tax collisions 24/12; relevancia keep 668 / review 9.586.
- *Alternativa descartada 1*: curación con LLM — no determinista, no reproducible, fuera de presupuesto.
- *Alternativa descartada 2*: curar sobre el normalized v1 sin raw — imposible para TIPO_VIAL, fallback telefónico, recuperación de CP y URL (los campos no están en v1).

## Risks / Trade-offs

- [El re-key altera el retrieval de las 270 asociaciones históricas] → re-key determinista por `legacy_mapping`, reporte antes/después, dump de restauración completo; verificación de que ninguna asociación activa pierde todos sus tags.
- [Colisión de `content_hash` con filas legacy] → 1 duplicado probable ya validado contra master V3; `ON CONFLICT DO NOTHING` hace la importación segura e idempotente.
- [La proyección de Navarra pool B (265) contiene candidatas de calidad irregular (keep + high sobre registro heterogéneo)] → el preflight es gate: si la distribución (needs, provincia, contactos) es desproporcionada, se reporta BLOCKED en lugar de importar; pool A (gate estricto, 77) queda disponible como fallback más conservador (decisión de usuario: pool B).
- [Curación v2 diverge de los invariantes simulados sobre raw] → el preflight de F1a compara los conteos reales contra los invariantes fijados (D7); cualquier desviación bloquea F1b.
- [54 prototipos engordan el prompt LLM y el presupuesto p50<2 s] → textos cortos por need; tests de fast-gates (`helpchat-semantic-fast-gates`) cubren el presupuesto; si degrade, se limita el set de prototipos en el prompt (no en el array).
- [El sync trae scripts con dependencias no instaladas localmente] → solo se versionan; no se ejecutan localmente salvo los de F1/F3 (sin dependencias nuevas: node + fs/path + pg existente).

## Migration Plan

1. **F0** sync + commit de artefactos (local).
2. **F1a** curación Navarra v2: `build-navarra-normalized-v2.js` en el servidor (solo datos + raw); verificación de invariantes D7.
3. **F1b** proyección Navarra pool B (servidor/local según artefactos disponibles, solo datos): `normalized-v2.jsonl` + gate `direct`; preflight 265.
4. **F2** aplicar `009_tags_v2.sql` al `copilot_ong` del servidor (transacción única) + commit; reportar conteos.
5. **F3** dry-run Euskadi → import Euskadi → dry-run Navarra → import Navarra (servidor); reportes en `data/reports/`.
6. **F4** verificación completa (D6).

**Rollback**: `pg_restore` del dump `copilot_ong-pre-curation-2026-08-31.dump` (restaura `copilot_ong` completo); en git, revert a `restore-point/pre-curation-2026-08-31`. La migración es idempotente y forward-fixable (columnas nullable, re-key determinista), por lo que un re-apply tras rollback es seguro.

## Open Questions

- Las 2 legacy ids sin mapeo no-proveedor: se conservan tal cual (sin impacto runtime); mapearlas es trabajo futuro de taxonomía.
- Si la E2E de feedback #13 exige llamada LLM real, se ejecuta contra el runtime desplegado en el servidor (no se arranca runtime local); de no ser posible en el entorno, la verificación queda en tests unit + conteos BD y se documenta como limitación.
