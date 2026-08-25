# Architecture Overview — HelpChat

## Canonical conversation pipeline (per user message)

    input
      → Understanding Router
      → facts
      → Conversation State V2
      → Conversation Policy V1
      → ask | search | respond
      → Resource Ranker
      → LLM renderer

- Clarification Graph V1 is intentionally small: only for discrete/closed decisions
  that need legal options. No exhaustive Graph V2 will be built.

## Local-first AI strategy (order matters, keep it)

1. Deterministic rules / fast gates (cheap, no AI).
2. Embeddings / semantic classification.
3. LLM (local, e.g. Qwen) only when ambiguous.
- Context interpretation + need classification should happen in ONE AI-provider
  request. Do not add a sequential summarization call without measurements proving
  it is needed.

## Backend (backend/)

- `index.js` — single entry: Express app, all HTTP routes, wiring of services into
  `app.locals`. Key routes: `POST /api/v1/helpchat/iacall` (main chat),
  `GET /api/v1/helpchat/provincias`, `GET /api/v1/helpchat/location`,
  `POST /api/v1/helpchat/tester/{sessions,turns,feedback}`, `/api/health`,
  `/api/ready`.
- `helpchat/` — pure logic modules, version-suffixed filenames (`*-v1.js`,
  `*-v2.js`): conversation-context v1/v2, conversation-runtime-v2, clarification
  (policy/graph/text-resolver/open-clarification), multi-need, territory-contract,
  no-repeat, recovery, progress, resource-response, controlled-replies, semantic
  fast gates, tester capture + feedback analysis.
- `services/` — adapters/IO: Gemini (`helpchat-gemini-service.js`), local LLM
  (Ollama), embeddings, semantic classifier, understanding router, location/IP
  providers, association service, clarification renderer, feedback-analyst LLM,
  Excel import.
- `db-pg.js` — pg pool; schema selected via env `SCHEMA_NAME` (default `copilot_ong`).
- `scripts/` — data build + ops: Euskadi/Navarra semantic envelopes, association
  import, e2e/smoke runtime, feedback-analysis worker.
- `tests/` — vitest suites for helpchat conversation modules.
- Split invariant: `helpchat/` = logic (no IO); `services/` = adapters/IO.

## Frontend (frontend/src/)

- `App.jsx` + `components/` — React UI: `HelpChat.jsx` (chat),
  `HelpChatComposer.jsx`, `AssociationCard.jsx` (structured resource card),
  `TesterFeedbackComposer.jsx`, `helpChatBrand.js`.
- `helpchat/` — client logic: `conversationContext.js`, location
  (`provinceGeoResolver.js`, `browserProvinceLocation.js`, `mapLocation.js`,
  `location.js`), `speechRecognition.js` + `useHelpChatSpeech.js` (voice →
  transcription → edit → text), `testerCapture.js`.
- Resources must render as structured components (AssociationCard), never as
  AI-generated Markdown.
- Voice and text are (will be) equivalent inputs.

## Data & infra

- Postgres holds the verifiable product data: normalized associations, Spanish
  territorial catalog (provinces + neighbors), tester capture, feedback analysis.
- Docker: `compose.helpchat.yml` runs backend + a separate feedback-analyst worker
  container (same image), attached to an external Postgres network.
- Backend can serve the frontend build when `SERVE_FRONTEND=true`.
