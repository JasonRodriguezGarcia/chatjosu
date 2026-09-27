## Purpose

Permite promover asociaciones de registros oficiales (Euskadi y Navarra) a la base de datos de producción con una taxonomía de tags canónica v2, de modo que el runtime de helpchat pueda recuperarlas y responder consultas reales de usuarios.

## ADDED Requirements

### Requirement: Envelope semántico de Canarias v1 reproducible
El repositorio SHALL contener el builder `backend/scripts/build-canarias-semantic-envelope-v1.js` y sus artefactos generados `data/curation/semantic/envelopes/canarias-semantic-envelope-v1.jsonl` (23.036 líneas) y `data/curation/semantic/envelopes/canarias-semantic-envelope-v1.report.json`, producidos de forma determinista desde la raíz del repositorio a partir de `data/acquisition/canarias_registro_asociaciones/normalized.jsonl` (23.036 registros) y `data/curation/semantic/source-taxonomies/canarias-taxonomy-map-v1.proposal.json` (141 clases), sin modificar scripts, librerías ni taxonomías existentes. El directorio `raw/` de Canarias SHALL permanecer fuera de git. El reporte SHALL contener `format_version` (1), `source_id` (`canarias_registro_asociaciones`), `source_candidates` (23036), `taxonomy` (`matched`, `unmatched`, `modes` con los 5 modos), `relevance` (distribución `decision:status`), `utility` (`keep`/`drop`/`protected`), `routing` (4 rutas), `dimensions` (`needs`/`functions`/`populations`/`activities`) y `signals` (4 señales).

#### Scenario: Ejecución exitosa desde la raíz del repositorio
- **WHEN** se ejecuta `node backend/scripts/build-canarias-semantic-envelope-v1.js` desde la raíz del repo
- **THEN** se generan ambos artefactos y la salida por consola termina en `CANARIAS_SEMANTIC_ENVELOPE_V1=PASS`

#### Scenario: Determinismo por re-ejecución
- **WHEN** se re-ejecuta el builder tras una ejecución exitosa
- **THEN** el sha256 de `canarias-semantic-envelope-v1.jsonl` y de `canarias-semantic-envelope-v1.report.json` es idéntico entre ejecuciones

#### Scenario: Paridad 1:1 con el input
- **WHEN** se comparan los artefactos con `normalized.jsonl`
- **THEN** el envelope contiene exactamente 23.036 registros con el mismo set de `source_record_id` que el input, `candidate_id` sin duplicados, y `report.source_candidates` es 23036

### Requirement: Contrato de registro del envelope de Canarias v1
Cada registro del envelope SHALL ser un objeto JSON con `format_version` (1), `candidate_id`, `source_id` (`candidate.source_id ?? "canarias_registro_asociaciones"`), `source_record_id`, `content_hash` (`candidate.content_hash ?? null`; `null` en el normalizado v1 de Canarias), `name`, `description`, `province_key`, `municipality_name`, `relevance` (gate `association-relevance-v1`), `utility` (gate `association-utility-gate-v1`), `routing` (`route` ∈ {`out_of_scope`, `deterministic_only`, `constrained`, `llm_open`}, `explicit_evidence_count`, `official_mode`), `source_taxonomy` (`class`, `scope`, `mapping` con `source`, `matched`, `mode`, `assertions`, `candidates`, `hints`) y `deterministic` con las dimensiones `needs`, `functions`, `populations`, `activities`, cada una `{keys, evidence}`. La semántica de la clase oficial se procesa exclusivamente a través de `mapCanariasSourceTaxonomyV1`; los gates genéricos SHALL inspeccionar únicamente `name` y `description`.

#### Scenario: Registro completo
- **WHEN** se inspecciona cualquier registro del envelope
- **THEN** todos los campos del contrato están presentes (con valor `null` permitido solo donde el input lo permite, p. ej. `content_hash` y `description`) y `source_taxonomy.mapping.matched` es `true`

