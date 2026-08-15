# HelpChat — Current State

Fecha del checkpoint: 2026-08-15

## Propósito

HelpChat / Copilot ONG es un sistema conversacional de orientación
hacia recursos sociales y asociaciones.

El producto orienta. No diagnostica.

La experiencia pública debe sentirse como una conversación natural,
no como un formulario, buscador ni interfaz de etiquetas.

## Límites de producto

- El sistema puede comprender condiciones declaradas por la persona.
- Puede registrar síntomas, señales, observaciones y circunstancias.
- No debe convertir síntomas en diagnósticos.
- Puede aclarar información cuando esa aclaración cambia materialmente
  la búsqueda, el ranking, la seguridad o la respuesta.
- Debe dejar de preguntar cuando ya existe información suficiente.
- El LLM puede variar la redacción y ayudar a comprender lenguaje
  natural, pero no puede inventar categorías, transiciones o recursos.
- Los recursos presentados deben proceder del catálogo autorizado
  por software.

## Arquitectura conversacional objetivo

Flujo canónico:

    input
      ↓
Understanding Router
      ↓
    facts
      ↓
Conversation State V2
      ↓
Conversation Policy V1
      ↓
  ask | search | respond
      ↓
Resource Ranker
      ↓
LLM renderer

Clarification Graph V1 se mantiene pequeño y se utiliza sólo para
decisiones discretas/cerradas que realmente necesitan opciones legales.

No se construirá un Graph V2 exhaustivo.

## Responsabilidades de IA

Estrategia local-first:

    reglas / fast gates
            ↓
       embeddings
            ↓
     Qwen si ambiguo
            ↓
  proveedor remoto fallback

Cada proveedor debe recibir sólo el contexto mínimo necesario.

La lógica de seguridad, estado, routing y autorización puede y debe ser
determinista cuando convenga.

El LLM se utiliza especialmente para:

- comprensión ambigua;
- selección entre opciones previamente autorizadas;
- redacción natural;
- variación lingüística controlada.

El LLM no es autoridad de flujo.

## Latencia

Requisito de UX:

- feedback inmediato: < 100 ms;
- respuesta útil típica: < 2 s;
- p95 objetivo: < 4 s.

Debe medirse, cuando corresponda:

- cliente;
- backend;
- clasificación;
- embeddings;
- proveedor LLM;
- lookup de recursos;
- roundtrip total.

## Conversation State V2

El modelo debe soportar varias personas dentro de una misma conversación.

Modelo conceptual:

    person {
      id
      relationship
      needs[]
      facts[]
      constraints[]
      resolvedDimensions{}
    }

    currentFocus
    territory

`resolvedDimensions` ya se utiliza para evitar volver a preguntar
dimensiones resueltas.

`diagnosis_status` distingue como mínimo:

- confirmed
- not_confirmed
- uncertain

Una hipótesis del usuario no equivale a diagnóstico confirmado.

Ejemplos:

- "Mi hermano tiene Parkinson"
  → condición declarada/confirmada por la conversación.

- "Creemos que puede tener Parkinson"
  → hipótesis / uncertain.

- "Tiembla y le cuesta moverse"
  → observaciones; NO Parkinson.

### Deuda pendiente

El territorio sigue siendo demasiado global para conversaciones
multi-persona.

Debe evolucionar para soportar casos como:

    "Mi hermano vive en Gipuzkoa y mi suegra en Bizkaia."

sin mezclar recursos territoriales entre personas.

## Invariantes conversacionales

### No-repeat

Una dimensión resuelta no debe volver a preguntarse salvo que:

- el usuario la corrija;
- aparezca una contradicción real;
- exista nueva información que cambie materialmente su significado.

### Progress

Toda aclaración debe producir al menos uno de estos efectos:

- añadir información;
- corregir información;
- resolver una dimensión;
- cambiar a otra dimensión;
- resolver una necesidad;
- terminar la aclaración.

Si no se produce progreso, el sistema debe salir de la aclaración
mediante un fallback seguro, no repetir indefinidamente el mismo nodo.

