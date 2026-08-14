# HelpChat / Entre Amigas · Hoja de ruta

Última actualización: 2026-08-14

## 1. Objetivo

HelpChat es un sistema conversacional de orientación que ayuda a una persona a expresar de forma natural una situación propia o de sus allegados y encontrar recursos adecuados.

La aplicación no diagnostica ni sustituye a profesionales.

Nombre público actual:

- Entre Amigas · Te orienta
- Una iniciativa de Entre Amigas Anda la Cosa

Principios:

- conversación natural;
- mínima fricción;
- no diagnosticar;
- mantener correctamente quién es la persona de la que se habla;
- aclarar sólo cuando cambie materialmente la orientación;
- IA local-first;
- baja latencia;
- decisiones canónicas gobernadas por código/grafo, no libremente por el LLM;
- privacidad y minimización de datos.

## 2. Estado general

Leyenda:

- ✅ Hecho
- 🟡 En curso
- ⬜ Pendiente
- ⚠ Deuda técnica
- 🅿 Aparcado

## 3. Conversación y memoria

### ✅ Context V2 relacional

Existe un modelo conversacional capaz de representar:

- usuario;
- varios familiares/allegados;
- relación;
- necesidades por persona;
- hechos y restricciones;
- foco conversacional;
- territorio;
- aclaración pendiente.

Se evita aplanar conversaciones multi-persona a un único sujeto.

### ✅ Resolución de sujeto

Implementada resolución de persona/foco y protección frente a asignaciones ambiguas.

Invariante principal:

> Una única decisión de resolución de sujeto por turno.

### ✅ Clarification Graph V1

Existe un grafo canónico para:

- tipo principal de necesidad;
- salud;
- salud emocional;
- cambios de conducta;
- adicciones;
- texto libre.

Los botones representan transiciones canónicas y no palabras arbitrarias.

### ✅ Reentrada desde ramas incompatibles

Una respuesta informativa incompatible con la rama actual puede reentrar al grafo en vez de repetir indefinidamente la misma pregunta.

Caso de regresión:

- adicción conductual;
- "tiene cambios bruscos de humor y temperamento";
- reentrada a salud emocional.

### ✅ Barrera síntomas ≠ diagnóstico

Los síntomas o comportamientos no pueden adquirir automáticamente autoridad diagnóstica.

Ejemplo protegido:

- "no puede dormir y bebe mucho";
- no puede resolver automáticamente DIABETES;
- no puede resolver automáticamente ALCOHOLISMO.

Las condiciones explícitamente declaradas sí pueden continuar al clasificador acotado.

## 4. IA local-first

### ✅ Embeddings locales

Modelo principal:

- nomic-embed-text.

Uso:

- shortlist semántico;
- clasificación acotada;
- mínima información enviada a modelos mayores.

### ✅ LLM local

Modelo actual:

- Qwen3 8B mediante Ollama.

Flujo:

1. reglas/anchors;
2. embeddings;
3. resolución directa si hay alta confianza;
4. Qwen sólo para ambigüedad acotada;
5. aclaración si sigue ambiguo;
6. proveedor remoto sólo como fallback técnico o caso explícitamente complejo.

### ✅ Lifecycle de modelos

- Nomic permanece caliente.
- Qwen se precalienta en segundo plano al comenzar conversación real.
- `/api/ready` informa del estado real de residencia.

### ⚠ Pendiente

- watchdog de residencia prolongada;
- métricas p50/p95 completas por escalón;
- defensa canónica adicional en límites del router;
- evaluar modelos locales más pequeños sólo si la latencia lo justifica.

## 5. Latencia

Objetivos UX:

- feedback inmediato <100 ms;
- respuesta útil habitual <2 s;
- p95 <4 s.

### ✅ Principios aplicados

- local-first;
- contexto mínimo;
- embeddings antes de LLM;
- Qwen en background;
- captura de tester fuera del camino crítico.

### 🟡 Feedback Analyst automático

Objetivo:

- analizar automáticamente cada feedback de tester fuera del camino crítico;
- reconstruir la conversación hasta `snapshotThroughTurnId`;
- clasificar el fallo y estimar severidad/confianza;
- identificar invariantes probablemente violadas;
- proponer módulos afectados y solución;
- generar candidatos de regresión;
- permitir generación posterior de patch candidato;
- no aplicar cambios ni promover expectativas automáticamente.

Estrategia de modelos:

- LLM local para triage y casos claros;
- LLM remoto potente para análisis ambiguo, arquitectónico o de código complejo;
- contexto mínimo y pseudonimizado;
- análisis siempre asíncrono.

Estados previstos:

`pending -> analyzing -> analyzed -> reviewed -> promoted|dismissed`

