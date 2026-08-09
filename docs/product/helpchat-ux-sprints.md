## HelpChat UX Sprints

### UX-1: Responsive Conversation

Goal: establish the conversational foundation and public identity.

#### UX1-A — Conversation Shell

Completed.

Full-viewport application shell.

Compact header.

Scrollable conversation.

Persistent composer.

Responsive base layout.

Legacy Dialog removed.

#### UX1-B — Conversational Lifecycle

Completed.

Role-based user and assistant messages.

Immediate user-message rendering.

Inline loading.

Recoverable inline errors.

Retry without duplicating the user message.

Double-submit prevention.

Enter sends.

Shift+Enter creates a new line.

Global loading overlay removed.

Legacy RESPUESTA prefix removed.

#### UX1-C — Identity, Responsive Polish and Accessibility

Current sprint.

Adopt the public identity:

Entre Amigas · Te orienta

With attribution:

Una iniciativa de Entre Amigas Anda la Cosa

Introduce a warm visual system derived from the existing Entre Amigas identity.

Replace the predominantly white/default-MUI appearance with a warm neutral background and restrained brand accents.

Make location contextual rather than form-dominant.

Improve the initial conversational state.

Refine message bubbles.

Refine suggestion actions.

Refine the composer.

Validate the layout from approximately 360px mobile through tablet and desktop.

Preserve accessible labels, focus behaviour, semantic buttons, and inline status announcements.

UX1-C must not change the lifecycle implemented in UX1-B.

### UX-2: Structured Resource Cards

Render backend associations[] as structured, verifiable resources.

Public-facing language should favour:

Recursos que pueden orientarte

rather than technical search-result terminology.

### UX-3: Multiple Needs and Refinement

Allow one conversation to express and refine several needs without forcing a restart.

### UX-4: Voice / Transcription / Review

Tap microphone.

Listen.

Transcribe.

Allow user review and editing.

Submit through the same text conversation flow.

Do not auto-send a transcription.

### UX-5: Desktop Enrichment

Enrich desktop with conversation plus a resource-oriented workspace while preserving the simpler mobile conversation experience.