### Materiality

Sólo se pregunta cuando la respuesta puede cambiar materialmente:

- búsqueda;
- ranking;
- seguridad;
- interpretación necesaria;
- recurso mostrado.

El enriquecimiento opcional no debe bloquear el avance.

## Clarification Graph V1

Contrato conceptual:

    node
      choices[]
        action:
          resolve
          goto
          free_text
          ...futuras

El runtime debe recordar:

- nodo pendiente;
- dimensión pendiente;
- persona afectada;
- modo/contexto de aclaración.

El texto libre durante una aclaración debe interpretarse dentro del
nodo activo, no como una conversación nueva desde cero.

Embeddings/Qwen deben recibir solamente las ramas legales del nodo
como contexto mínimo.

Pendiente generalizar:

- reentrada;
- no-repeat;
- texto libre contextual;
- distinción obligatorio/opcional.

## Resource model

La dirección arquitectónica es separar:

    observación / situación
            ↓
          need
            ↓
     resource_function
            ↓
      organization

No depender exclusivamente de tags literales.

Ejemplo:

    "Tengo 70 años y me siento sola"
            ↓
      soledad/aislamiento
            ↓
    compañía/socialización
            ↓
  actividades comunitarias
  centro social / mayores
  cultura / ocio / coro
  voluntariado
            ↓
     asociaciones reales

El caso anterior está pendiente de validación E2E una vez que el
workstream de datos amplíe el catálogo.

## Separación de workstreams

### DATA WORKSTREAM

Propietario de:

- adquisición de fuentes;
- normalización;
- relevancia/tagging de recursos;
- deduplicación;
- Master V3;
- promoción;
- PostgreSQL;
- cobertura territorial;
- provenance de asociaciones.

Este workstream puede cambiar contratos de datos, pero debe comunicar
explícitamente cualquier cambio consumido por HelpChat.

### HELPCHAT WORKSTREAM

Propietario de:

- Understanding Router;
- Conversation State;
- Conversation Policy;
- Clarification Graph;
- interpretación multi-persona;
- consumo/ranking de recursos;
- UX conversacional;
- Tester Capture;
- Feedback Analyst;
- regressions conversacionales.

Este workstream NO debe modificar adquisición/Master salvo lectura del
contrato o coordinación explícita.

## Estado del catálogo al separar workstreams

En el último estado auditado:

Master V3:

- 469 registros gestionados;
- 270 ready/runtime_enabled;
- 197 needs_enrichment;
- 1 needs_review;
- 1 duplicate.

PostgreSQL:

- 270 active=true;
- 1 active=false.

Existe paridad exacta entre `runtime_enabled=true` y `active=true`.

El registro inactivo es:

    association_id 216
    duplicate_of 198

y debe conservarse como histórico/inactivo.

La ampliación del catálogo y sus fuentes deja de ser responsabilidad
de este workstream.

## Feedback / defectos conocidos

### Cerrados

#### Territorio Gipuzkoa → Coruña, A

Se corrigió un falso positivo territorial.

Commit:

    0175b6a
    fix(helpchat): reject trivial province aliases

#### Auto-location detrás de Docker/proxy

Fix:

    30522a4
    fix(helpchat): restore autolocation behind Docker proxy

Se validó el endpoint devolviendo territorio grueso de Gipuzkoa/Irun.
Debe repetirse un smoke final tras el próximo despliegue completo.

#### Diagnosis status repetido

Fix:

    9101fda
    fix(helpchat): advance after unresolved diagnosis status

### Feedback #12 — mental_behavior_detail

Estado:

    CODE / REGRESSION: CLOSED
    WORKING-TREE HTTP E2E: PASS
    DEPLOYMENT DOCKER: PENDING REBUILD + SMOKE

El flujo se ha corregido para que la elección:

    behavior_changes

establezca primero una necesidad base amplia:

    SALUD MENTAL

y después abra:

    mental_behavior_detail

como refinamiento adicional.

Esto permite que una respuesta insuficiente como:

    "no sé"

