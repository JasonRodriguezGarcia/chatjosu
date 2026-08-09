# HelpChat Conversation Context V1

## Purpose

HelpChat maintains a compact semantic working context so follow-up messages can be understood without resending the complete raw conversation.

The contract is provider-agnostic. Gemini, local models, and future providers consume and produce the same structure.

The context is temporary conversational working state, not a permanent user profile.

## Request

A HelpChat request may contain:

```json
{
  "inputMessage": "Además vive sola",
  "selectedProvincia": "Burgos",
  "conversationContext": null
}
```

The first turn uses null when no previous completed turn has produced context.

## Context V1

```json
{
  "version": 1,
  "subject": {
    "relationship": null
  },
  "activeNeeds": [],
  "currentGoal": null,
  "facts": [],
  "constraints": [],
  "territory": {
    "province": null,
    "municipality": null
  },
  "resourcesShown": []
}
```

## Field semantics

- version: contract version. V1 uses 1.
- subject.relationship: relationship with the person needing help when relevant.
- activeNeeds: compact semantic needs required to understand later turns.
- currentGoal: latest practical objective when relevant.
- facts: short facts required for subsequent interpretation.
- constraints: practical restrictions affecting suitable resources.
- territory.province: relevant province for the person or search.
- territory.municipality: relevant municipality when known.
- resourcesShown: IDs of resources already presented, never complete resource objects.

activeNeeds are semantic conversation state and do not have to equal database tags.

## Rules

- Keep the context compact.
- Do not include complete user messages.
- Do not include complete assistant responses.
- Do not include chain-of-thought or internal reasoning.
- Do not include provider-specific state.
- Do not include prompts or token data.
- Correct previous information instead of accumulating contradictions.
- Deduplicate repeated facts.
- Unknown values remain null or empty arrays.
- Keep resourcesShown as resource IDs only.
- Prefer updating context in the same model inference used to interpret the current turn.
- Do not add a second sequential LLM call only to summarize context unless measurements justify it.

## Provider boundary

Conceptually every provider implements:

```text
inputMessage + previousContext + availableTags
->
tag + updatedContext
```

Provider, model, latency, token counts, and routing information remain runtime metadata outside the conversational context.

## Causal processing

Queued messages use the context produced by the most recently completed previous turn.

```text
A + context0 -> contextA
B + contextA -> contextB
C + contextB -> contextC
```

The context is read when a queued message begins processing, not when it is initially queued.
