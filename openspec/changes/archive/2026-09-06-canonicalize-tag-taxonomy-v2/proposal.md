# Canonicalize tag-taxonomy v2

## Why

`data/curation/tag-taxonomy-v2.proposal.json` define 54 necesidades
canónicas, mientras que el tagger runtime
`backend/scripts/lib/association-tag-mapper-v1.js` contiene 52 definitions.

Los dos gaps confirmados son:

- `PERSONAS_MAYORES`
- `ADICCIONES_DROGAS`

Mientras esos gaps existan, el vocabulario canónico v2 no es completamente
alcanzable desde el tagger runtime.

## What Changes

El change se ejecutará por fases:

- **A1** — Añadir las definitions `PERSONAS_MAYORES` y
  `ADICCIONES_DROGAS`, junto con tests positivos, variantes con/sin acento,
  negativos y no regresión de las 52 definitions existentes.
- **A2** — Regenerar Euskadi y Navarra con los parámetros de baseline
  correspondientes y medir el delta runtime real producido por A1.
- **A3** — Endurecer `import-runtime-candidates-v1.js` para que un
  canonical tag desconocido produzca un fallo explícito en vez de ser
  descartado silenciosamente.
- **A4** — Validar `db/local/init/009_tags_v2.sql`, sus mappings y la
  idempotencia de la migración.
- **A5** — Ejecutar dry-run y puertas de aceptación final.

Las estimaciones read-only realizadas anteriormente sobre el posible cambio
de volumen en Euskadi y Navarra son únicamente diagnósticas. Los conteos de
aceptación serán los obtenidos por la regeneración real de A2.

Quedan fuera de este change:

- añadir una nueva definition para `TRASTORNO_BIPOLAR`, porque ya existe;
- rehacer `LUDOPATIA` o `ACOSO_ESCOLAR`, porque ya son emitibles;
- Canarias;
- cambios no relacionados de PostgreSQL, `.env` o infraestructura.

## Capabilities

### New Capabilities

- `tag-taxonomy`: cobertura runtime de la taxonomía canónica v2, incluyendo
  evidencia determinista para las dos definitions faltantes, guardas contra
  falsos positivos, regeneración verificable, importación estricta y
  validación de persistencia.

### Modified Capabilities

Ninguna spec principal existente se modifica; `openspec/specs/` todavía no
contiene una capability principal equivalente.

## Impact

Las fases del change pueden afectar a:

- `backend/scripts/lib/association-tag-mapper-v1.js`
- `backend/tests/association-tag-mapper-v1.test.js`
- artefactos runtime de Euskadi y Navarra
- `backend/scripts/import-runtime-candidates-v1.js`
- tests asociados al importador
- `db/local/init/009_tags_v2.sql` y sus mappings, únicamente en la medida
  necesaria para verificar A4

La ejecución se mantendrá acotada por fase y con gates deterministas antes
de avanzar a la siguiente.
