# association-curation Specification

## Purpose
Permite promover asociaciones de registros oficiales (Euskadi y Navarra) a la base de datos de producción con una taxonomía de tags canónica v2, de modo que el runtime de helpchat pueda recuperarlas y responder consultas reales de usuarios.

## Requirements

### Requirement: Artefactos curados reproducibles en el repositorio
El repositorio SHALL contener los artefactos curados de Euskadi y Navarra (normalizados v1 y v2, candidatas runtime, preflights, overrides, master, enrichments, reports) y los scripts de pipeline que los producen. Los archivos `raw/` SHALL permanecer fuera de git y SHALL poder re-descargarse y verificarse por sha256 contra sus manifests.

#### Scenario: Sincronización completa verificable
- **WHEN** se ejecuta la sincronización servidor→local y se commitan los artefactos curados
- **THEN** los directorios `data/acquisition/{euskadi,navarra}_registro_asociaciones/` (sin `raw/`), `data/curation/`, `data/master/`, `data/enrichment/` y `data/reports/` existen localmente y `git status` muestra solo las adiciones esperadas

#### Scenario: Raw re-descargable y verificado
- **WHEN** se elimina localmente un directorio `raw/` y se re-descarga
- **THEN** el sha256 de cada archivo coincide con el manifest de su fuente

### Requirement: Curación de contactos de Navarra v2
El script de curación v2 SHALL regenerar `normalized-v2.jsonl` y `curation-report.json` a partir de los 10.254 registros normalizados v1 y su `raw/`, de forma determinista: emails validados (RFC-5322), teléfonos con cadena de fallback `TELEFONO1→TELEFONO2→TELEFONO3`, websites solo `http(s)`, códigos postales de 5 dígitos, direcciones enriquecidas con `TIPO_VIAL`, `tax_id` con collision flag informativo, y `relevance` unido 1:1 desde el envelope semántico por `source_record_id`. Los invariantes de salida SHALL ser: email 1.685, teléfono 97, website 10, postal_code 9.552, address 10.218 (9.959 con TIPO_VIAL), tax collisions 24 records/12 values, relevancia keep 668 / review 9.586.

#### Scenario: Invariantes de curación v2
- **WHEN** se ejecuta la curación v2 sobre Navarra en el servidor
- **THEN** `normalized-v2.jsonl` contiene 10.254 filas con el mismo set de `source_record_id` que v1, `relevance` no nulo en todas, y el preflight de `curation-report.json` coincide con los invariantes fijados

#### Scenario: Excepciones auditables
- **WHEN** se inspecciona `curation-report.json`
- **THEN** los emails invalidados, teléfonos nulos, promociones a website, URL recuperada y CP recuperados aparecen identificados por registro con su motivo

### Requirement: Proyección de Navarra con pool B
La proyección de Navarra SHALL producir `runtime-candidates.jsonl` y `runtime-preflight.json` a partir de `normalized-v2.jsonl` con el gate `direct` (`relevance.status === "direct_relevance"`) y al menos una necesidad de confianza alta. Cada registro SHALL quedar clasificado exactamente en un pool. La primera baseline del pool B fue 265, pero la regeneración posterior con la taxonomía canónica completa SHALL supersederla; la autoridad runtime actual SHALL contener **319** candidatas Navarra, y el preflight SHALL mantener 10.254 registros clasificados. La parametrización del script SHALL mantener la compatibilidad con Euskadi (gate `strict` por defecto, re-ejecución reproducible con la baseline canónica).

#### Scenario: Proyección completa pool B
- **WHEN** se ejecuta la proyección sobre `normalized-v2.jsonl` con gate `direct`
- **THEN** se generan los artefactos runtime canónicos actuales (`runtime-candidates.jsonl` con **319 candidatas**) y `runtime-preflight.json` mantiene 10.254 registros clasificados

#### Scenario: Reproducibilidad de la baseline Euskadi
- **WHEN** se re-ejecuta la proyección de Euskadi con valores por defecto
- **THEN** la salida aceptada coincide con la autoridad canónica actual de **958 candidatas**, sha256 `dedbbb908146fc380c8d03a01b0d73c0ed9c1819a50d0a03f6161c4198d944e5`; la baseline 751/`60a8d663…` se conserva únicamente como histórico