### ⬜ Pendiente

- benchmark sistemático p50/p95;
- métricas por proveedor/modelo/escalón;
- contextChars/inputChars/candidateCount;
- alertas de regresión de rendimiento.

## 6. Catálogo de asociaciones y recursos

### 🟡 En curso

Existe trabajo paralelo de:

- adquisición;
- normalización;
- deduplicación;
- enriquecimiento;
- validación;
- catálogo territorial;
- asociación entre recursos y tags.

### ⚠ Deuda técnica

Separar claramente:

- necesidad/dominio del usuario;
- tag operacional;
- tipo/rol del recurso.

Algunos tags históricos representan entidades o proveedores y no deberían convertirse directamente en botones o necesidades públicas.

## 7. Tester Capture / Regression Pipeline

### ✅ Contrato Feedback V1

Una incidencia pertenece a una conversación completa y puede señalar cero, uno o varios turnos concretos.

Contiene:

- conversación;
- snapshot hasta el turno donde se reporta;
- turnos relevantes opcionales;
- motivo;
- qué esperaba el tester;
- categoría;
- origen texto/voz;
- estado de revisión.

### ✅ Session / Turn V1

Cada conversación de tester tiene:

- sessionId;
- buildRevision;
- environment;
- secuencia ordenada de turnos.

Cada turno conserva:

- input;
- respuesta;
- controlledReply;
- Context antes/después;
- metadata runtime.

### ✅ Esquema PostgreSQL definido

Tablas:

- helpchat_test_sessions;
- helpchat_test_turns;
- helpchat_test_feedback.

La FK compuesta garantiza que el snapshot señalado pertenece a la misma conversación.

### ✅ Repository V1

Incluye:

- createSession;
- appendTurn;
- createFeedback;
- idempotencia;
- detección de conflictos;
- validación de anchors.

### ✅ Persistencia operativa

- backup PostgreSQL previo validado;
- esquema 007 aplicado;
- constraints verificadas;
- repository probado contra PostgreSQL real.

### ✅ API Tester Capture V1

Endpoints operativos:

- `POST /api/v1/helpchat/tester/sessions`;
- `POST /api/v1/helpchat/tester/turns`;
- `POST /api/v1/helpchat/tester/feedback`.

Verificado:

- persistencia real;
- retry idempotente;
- conflicto de `turnId`;
- validación de feedback;
- PostgreSQL real.

### ✅ Frontend Tester Capture V1

Implementado:

- activación explícita mediante `?tester=1`;
- `sessionId` independiente de los mensajes UI;
- `turnId` independiente por intercambio conversacional;
- secuencia estable;
- snapshot de Context V2 antes/después;
- metadata runtime reducida;
- persistencia asíncrona fuera del camino crítico;
- retry limitado de captura;
- mismo `turnId` al reintentar `/iacall`;
- preservación del turno durante solicitud de provincia.

Verificado:

- la respuesta visible no espera a PostgreSQL;
- FIFO y contexto conversacional siguen funcionando;
- retry conserva identidad;
- frontend build y lint correctos.

### 🟡 En curso

- interfaz visible para reportar problemas de conversación.

### ⬜ Pendiente

- sessionId/turnId frontend;
- persistencia asíncrona/no bloqueante;
- modo tester;
- botón global "He encontrado un problema";
- explicación por texto;
- explicación por voz;
- campo "Qué esperabas que ocurriera";
- selección opcional de turnos;
- bandeja de revisión;
- promoción a fixture;
- replay automático;
- integración CI.

Principio:

> El tester aporta el caso y su razonamiento. La respuesta actual del sistema nunca se convierte automáticamente en el expected de un test.

## 8. Regresiones reales conocidas

### ✅ Loop de adicción conductual

Corregido.

### ✅ Síntomas ambiguos inferidos como diabetes

Corregido mediante autoridad sanitaria del enunciado.

### ⬜ Salud sin diagnóstico

Evitar que una aclaración segura genere una nueva pregunta repetitiva.

### ⬜ Revisión semántica completa del grafo

Auditar:

- utilidad real de cada botón;
- ramas redundantes;
- preguntas que no modifican recursos;
- áreas del catálogo todavía no guiadas.

## 9. Frontend / UX

### ✅ Estado actual

- conversación continua;
- quick replies canónicos;
- sólo la aclaración activa mantiene botones;
- recursos mediante cards;
- provincia;
- reconocimiento de voz;
- edición de transcripción antes de enviar;
- accesibilidad básica;
- reduced motion;
- estados de carga/error.

### ⬜ Pendiente

