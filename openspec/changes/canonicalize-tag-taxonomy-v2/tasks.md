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

- [ ] A3.1 Cambiar `import-runtime-candidates-v1.js` para que un canonical
      tag desconocido produzca un fallo explícito.
- [ ] A3.2 Añadir o adaptar tests para canonical tags válidos.
- [ ] A3.3 Añadir test para unknown canonical tag.
- [ ] A3.4 Verificar que no existe silent-drop.
- [ ] A3.5 Ejecutar dry-run del importador sin escrituras.

## A4 — Validar migración 009

- [ ] A4.1 Validar la taxonomía declarada por `009_tags_v2.sql`.
- [ ] A4.2 Validar mappings legacy→v2.
- [ ] A4.3 Verificar que no existen mappings ambiguos o inválidos.
- [ ] A4.4 Verificar idempotencia de la migración en un entorno seguro.
- [ ] A4.5 Registrar los resultados de la validación necesarios para la
      aceptación.

## A5 — Aceptación final

- [ ] A5.1 Ejecutar los dry-runs definidos.
- [ ] A5.2 Ejecutar las suites relevantes.
- [ ] A5.3 Ejecutar `openspec validate canonicalize-tag-taxonomy-v2`.
- [ ] A5.4 Ejecutar checks de whitespace/diff sobre el scope final.
- [ ] A5.5 Verificar que no se modificaron archivos fuera del scope.
- [ ] A5.6 Registrar la aceptación final del change.