no invente información clínica, pero tampoco bloquee ni repita la
aclaración si la necesidad base ya estaba establecida.

Invariantes validados:

- detalle material → avanza;
- `"no sé"` + necesidad base existente → conserva SALUD MENTAL y avanza;
- `"no sé"` sin necesidad base → no inventa SALUD MENTAL;
- no se llama a embeddings ni Qwen para el fallback opcional;
- `pendingClarification` queda limpio tras avanzar.

Validación dirigida:

- node:test: 55/55 PASS;
- Vitest Conversation V2: 40/40 PASS;
- HTTP E2E sobre working tree: PASS.

Último smoke observado para `"no sé"`:

    provider = conversation_policy
    model = conversation-policy-v1
    classificationMs = 5.7
    searchMs = 85.4
    totalMs backend = 329

El warm-up de Qwen ocurrió en background y no bloqueó este flujo.

Pendiente únicamente:

1. reconstruir el contenedor backend;
2. repetir smoke sobre runtime desplegado;
3. verificar que no reaparece `mental_behavior_detail`.

### Abierto/bloqueado: Feedback #13 — persona mayor y soledad

Reporte conceptual:

    "Tengo setenta años y me siento sola"

Se ha identificado la necesidad de comprender:

- edad aproximada;
- soledad/aislamiento;
- compañía/socialización;
- recursos comunitarios/sociales.

NO debe enviarse automáticamente a salud mental.

La resolución E2E queda temporalmente bloqueada por la ampliación del
catálogo de asociaciones del DATA WORKSTREAM.

Puede avanzarse la comprensión semántica sin acoplarla a la cobertura
incompleta actual, pero no debe cerrarse el defecto E2E hasta probar
contra el nuevo catálogo.

## Conversation Policy V1 — deuda prioritaria

Actualmente varias decisiones están repartidas entre:

- router;
- fast gates;
- graph;
- casos especiales.

Conversation Policy V1 debe convertirse en la autoridad de flujo para
decidir:

- qué información falta;
- si merece preguntar;
- qué dimensión ya está resuelta;
- cuándo cerrar una aclaración;
- cuándo buscar;
- cuándo responder;
- qué hacer con respuestas insuficientes a información opcional.

No debe redactar el mensaje final; gobierna la decisión.

## Multi-person — regressions obligatorias futuras

Deben existir E2E permanentes para escenarios como:

    "Mi hermano bebe mucho y mi madre está agotada cuidándolo."

y:

    "Mi hija tiene ansiedad, pero yo necesito ayuda para encontrar trabajo."

y:

    "Mi hermano vive en Gipuzkoa y mi suegra en Bizkaia."

También:

- dos necesidades simultáneas;
- cambio explícito de foco;
- corrección de información anterior;
- respuesta "no sé";
- texto libre equivalente a una quick reply;
- cambio territorial explícito.

## Tester Capture / Feedback Analyst

Regla de producto:

Feedback Analyst es exclusivamente infraestructura interna de
developer/QA.

Nunca debe aparecer en:

- UI pública;
- Tester UI.

Tester únicamente reporta el problema y recibe una confirmación simple,
por ejemplo:

    "Gracias. He guardado el problema para revisarlo."

No mostrar al tester:

- confidence;
- categorías internas;
- análisis;
- modelo;
- componentes sospechosos;
- propuesta de regresión.

La futura consola de análisis será una UI interna separada.

### Invariante de regresión

Todo defecto reproducible y confirmado mediante Tester Capture debe
terminar en un test que:

- falle antes del fix;
- pase después del fix;

salvo que no sea razonablemente automatizable.

El analista nunca modifica código automáticamente.

## Observabilidad pendiente

Tester Capture debería conservar procedencia territorial equivalente a:

    locationRuntime: {
      detectionStatus:
        "detected|unavailable|failed|pending",
      detectedProvince: "...",
      selectionSource:
        "auto|manual|conversation|null"
    }

Es información interna, no UI pública.

## UX