- modo tester;
- feedback global de conversación;
- voz reutilizada para feedback;
- selección de momentos relevantes;
- accesibilidad completa del nuevo feedback;
- más pruebas E2E de navegación por teclado.

## 10. Privacidad y datos

Principios:

- minimización;
- pseudonimización;
- evitar identidad real innecesaria;
- tester informado de la captura;
- no guardar audio bruto si la transcripción revisada es suficiente;
- separar datos operacionales de fixtures permanentes.

### ⬜ Pendiente

- política de retención;
- borrado de sesiones;
- anonimización/promoción de fixtures;
- controles administrativos.

## 11. Deuda técnica

### ⚠ Working tree reconciliation

Existen cambios y artefactos históricos/paralelos que deben revisarse individualmente antes de integrarse.

No usar commits masivos indiscriminados.

### ⚠ Tags y dominio

Necesidad del usuario y tag operacional siguen demasiado acoplados en algunos puntos.

### ⚠ Fallback remoto

Revisar y endurecer las condiciones exactas en las que Gemini u otros proveedores externos pueden intervenir.

### ⚠ Conversaciones complejas

Seguir ampliando pruebas:

- varias personas;
- relaciones duplicadas;
- pronombres ambiguos;
- cambios de foco;
- varias necesidades simultáneas;
- correcciones posteriores;
- conversaciones largas.

## 12. Infraestructura actual

Actualmente:

- PostgreSQL en contenedor;
- backend mediante systemd de usuario;
- frontend Vite;
- Ollama local;
- túnel/entrada pública independiente.

## 13. Objetivo de contenerización

Objetivo final:

- despliegue reproducible;
- mínimo trabajo manual;
- instalación sencilla en servidores finales;
- rollback y backup verificables.

Arquitectura objetivo aproximada:

- reverse proxy;
- frontend container;
- backend container;
- PostgreSQL container;
- Redis si continúa siendo necesario;
- Ollama/GPU como servicio local integrado;
- volúmenes persistentes;
- backups;
- healthchecks;
- configuración mediante environment/secrets.

### Orden previsto

1. estabilizar contratos y comportamiento;
2. ampliar regresiones;
3. limpiar configuración/env;
4. readiness/health completos;
5. Dockerfile backend;
6. Dockerfile frontend;
7. Compose integral;
8. volúmenes y backups;
9. restore probado;
10. staging;
11. despliegue final.

No containerizar prematuramente una arquitectura todavía en movimiento.

## 14. Próximos hitos

1. Validar backup PostgreSQL.
2. Aplicar migración Tester Capture 007.
3. Probar repository contra PostgreSQL real.
4. Crear endpoints Tester Capture.
5. Integrar session/turn IDs en frontend.
6. Captura asíncrona de conversaciones de testers.
7. Añadir feedback global por texto/voz.
8. Crear promoción a regresión/replay.
9. Retomar auditoría semántica del grafo.
10. Benchmark p50/p95 y adversarial loops.
11. Reconciliar working tree.
12. Diseñar contenerización integral.

## 15. Definition of Done del sistema

El sistema se considerará preparado para despliegue estable cuando:

- las conversaciones multi-persona sean robustas;
- no se infieran diagnósticos desde síntomas;
- no existan loops conocidos de aclaración;
- el catálogo esté normalizado;
- existan regresiones reales provenientes de testers;
- latencia cumpla objetivos;
- privacidad/retención estén definidas;
- backup y restore estén probados;
- frontend/backend sean reproducibles;
- el despliegue final pueda realizarse mediante contenedores y configuración documentada.

## 16. Coordinación del repositorio

A partir de esta fase el repositorio completo se considera bajo una única coordinación técnica.

Principios:

- no existen ya zonas reservadas permanentemente a conversaciones separadas;
- cualquier cambio existente puede ser auditado e integrado;
- los commits siguen siendo temáticos y de alcance explícito;
- no usar `git add .` ni staging masivo;
- antes de integrar cambios antiguos/paralelos se revisan intención, tests y compatibilidad;
- la documentación del repositorio debe ser la fuente canónica del estado del proyecto, no el historial de chats.

## 17. Hitos recientes

- `12e5fa8` — tester capture repository.
- `66ee194` — tester capture persistence schema.
- `ca250ab` — tester session/turn contract.
- `df1d56d` — tester conversation feedback contract.
- `106a5b0` — barrera contra diagnóstico inferido desde síntomas.
- `b5b913c` — reentrada del grafo desde respuestas incompatibles.
- `f490cd4` — sólo la aclaración activa muestra botones.
- `6a7da40` — evita contaminación por cláusulas genéricas multi-need.

Este listado es orientativo; Git sigue siendo la fuente de verdad para el historial exacto.