#### Scenario: Routing exacta
- **WHEN** se evalúa el routing de un registro
- **THEN** el registro queda clasificado exactamente en una ruta: `utility.decision === "drop"` → `out_of_scope`; `explicit_evidence_count === 0` → `llm_open`; `official_mode` ∈ {`strong_candidate`, `candidate_set`, `context`} → `constrained`; en otro caso → `deterministic_only`

### Requirement: Semántica de la taxonomía de origen de Canarias
El envelope SHALL consumir `canarias-taxonomy-map-v1.proposal.json` (`format_version` "1", 141 clases, `source_records` 23036) como evidencia semántica/de-origen, con modo ∈ {`source_assertion`, `strong_candidate`, `candidate_set`, `context`, `none`} y sentinela `<missing>`: `source_assertion` aporta `assertions`, `strong_candidate` y `candidate_set` aportan `candidates`, `context` aporta solo `hints`, y `none` no aporta concepto. La clase oficial nunca SHALL descartar un registro por sí sola, y la coverage SHALL ser completa: `report.taxonomy.unmatched` SHALL ser 0.

#### Scenario: Coverage completa de clases
- **WHEN** el builder mapea las clases oficiales de los 23.036 registros del input
- **THEN** `report.taxonomy.matched` es 23.036, `report.taxonomy.unmatched` es 0, y la suma de `report.taxonomy.modes` es 23.036

#### Scenario: Clase no reconocida
- **WHEN** el input contiene una `original_category` ausente de la taxonomía
- **THEN** el builder falla explícitamente con `CANARIAS_TAXONOMY_UNMATCHED:<n>` sin generar ni sobreescribir artefactos

### Requirement: Relación con el tagging canónico de runtime
El envelope NO SHALL crear una segunda taxonomía de tags de runtime: `deterministic.needs` SHALL provenir exclusivamente del mapeador canónico `mapAssociationTagsV1` (`backend/scripts/lib/association-tag-mapper-v1.js`) y las claves de las dimensiones deterministas SHALL pertenecer al vocabulario canónico de conceptos ya utilizado por los gates. La proyección runtime de Canarias SHALL seguir emitiendo tags canónicos por la vía existente (`build-acquisition-runtime-candidates-v1.js` → `runtime-candidates.jsonl` con `tags[]`), sin que este stage la regenere ni dependa de ella.

#### Scenario: Sin nueva taxonomía de runtime
- **WHEN** se inspecciona el diff del change
- **THEN** no se añade ningún archivo de taxonomía de tags de runtime y `data/master/tags.json` no se modifica

#### Scenario: Vía runtime intacta
- **WHEN** se ejecuta el change sobre el repo
- **THEN** `data/acquisition/canarias_registro_asociaciones/runtime-candidates.jsonl` (9 candidatas) y `runtime-preflight.json` (471 strict, 462 unmapped, 9 high_associations) permanecen sin regenerar ni modificar

### Requirement: Guardas deterministas del envelope de Canarias
El builder SHALL fallar explícitamente, sin generar ni sobreescribir artefactos, ante: input con número de filas distinto de 23.036 (`UNEXPECTED_CANARIAS_NORMALIZED_ROWS:<n>`), salida sin paridad (`CANARIAS_ENVELOPE_PARITY_FAIL`), `candidate_id` duplicados (`CANARIAS_ENVELOPE_DUPLICATE_IDS`), partición de routing inconsistente (`CANARIAS_ROUTE_PARTITION_FAIL`), `taxonomy.unmatched` distinto de 0 (`CANARIAS_TAXONOMY_UNMATCHED:<n>`), taxonomía inválida (`INVALID_CANARIAS_SOURCE_TAXONOMY_V1`) o modo desconocido (`UNKNOWN_CANARIAS_TAXONOMY_MODE:<mode>`).

#### Scenario: Input con filas inesperadas
- **WHEN** `normalized.jsonl` no contiene exactamente 23.036 registros
- **THEN** el builder lanza `UNEXPECTED_CANARIAS_NORMALIZED_ROWS:<n>` y no genera ni sobreescribe artefactos

#### Scenario: Partición de routing
- **WHEN** la suma de los contadores de `report.routing` no es 23.036
- **THEN** el builder lanza `CANARIAS_ROUTE_PARTITION_FAIL`