Copy pública preferida:

    "Estoy revisando qué puede ayudarte…"

    "Recursos que pueden orientarte"

    "¿Quieres que afinemos un poco más?"

    "Cuéntanos qué está pasando con tus propias palabras."

Los botones representan transiciones canónicas útiles.

El usuario puede escribir libremente una respuesta equivalente a un botón.

Voz, cuando se implemente/complemente:

    micrófono
      → listening
      → transcription
      → review/edit
      → normal send

No auto-send.

No TTS automático.

Mantener:

- teclado;
- focus;
- contraste;
- reduced motion;
- zoom/accesibilidad.

## Knowledge Base sanitaria — propuesta futura

No es diagnóstico.

Modelo conceptual:

    conversation
        ↓
      people
        ↓
observations/symptoms
        ↓
 knowledge relations
        ↓
  support needs
        ↓
  resource types
        ↓
  organizations

Entidades separadas:

- conditions;
- symptoms/signs/observations;
- support needs;
- resource types/services;
- organizations.

Fuentes candidatas estudiadas:

- MedlinePlus;
- ICD-11;
- CIE-10-ES;
- GuíaSalud;
- HPO;
- Orphanet.

Toda relación debe preservar:

- provenance;
- versión de fuente;
- tipo de relación;
- evidencia;
- contradicciones;
- fecha de revisión.

Nunca inferir diagnóstico desde síntomas.

Este hito NO precede a la estabilización de Conversation Policy V1.

## Seguridad / infraestructura pendiente

Auditar posteriormente:

- contexto de build Docker;
- `.dockerignore`;
- riesgo de copiar `backend/.env` mediante `COPY backend/ ./backend/`;
- rotación de GEMINI key si la expuesta previamente seguía activa;
- exposición de Ollama en `0.0.0.0`.

No mezclar esta auditoría con fixes conversacionales salvo urgencia.

Nunca:

    docker compose down -v

ni eliminar el volumen PostgreSQL.

## Disciplina Git

Raíz:

    /mnt/ai-storage/projects/copilot-ong

Rama de integración:

    copilot-ong/integration

Antes de editar:

    git status --short
    git branch --show-current
    git log -5 --oneline --decorate

El worktree contiene cambios de otros workstreams.

No asumir propiedad de modificaciones ajenas.

Staging siempre explícito por archivo.

Nunca usar:

    git add .
    git add -A
    git restore .
    git reset --hard

Validar siempre, según alcance:

    git diff --check
    tests dirigidos
    lint cuando corresponda
    frontend build cuando corresponda

## Baseline de commits relevante

    a51e86b fix(helpchat): advance safely after behavior detail
    e71e871 refactor(helpchat): soften resource search feedback
    30522a4 fix(helpchat): restore autolocation behind Docker proxy
    9101fda fix(helpchat): advance after unresolved diagnosis status
    81b60d0 feat(helpchat): track pending clarification dimensions
    6aa84d8 feat(helpchat): interpret diagnosis status answers
    34fb0c3 feat(helpchat): persist resolved clarification dimensions
    841fa8a feat(helpchat): add per-person resolved dimensions
    0175b6a fix(helpchat): reject trivial province aliases

Estos commits son puntos históricos conocidos; el HEAD real debe
comprobarse siempre con Git antes de trabajar.

## Próximo paso exacto

No trabajar todavía el E2E de soledad/personas mayores mientras el
DATA WORKSTREAM amplía el catálogo.

Próximo trabajo:

1. reproducir Feedback #12 en runtime real;
2. probar respuesta concreta con descripción de cambios de conducta;
3. probar `"no sé"`;
4. demostrar no-repeat + progress;
5. añadir/corregir regression si es necesario;
6. validar latencia;
7. desplegar/smoke;
8. después generalizar No-repeat/Progress en Conversation Policy V1.

## Handoff

Otra conversación puede continuar desde este documento siempre que:

1. compruebe primero Git/working tree;
2. trate Git, tests, runtime y DB como fuente de verdad;
3. no reabra decisiones arquitectónicas aquí fijadas sin evidencia;
4. no toque el DATA WORKSTREAM salvo coordinación explícita.
