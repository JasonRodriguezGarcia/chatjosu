# Canonicalize tag-taxonomy v2 — Design

## Context

La taxonomía canónica v2 contiene 54 needs y el tagger runtime tiene
actualmente 52 definitions.

Los dos gaps confirmados son:

- `PERSONAS_MAYORES`
- `ADICCIONES_DROGAS`

`TRASTORNO_BIPOLAR` ya dispone de definition. `LUDOPATIA` y
`ACOSO_ESCOLAR` ya son emitibles y no forman parte del gap.

El importador runtime puede descartar actualmente canonical tags
desconocidos sin producir un fallo explícito.

## Goals

- Hacer alcanzables desde el tagger runtime las 54 needs canónicas.
- Añadir evidencia determinista y guardas contra falsos positivos para las
  dos definitions nuevas.
- Conservar el comportamiento de las 52 definitions existentes.
- Medir el impacto real de A1 sobre Euskadi y Navarra.
- Eliminar el silent-drop de canonical tags desconocidos en el importador.
- Verificar la migración 009, sus mappings y su idempotencia.
- Cerrar el change con dry-run y aceptación determinista.

## Non-Goals

- Crear una definition nueva de `TRASTORNO_BIPOLAR`.
- Rediseñar `LUDOPATIA` o `ACOSO_ESCOLAR`.
- Trabajar sobre Canarias.
- Hacer cambios de infraestructura o configuración no relacionados.

## Decisions

### D1. PERSONAS_MAYORES

La definition deberá reconocer evidencia explícita del ámbito de personas
mayores, incluyendo expresiones equivalentes a:

- personas mayores;
- tercera edad;
- anciano / ancianos;
- geriatría / geriátrico.

Se probarán variantes ortográficas y de acentuación pertinentes.

El ajuste del test existente relacionado con “mayores” conservará su
intención original de no crear una necesidad de enfermedad incorrecta,
pero permitirá emitir `PERSONAS_MAYORES` cuando exista evidencia adecuada
del colectivo.

### D2. ADICCIONES_DROGAS

La definition deberá reconocer evidencia explícita de adicción a drogas o
sustancias, incluyendo expresiones equivalentes a:

- drogadicción;
- drogadicto / drogadictos;
- toxicomanía;
- adicción a drogas;
- adicción a sustancias;
- estupefacientes cuando aparezcan en contexto de adicción.

La palabra aislada `droga` no será señal suficiente.

La palabra aislada `adicciones` tampoco será señal suficiente.

La definition no deberá convertir automáticamente una adicción
comportamental en `ADICCIONES_DROGAS`.

### D3. Tests de A1

Los tests cubrirán:

- positivos de `PERSONAS_MAYORES`;
- positivos de `ADICCIONES_DROGAS`;
- variantes con y sin acento cuando sean pertinentes;
- negativos para términos aislados o contexto insuficiente;
- no interferencia con adicciones comportamentales;
- no regresión del comportamiento existente.

No se utilizará como criterio de aceptación un número supuesto de tests.
El gate será que la suite relevante pase.

### D4. Regeneración de A2

Después de aceptar A1 se regenerarán los artefactos runtime de Euskadi y
Navarra utilizando los parámetros de baseline correspondientes.

A2 deberá registrar el delta real observado frente al baseline anterior.

Las predicciones diagnósticas realizadas antes de A1 no serán conteos de
aceptación.

### D5. Importador estricto en A3

`import-runtime-candidates-v1.js` deberá fallar explícitamente cuando una
candidata contenga un canonical tag desconocido.

El comportamiento aceptado será:

- canonical tag conocido → procesado normalmente;
- canonical tag desconocido → fallo explícito y diagnosticable;
- nunca silent-drop.

### D6. Validación de 009 en A4

A4 comprobará:

- correspondencia de la taxonomía v2;
- mappings legacy→v2;
- ausencia de mappings ambiguos o inválidos;
- comportamiento idempotente de la migración.

La validación deberá ejecutarse de forma segura antes de cualquier
aceptación definitiva.

### D7. Aceptación final en A5

A5 ejecutará los dry-runs y gates deterministas correspondientes a las
fases anteriores.

El change sólo se considerará completo cuando no existan regresiones
conocidas, los checks de integridad pasen y el scope final sea el esperado.

## Sequencing

El orden canónico es:

A1 → A2 → A3 → A4 → A5

Cada fase debe alcanzar sus gates antes de avanzar a la siguiente.

## Risks / Trade-offs

Los principales riesgos son falsos positivos de las definitions nuevas,
regresiones en definitions existentes, diferencias inesperadas en el
runtime regenerado y pérdida silenciosa de tags durante la importación.

Se mitigan mediante tests deterministas, comparación de deltas reales,
fallo explícito en el importador y gates de aceptación por fase.
