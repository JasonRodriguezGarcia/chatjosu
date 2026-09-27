# Core

Graph root for copilot-ong (HelpChat).

## What this is

Copilot ONG / HelpChat (public name: "Entre Amigas · Te orienta"): a conversational
service that lets people describe their situation in their own words and guides them
towards Spanish social associations/NGOs and resources. The product orients; it never
diagnoses, decides eligibility, or invents resources.

## Reading map

- Product identity, purpose, hard product limits and KPIs: `mem:architecture/purpose`
  (what the product may and may not do; read before changing any product behavior).
- Conversation pipeline, module responsibilities, local-first AI order,
  backend/frontend split: `mem:architecture/overview` (read when touching conversation
  logic, the chat UI, or any backend module in backend/helpchat or backend/services).
- Where things live in the repository, which dirs are canonical vs legacy:
  `mem:repo-structure` (read before adding, moving, or locating files).
- Runtimes, frameworks, databases, AI providers, env vars, Docker setup:
  `mem:tech-stack` (read before touching dependencies, env config, or infra).
- Documented tooling commands and OpenSpec invocation: `mem:development/commands`
  (read before running OpenSpec, scripts, or build tooling for a change; note the
  build/serve toolchain is not yet recorded there).
- Verification discipline and smoke checks: `mem:testing/smokes`
  (read before claiming any change is verified; what counts as verification,
  minimum checks, BLOCKED rule).
- Change-scope and editing conventions: `mem:conventions`
  (read before touching any file; hard scope boundaries, minimal-change rules).
- Git discipline and the operational workflow with the external controller:
  `mem:git/workflow` (read before starting or closing any non-trivial change;
  plan→apply→verify sequence, who owns PASS).

## Invariants

- LLM may vary wording and parse natural language only. It must never invent
  categories, transitions, or resources; resources come from the authorized
  structured catalog (Postgres).
- Conversational text and verifiable association data are separate concerns:
  resources render as structured UI components, not AI-generated Markdown.
- The agent does not own final PASS, Git persistence, or publication; the
  external controller owns PASS.
