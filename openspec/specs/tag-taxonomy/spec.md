# tag-taxonomy Specification

## Purpose
Garantizar que la taxonomía canónica v2 sea completamente alcanzable desde
el runtime, que las dos definitions faltantes se resuelvan con evidencia
determinista, y que las fases posteriores de regeneración, importación y
persistencia mantengan integridad verificable.

## Requirements

### Requirement: Cobertura runtime completa de la taxonomía v2

El tagger runtime SHALL poder emitir las 54 needs de la taxonomía canónica
v2. Para completar la cobertura existente SHALL incorporar definitions para
`PERSONAS_MAYORES` y `ADICCIONES_DROGAS` sin eliminar el comportamiento de
las 52 definitions existentes.

#### Scenario: Evidencia explícita de personas mayores

- **WHEN** el texto contiene una expresión explícita como «personas mayores»,
  «tercera edad», «ancianos» o «geriatría»
- **THEN** el tagger emite `PERSONAS_MAYORES`

#### Scenario: Evidencia explícita de adicción a drogas

- **WHEN** el texto contiene evidencia explícita como «drogadicción»,
  «toxicomanía» o «adicción a sustancias»
- **THEN** el tagger emite `ADICCIONES_DROGAS`

#### Scenario: Definitions existentes sin regresión

- **WHEN** se ejecuta la suite relevante después de añadir las dos
  definitions nuevas
- **THEN** el comportamiento cubierto de las definitions existentes continúa
  pasando sus tests

### Requirement: Guardas deterministas contra falsos positivos

Las definitions nuevas SHALL requerir evidencia suficiente y SHALL evitar
emitir necesidades canónicas por términos aislados o por contextos que
pertenezcan a otra categoría.

#### Scenario: Droga aislada no es evidencia suficiente

- **WHEN** aparece la palabra `droga` sin contexto de adicción a sustancias
- **THEN** el tagger no emite `ADICCIONES_DROGAS` únicamente por esa palabra

#### Scenario: Adicciones aislada no es evidencia suficiente

- **WHEN** aparece la palabra `adicciones` sin contexto que identifique drogas
  o sustancias
- **THEN** el tagger no emite `ADICCIONES_DROGAS` únicamente por esa palabra

#### Scenario: Adicción comportamental no se convierte en adicción a drogas

- **WHEN** el texto describe una adicción comportamental sin evidencia de
  drogas o sustancias
- **THEN** `ADICCIONES_DROGAS` no se emite por ese contexto

#### Scenario: Personas mayores no implica enfermedad

- **WHEN** el texto contiene evidencia explícita del colectivo de personas
  mayores pero no evidencia de una enfermedad
- **THEN** el tagger puede emitir `PERSONAS_MAYORES` sin introducir por ello
  una necesidad de enfermedad no sustentada

### Requirement: Regeneración con delta runtime real

Después de aceptar las definitions de A1, los artefactos runtime de Euskadi
y Navarra SHALL regenerarse utilizando los parámetros de baseline
correspondientes y SHALL compararse con sus resultados anteriores.

#### Scenario: Delta real medido

- **WHEN** se regeneran Euskadi y Navarra después de A1
- **THEN** se obtiene y registra el delta runtime real frente al baseline de
  cada territorio

#### Scenario: Predicciones previas no son criterio de aceptación

- **WHEN** los resultados reales difieren de estimaciones diagnósticas
  anteriores
- **THEN** los resultados regenerados y verificados, y no las predicciones,
  se utilizan como evidencia de aceptación

### Requirement: Unknown canonical tags producen fallo explícito

El importador runtime SHALL rechazar de forma explícita una candidata que
contenga un canonical tag desconocido y SHALL NOT descartarlo
silenciosamente.

#### Scenario: Canonical tag conocido

- **WHEN** una candidata contiene únicamente canonical tags reconocidos
- **THEN** el importador continúa su procesamiento normal

#### Scenario: Canonical tag desconocido

- **WHEN** una candidata contiene un canonical tag que no pertenece al
  vocabulario aceptado
- **THEN** el importador falla explícitamente con información suficiente para
  diagnosticar el tag problemático

### Requirement: Migración v2 verificable e idempotente

La validación de `009_tags_v2.sql` SHALL comprobar la coherencia de la
taxonomía v2, sus mappings legacy→v2 y su comportamiento idempotente antes
de la aceptación final.

#### Scenario: Mappings válidos

- **WHEN** se inspeccionan y validan los mappings legacy→v2
- **THEN** cada mapping aceptado referencia una correspondencia válida y no
  ambigua

#### Scenario: Reejecución idempotente

- **WHEN** la migración se valida mediante una reejecución segura sobre un
  estado ya migrado
- **THEN** no introduce duplicados ni altera indebidamente el estado ya
  aceptado

### Requirement: Aceptación final mediante gates deterministas

El change SHALL considerarse completo únicamente cuando las fases A1 a A5
hayan superado sus validaciones correspondientes y el scope final sea el
esperado.

#### Scenario: Gates completos

- **WHEN** se ejecutan los tests, dry-runs, validaciones OpenSpec y checks de
  integridad definidos para el change
- **THEN** todos los gates requeridos pasan antes de declarar el change
  aceptado
