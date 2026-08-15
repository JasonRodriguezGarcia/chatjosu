# ADR — Conversation Policy V1

Estado: Accepted
Fecha: 2026-08-15

## Contexto

HelpChat dispone de reglas, fast gates, embeddings, LLM, Conversation
State y Clarification Graph.

Históricamente algunas decisiones de flujo han quedado distribuidas
entre varias capas. Eso facilita:

- repetición de preguntas;
- reentrada en el mismo nodo;
- aclaraciones innecesarias;
- casos especiales difíciles de mantener;
- aumento innecesario de latencia/contexto.

## Decisión

Introducir Conversation Policy V1 como autoridad determinista de flujo.

Flujo:

    Understanding
        ↓
      facts
        ↓
Conversation State V2
        ↓
Conversation Policy V1
        ↓
  ask | search | respond

Conversation Policy decide intención operativa, no la redacción final.

## Responsabilidades

Debe determinar:

- si falta información;
- si esa información es material;
- si una dimensión ya está resuelta;
- si una aclaración es obligatoria u opcional;
- cuándo abandonar una aclaración;
- cuándo buscar recursos;
- cuándo responder;
- cuándo un fallback es preferible a repetir.

## Invariantes

### No-repeat

Una dimensión resuelta no se vuelve a preguntar salvo corrección,
contradicción material o nueva evidencia.

### Progress

Cada turno de aclaración debe producir progreso observable.

Si no existe progreso:

    safe fallback / close clarification

nunca repetición infinita.

### Materiality

Sólo preguntar si la respuesta puede modificar materialmente búsqueda,
ranking, seguridad o interpretación necesaria.

## Relación con Clarification Graph

Clarification Graph V1 define decisiones cerradas y transiciones legales.

Conversation Policy decide si debe utilizarse el grafo y si procede
continuar preguntando.

El grafo no es la autoridad global del flujo.

## Relación con LLM

El LLM puede:

- interpretar lenguaje ambiguo;
- seleccionar entre transiciones autorizadas;
- redactar de forma natural.

El LLM no puede:

- inventar transiciones;
- inventar categorías;
- decidir por sí solo que debe seguir preguntando;
- autorizar recursos fuera del catálogo.

## Consecuencias

Ventajas:

- comportamiento más predecible;
- menos loops;
- menor contexto LLM;
- mejor testabilidad;
- menor latencia potencial;
- separación entre decisión y redacción.

Coste:

- habrá que mover gradualmente casos especiales existentes hacia Policy;
- no se hará una reescritura big-bang.

## Estrategia de migración

1. cerrar defectos reproducibles actuales;
2. expresar sus reglas como invariantes;
3. introducir Policy incrementalmente;
4. mantener regresiones existentes;
5. retirar casos especiales sólo cuando exista cobertura equivalente.

Primer caso de referencia:

    mental_behavior_detail + "no sé"

Una aclaración opcional no debe bloquear ni repetirse indefinidamente.
