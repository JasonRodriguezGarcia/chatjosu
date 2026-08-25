# Tech Stack

## Backend

- Node >= 18 < 23, ESM (`"type": "module"`), plain JS (no TypeScript, no ORM).
- Express 5 + cors + dotenv; `pg` for PostgreSQL; `exceljs` for data imports.
- Tests: vitest (run via `npm run test:vitest` in backend/, explicit file list).
- Formatting: prettier.
- Env contract in `backend/.env.example`: `GEMINI_API_KEY`/`GEMINI_MODEL`
  (model name is regex-validated at startup), `SCHEMA_NAME`, `DATABASE_DETAILS`
  (JSON blob), `ALLOWED_ORIGINS`, hardening knobs (`HELPCHAT_JSON_LIMIT`,
  `HELPCHAT_AI_TIMEOUT_MS`, `HELPCHAT_RATE_LIMIT_*`), privacy
  (`HELPCHAT_STORE_INPUT_MESSAGE=false` default: do not persist literal queries).

## Frontend

- Vite 8 + React 19, JSX (no TS), MUI 9 + Emotion, react-router-dom 7,
  react-markdown, `@google/genai` client dep.
- Tests: vitest + Testing Library + jsdom; lint: ESLint 9 flat config; prettier
  (root `.prettierrc` / `.prettierignore` shared, `--ignore-path ../.prettierignore`).
- `npm run check` = lint + test + build.

## Data / AI

- PostgreSQL (dev env: generic `postgres` image via `db/docker-compose.yml`,
  port 5432, pgAdmin on 5050; helpchat compose expects external network
  `local_default`).
- Local-first AI pipeline: rules/fast gates → embeddings → local LLM fallback
  (Ollama, e.g. Qwen; `HELPCHAT_EMBEDDING_BASE_URL`, default
  `http://host.docker.internal:11434` in compose).
- Google Gemini via REST (`generativelanguage.googleapis.com/v1beta/...`)
  for classification tasks (`GEMINI_MODEL`, e.g. gemini flash).
- Location: IP geolocation (Cloudflare `CF-Connecting-IP` aware,
  `HELPCHAT_TRUST_CLOUDFLARE`) → Spanish province resolver; province catalog
  + neighbors served from Postgres.

## Infra

- `compose.helpchat.yml`: builds `docker/app/Dockerfile` → image
  `copilot-ong-helpchat:dev`; services: backend (port 5000 in container,
  host `127.0.0.1:5174` by default, `SERVE_FRONTEND=true`) and
  feedback-analyst worker (`node scripts/run-helpchat-feedback-analysis-worker.js`,
  starts after backend is healthy). Healthcheck: GET
  `/api/v1/helpchat/provincias`.
- Frontend dev server default origin: `http://localhost:5173`.