### Requirement: Vocabulario de tags canónico v2
La tabla `tags` SHALL contener los 54 needs de la taxonomía v2, cada uno con un `tag_key` único. Las asociaciones activas existentes SHALL re-keyarse de ids legacy a ids v2 mediante `legacy_mapping` sin perder cobertura de tags mapeables. Las filas `association_tags` de los 3 tags legacy contaminados por proveedor SHALL eliminarse. Los ids legacy sin mapeo SHALL conservarse y reportarse.

#### Scenario: Migración v2 aplicada
- **WHEN** se aplica la migración 009 sobre `copilot_ong`
- **THEN** `tags` contiene 54 filas v2 con `tag_key` único y las 34 legacy siguen existentes para trazabilidad

#### Scenario: Re-key de asociaciones activas
- **WHEN** una asociación activa tiene un tag legacy con entrada en `legacy_mapping`
- **THEN** su fila `association_tags` queda re-keyada al id v2 correspondiente (sin duplicados por asociación)

#### Scenario: Tags contaminados eliminados
- **WHEN** una asociación activa solo estaba etiquetada con un tag legacy de proveedor (ids 5, 8, 11)
- **THEN** esas filas se eliminan y la asociación conserva el resto de sus tags

#### Scenario: Legacy sin mapeo reportado
- **WHEN** una asociación activa tiene un id legacy sin entrada en `legacy_mapping`
- **THEN** la fila se conserva sin cambios y aparece en el reporte de migración

### Requirement: Alcanzabilidad runtime de tags v2
El clasificador semántico de helpchat SHALL ser capaz de emitir ids de tag v2 para los 54 needs, y el servicio de asociaciones SHALL devolver asociaciones etiquetadas v2 para necesidades coincidentes de usuarios, incluida la necesidad de soledad en Bizkaia.

#### Scenario: Clasificación de soledad
- **WHEN** se clasifica la consulta «tengo 70 años y me siento sola»
- **THEN** `SOLEDAD_NO_DESEADA` aparece entre los candidatos semánticos

#### Scenario: E2E feedback #13
- **WHEN** se ejecuta el caso feedback #13 (persona mayor sola, Bizkaia) contra el backend del servidor
- **THEN** la respuesta incluye al menos una asociación de Bizkaia relevante para soledad/compañía

### Requirement: Promoción de candidatas con provenance y deduplicación
El importador SHALL insertar los artefactos canónicos actuales de Euskadi (**958**) y Navarra (**319**) en `copilot_ong.associations` con provenance (registro de origen, URL del registro, rol de recurso, estado de relevancia: `strict` o `direct`). El contenido duplicado (mismo `content_hash`) SHALL omitirse. El modo `--dry-run` SHALL informar los conteos planeados sin escribir. La re-ejecución SHALL ser idempotente.

#### Scenario: Dry-run sin efectos
- **WHEN** se ejecuta el importador con `--dry-run` sobre Euskadi
- **THEN** se reportan los conteos de inserción/omisión y el número de filas de `associations` no cambia

#### Scenario: Importación de Euskadi
- **WHEN** se ejecuta la importación de las **958** candidatas actuales de Euskadi
- **THEN** se insertan las nuevas asociaciones (omitidos los duplicados por `content_hash`, conteo exacto verificado en el dry-run de F3) y sus columnas de provenance están pobladas

#### Scenario: Importación de Navarra
- **WHEN** se ejecuta la importación de las **319** candidatas actuales de Navarra
- **THEN** se insertan las asociaciones nuevas (omitidos los duplicados por `content_hash`) con `relevance_status` = `direct` y `province_key` = `NA`

#### Scenario: Idempotencia
- **WHEN** se re-ejecuta la importación de Euskadi tras una importación exitosa
- **THEN** se insertan 0 filas nuevas y no se alteran las existentes

### Requirement: Puertas de verificación
El cambio SHALL considerarse completo únicamente cuando: los tests de clasificador e importador pasen, `git diff --check` sea limpio, los conteos psql antes/después se reporten, y la E2E smoke del caso feedback #13 pase contra el backend del servidor.

#### Scenario: Verificación completa
- **WHEN** se ejecutan las puertas de verificación definidas
- **THEN** todas reportan éxito y los artefactos de conteo (dry-run, before/after) están guardados en `data/reports/`
