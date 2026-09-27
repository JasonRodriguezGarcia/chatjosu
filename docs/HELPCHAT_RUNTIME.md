# HelpChat Runtime

## Scope

This document describes the development runtime and operational topology for
Copilot ONG / HelpChat.

The functional roadmap remains in `docs/HELPCHAT_ROADMAP.md`.

## Public development entry point

Cloudflare remains outside the application Docker stack.

Current flow:

    Cloudflare Quick Tunnel
            |
            v
    127.0.0.1:5174
            |
            v
    copilot-ong-backend-docker

`copilot-ong-tunnel.service` is managed as a user systemd service.

It is intentionally independent from the application containers. Restarting or
recreating the HelpChat containers must not require restarting Cloudflare.

A Quick Tunnel URL is development infrastructure and may change if the
Cloudflare tunnel itself is recreated.

## Application stack

Application services are defined in:

    compose.helpchat.yml

### backend

Container:

    copilot-ong-backend-docker

Image:

    copilot-ong-helpchat:dev

Responsibilities:

- Express API;
- `/api` HelpChat routes;
- static React build from `frontend/dist`;
- HelpChat semantic/runtime services;
- health check.

Host binding:

    127.0.0.1:5174 -> container:5000

The container is replaceable. Application state must not be stored inside the
container filesystem.

### feedback-analyst

Container:

    copilot-ong-feedback-analyst

Uses the same application image as the backend and runs:

    node scripts/run-helpchat-feedback-analysis-worker.js

It:

- has no public HTTP port;
- consumes the persisted feedback-analysis queue;
- uses PostgreSQL as the source of truth;
- uses Ollama for local analysis;
- can be restarted without losing queued work.

## PostgreSQL

PostgreSQL is managed separately from the application stack:

    db/local/docker-compose.yml

Container:

    copilot-ong-postgres

Persistent volume:

    copilot_ong_postgres_data

Mounted at:

    /var/lib/postgresql/data

The application and Analyst connect to PostgreSQL through the external Docker
network `local_default`.

Database state does not live in the backend or Analyst containers.

### Critical persistence rule

Never remove the PostgreSQL volume as part of normal application operations.

In particular, do not use commands that intentionally remove the persistent
database volume.

Before schema migrations or infrastructure changes, create and validate a
PostgreSQL dump.

## Ollama

Ollama is external to the HelpChat Compose stack.

The HelpChat containers currently reach it through:

    http://host.docker.internal:11434

Models used by HelpChat include:

- `nomic-embed-text`;
- `qwen3:8b`.

Ollama lifecycle is independent from backend and Analyst lifecycle.

## Current validated application image

Validated deployment checkpoint as of 2026-08-18:

    Git revision:
      162b55d

    Image:
      copilot-ong-helpchat:dev

    Image ID:
      sha256:967b2e6ef3bcddd8b15b44bef365eddb720e6f8d9c4670b5bbdc449e7dd71738

The image was built from a detached clean Git worktree at exactly
`162b55d`, then promoted with `--no-build` from the main deployment
Compose so that host-side Docker environment configuration remained
available.

After promotion:

    backend health = healthy
    HTTP E2E = PASS

Reference E2E backend duration:

    284 ms

Operational lesson:

Do not rely on `docker compose build` from a dirty integration working
tree when exact Git-to-image reproducibility matters. Build the image
from a clean worktree/checkout and use the deployment Compose only to
supply runtime configuration and recreate the service.

## Persistence model

Canonical persistence is divided by responsibility:

| State | Source of truth |
|---|---|
| Associations/resources | PostgreSQL |
| Tester sessions/turns | PostgreSQL |
| Tester feedback | PostgreSQL |
| Feedback Analyst queue | PostgreSQL |
| Feedback Analyst results | PostgreSQL |
| Application logic | Git |
| Frontend source | Git |
| Built frontend | Docker image, reproducible from Git |
| Secrets/runtime environment | Host-side environment files |
| Application logs | Docker runtime; not canonical state |

Backend and Analyst containers intentionally have no persistent filesystem
mounts.

## Local environment

Docker-specific secrets/configuration are loaded from:

    backend/.env.docker.local

This file must remain outside Git.

It contains runtime-specific values such as:

- database connection details;
- external provider credentials;
- Ollama endpoint;
- backend binding;
- frontend serving mode.

Never commit real secrets.

## Container lifecycle

Show status:

    docker compose -f compose.helpchat.yml ps

Show logs:

    docker compose -f compose.helpchat.yml logs -f backend feedback-analyst

Build:

    docker compose -f compose.helpchat.yml build backend

Start/update:

    docker compose -f compose.helpchat.yml up -d backend feedback-analyst

Stop application containers:

    docker compose -f compose.helpchat.yml down

The PostgreSQL container is managed by its separate Compose project and is not
removed by the HelpChat application Compose lifecycle.

## Development deployment workflow

HelpChat is deployed from the Docker image. A successful host-side Vite build
or test run does not update the running application by itself.

After any frontend or backend code change that must be validated in the
running/public application:

1. Run the relevant automated tests.
2. Run the frontend/backend build checks required by the change.
3. Rebuild the application image:

       docker compose -f compose.helpchat.yml build backend

4. Recreate the application containers:

       docker compose -f compose.helpchat.yml up -d --force-recreate backend feedback-analyst

5. Wait until `copilot-ong-backend-docker` reports `healthy`.
6. Verify the application locally through `127.0.0.1:5174`.
7. Verify the public Cloudflare endpoint without restarting the tunnel.

The deployed frontend is the `frontend/dist` generated during the Docker image
build. The host-side `frontend/dist` directory is not the deployed artifact.

Cloudflare remains outside Docker and must not be restarted merely to deploy a
new HelpChat image.

## Health checks

Local frontend:

    curl http://127.0.0.1:5174/

Local API:

    curl http://127.0.0.1:5174/api/v1/helpchat/provincias

The backend container also exposes a Docker health check based on the HelpChat
province endpoint.

## Legacy host services

The previous host-side application services are disabled:

    copilot-ong-frontend.service
    copilot-ong-backend.service

They are retained temporarily as rollback artifacts but must not run while the
Docker backend owns port 5174.

The Cloudflare service remains active:

    copilot-ong-tunnel.service

## Recovery model

A complete recovery requires:

1. Git checkout of the application;
2. Docker/Compose;
3. `backend/.env.docker.local` or equivalent reconstructed secrets;
4. PostgreSQL persistent volume or a validated database dump;
5. Ollama and required local models;
6. Cloudflare tunnel configuration if public development access is required.

The Docker image itself is not the canonical source of application logic. Git
is.

## Backup policy

Create PostgreSQL dumps before:

- schema migrations;
- destructive data operations;
- database-container topology changes;
- significant deployment changes.

Validate each dump with `pg_restore -l` and retain its SHA-256 checksum.
