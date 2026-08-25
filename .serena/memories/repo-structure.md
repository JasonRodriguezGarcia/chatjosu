# Repository Structure

```
copilot-ong/
├── AGENTS.md             # agent operating rules: OpenSpec workflow, scope, verification
├── compose.helpchat.yml  # dev compose: backend + feedback-analyst worker
├── backend/              # Node ESM Express API (see mem:tech-stack for versions)
│   ├── index.js          # single entry: app, routes, wiring
│   ├── db-pg.js          # pg pool (env SCHEMA_NAME)
│   ├── helpchat/         # conversation logic modules (*-v1.js / *-v2.js), no IO
│   ├── services/         # IO adapters: LLMs, embeddings, location, associations
│   ├── scripts/          # data-build, smoke, e2e, feedback worker
│   ├── tests/            # vitest
│   ├── data/             # normalized associations JSON
│   └── .env.example      # env contract (Gemini, Postgres, rate limits, privacy)
├── frontend/             # Vite + React SPA (JSX, no TS)
│   └── src/
│       ├── App.jsx, main.jsx, index.css
│       ├── components/   # HelpChat, HelpChatComposer, AssociationCard, TesterFeedbackComposer
│       ├── helpchat/     # hooks/utils: context, location, speech, tester capture
│       └── test/
├── db/                   # local Postgres+pgAdmin dev env (docker-compose) + SQL init/seed
│   └── local/init/       # numbered SQL: schema, tags, territorial catalog, neighbors,
│                         # normalized associations, tester capture, feedback analysis
├── docker/app/           # Dockerfile for image copilot-ong-helpchat:dev
├── docs/
│   ├── product/          # vision, brand, UX sprints, conversation-context spec
│   └── helpchat/         # CURRENT_STATE.md (checkpoint), HELPCHAT_RUNTIME/ROADMAP, adr/
├── openspec/             # OpenSpec workflow: specs/ + changes/ + config.yaml
├── data/curation/        # curation data
└── (legacy root files)   # VIEJO*.xlsx/csv/json, "index copy*.js" in backend — NOT canonical
```

## Notes

- No root package.json; backend and frontend are independent npm workspaces.
- `docs/helpchat/CURRENT_STATE.md` is the dated checkpoint doc; ADRs live in
  `docs/helpchat/adr/`. Read it for the latest conversation-architecture state.
- Legacy root artifacts (VIEJO* files, `index copy*.js`) are historical, not part of
  the running system — do not treat them as canonical or modify them.
- SQL init scripts in `db/local/init/` are numbered and ordered; new migrations get
  the next number.
