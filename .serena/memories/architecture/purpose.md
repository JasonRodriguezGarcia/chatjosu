# Purpose — HelpChat

## Identity

- Internal/project name: Copilot ONG / HelpChat. Public name: "Entre Amigas ·
  Te orienta", una iniciativa de Entre Amigas Anda la Cosa.
- Public UI foregrounds the Entre Amigas identity, not an AI/technical product.
- Assistant must not pretend to be a person; avoid technical jargon (model,
  classification, query, detected category) in public-facing copy.

## Purpose

- Person freely explains their situation; product guides them to associations/NGOs
  and resources that may orient or support them.
- Conversation comes before forms; understand before recommending. The user must not
  need to know tags, categories, or DB structure.

## Hard limits (invariants)

- Orient, never diagnose: may record declared symptoms/observations/circumstances,
  never convert them into diagnoses, determine eligibility, guarantee assistance, or
  replace professional advice.
- Clarify only when the answer materially changes search, ranking, security, or the
  reply; stop asking once enough information exists.
- A conversation may contain several needs; never design around "one message = one tag".
- Location is secondary, visible, easily modifiable context (Spanish provinces).
- Never imply a result list is exhaustive; distinguish local / provincial /
  neighbouring / regional / national scope in wording.
- Out of scope: file/document management, case tracking, direct applications,
  login/complex user profiles, benefit calculations, administrative rule engines,
  eligibility decisions.

## Product KPIs / behavior targets

- Latency targets (targets, not guarantees): acknowledgement < 100 ms, typical useful
  response < 2 s, p95 < 4 s. Measure client-perceived, backend, AI-provider and
  DB lookups separately.
- No global loading screens; composer stays usable while assistant works; user may
  keep sending messages during processing.
- Continuity is semantic, not visual: keep a compact structured conversation context
  (person, relationships, active needs, territory, constraints, previously shown
  resources); do NOT resend raw history by default.
- Context-dependent messages process in causal order; never concurrently against stale
  context.
