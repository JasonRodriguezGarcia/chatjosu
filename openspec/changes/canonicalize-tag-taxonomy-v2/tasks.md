# Tasks — canonicalize-tag-taxonomy-v2

## A1 — Completar definitions runtime

- [x] A1.1 Añadir `PERSONAS_MAYORES` a `DEFINITIONS`.
- [x] A1.2 Añadir `ADICCIONES_DROGAS` a `DEFINITIONS`.
- [x] A1.3 Añadir tests positivos para `PERSONAS_MAYORES`.
- [x] A1.4 Añadir variantes con/sin acento pertinentes.
- [x] A1.5 Añadir tests positivos para `ADICCIONES_DROGAS`.
- [x] A1.6 Añadir negativos para `droga` aislada y `adicciones` sin contexto
      suficiente.
- [x] A1.7 Verificar que adicciones comportamentales no se convierten
      indebidamente en `ADICCIONES_DROGAS`.
- [x] A1.8 Actualizar mínimamente el test existente relacionado con
      “mayores”, conservando su intención de no crear una enfermedad
      incorrecta.
- [x] A1.9 Ejecutar la suite relevante y verificar no regresión del
      comportamiento existente.
- [x] A1.10 Ejecutar checks sintácticos y `git diff --check` sobre el scope
      de A1.

## A2 — Regenerar Euskadi y Navarra

- [x] A2.1 Regenerar Euskadi con sus parámetros de baseline.
- [x] A2.2 Regenerar Navarra con sus parámetros de baseline.
- [x] A2.3 Comparar los nuevos artefactos con sus baselines anteriores.
- [x] A2.4 Registrar el delta runtime real producido por A1.
- [x] A2.5 Verificar que no se utiliza una predicción previa como conteo de
      aceptación.

## A3 — Endurecer el importador

- [x] A3.1 Cambiar `import-runtime-candidates-v1.js` para que un canonical
      tag desconocido produzca un fallo explícito.
- [x] A3.2 Añadir o adaptar tests para canonical tags válidos.
- [x] A3.3 Añadir test para unknown canonical tag.
- [x] A3.4 Verificar que no existe silent-drop.
- [x] A3.5 Ejecutar dry-run del importador sin escrituras.

## A4 — Validar migración 009

- [x] A4.1 Validar la taxonomía declarada por `009_tags_v2.sql`.
- [x] A4.2 Validar mappings legacy→v2.
- [x] A4.3 Verificar que no existen mappings ambiguos o inválidos.
- [x] A4.4 Verificar idempotencia de la migración en un entorno seguro.
- [x] A4.5 Registrar los resultados de la validación necesarios para la
      aceptación.


### Evidencia de aceptación A4

- Taxonomía `009_tags_v2.sql`: 54 canonical tags; correspondencia completa con las 54 definitions runtime; IDs v2 35..88 verificados en instalación limpia.
- Mappings legacy→v2: 32 pares, 29 legacy sources y 24 canonical targets; sin pares duplicados, targets inválidos ni solapamiento con provider IDs.
- Mappings 1→N validados: `15 → PARKINSON + ALZHEIMER`, `27 → EXCLUSION_SOCIAL + INSERCION_LABORAL`, `30 → INMIGRACION_REFUGIO + INSERCION_LABORAL`.
- Legacy sin mapping conservados: `7 BIENESTAR SOCIAL` y `26 INVESTIGACIÓN CÁNCER`; no se introdujo una equivalencia canónica ambigua.
- Provider IDs `5`, `8` y `11` eliminados según el contrato existente.
- Idempotencia estricta validada sobre instalación limpia `001..008 → 009 → 009`: estado lógico y secuencia permanecen idénticos tras la segunda ejecución.
- Idempotencia estricta validada también sobre clon de la BD ya migrada: `before == after1 == after2`, incluida la secuencia.
- La BD fuente permaneció intacta durante las validaciones (`1016` asociaciones, `1322` relaciones y `54` canonical tags).
- SHA-256 de `009_tags_v2.sql` aceptado: `9ded1a60652a0f28f7e439d87c4487fa6877e43e0a5627cfbb1192754ec12bbd`.

## A5 — Aceptación final

- [ ] A5.1 Ejecutar los dry-runs definidos.
- [ ] A5.2 Ejecutar las suites relevantes.
- [ ] A5.3 Ejecutar `openspec validate canonicalize-tag-taxonomy-v2`.
- [ ] A5.4 Ejecutar checks de whitespace/diff sobre el scope final.
- [ ] A5.5 Verificar que no se modificaron archivos fuera del scope.
- [ ] A5.6 Registrar la aceptación final del change.
