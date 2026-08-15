# ADR — Multi-person Context V2

Estado: Accepted
Fecha: 2026-08-15

## Contexto

Las conversaciones reales pueden hablar simultáneamente de varias
personas:

    "Mi hermano bebe mucho y mi madre está agotada cuidándolo."

    "Mi hija tiene ansiedad, pero yo necesito ayuda para encontrar trabajo."

Un contexto global simple mezcla necesidades, condiciones y recursos.

## Decisión

Conversation State V2 representa explícitamente personas y foco.

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

La información debe quedar asociada a la persona correcta.

## Diagnosis status

Por persona se distingue:

- confirmed
- not_confirmed
- uncertain

Ejemplos:

    "Mi hermano tiene Parkinson"
    → condición declarada.

    "Creemos que puede tener Parkinson"
    → uncertain.

    "Tiembla y le cuesta moverse"
    → observaciones, no diagnóstico.

## Resolved dimensions

Las aclaraciones resueltas se registran por persona cuando corresponda.

Esto permite cumplir No-repeat sin contaminar el contexto de otras
personas.

## Territorio

Estado actual: el territorio sigue siendo demasiado global.

Evolución requerida:

soportar territorio por persona o una representación equivalente.

Caso obligatorio:

    "Mi hermano vive en Gipuzkoa y mi suegra en Bizkaia."

Los recursos no deben mezclarse entre territorios/personas.

## Foco

`currentFocus` indica sobre quién o qué necesidad se está trabajando
principalmente.

Cambiar de foco no debe destruir la información anterior.

El usuario puede volver a una persona/necesidad previa.

## Relación con Clarification Graph

Un nodo pendiente debe saber, cuando aplique:

- personId;
- dimensión;
- nodo;
- contexto de aclaración.

Una respuesta libre se interpreta dentro de ese contexto.

## Regresiones obligatorias

Como mínimo:

1. hermano con consumo + madre cuidadora;
2. hija con ansiedad + usuario buscando empleo;
3. hermano Gipuzkoa + suegra Bizkaia;
4. cambio explícito de foco;
5. corrección de información previa;
6. dos necesidades simultáneas.

## Consecuencia

HelpChat debe razonar sobre una conversación, no sobre una única
"ficha de usuario".

El objetivo no es construir un modelo familiar exhaustivo, sino
mantener suficiente identidad contextual para orientar correctamente.
