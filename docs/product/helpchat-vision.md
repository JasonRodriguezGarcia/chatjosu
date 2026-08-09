## HelpChat Vision

### Product Identity

Technical/project name: Copilot ONG / HelpChat.

Public-facing product name: Entre Amigas · Te orienta.

Public attribution: Una iniciativa de Entre Amigas Anda la Cosa.

The product is connected to the communication and social outreach work of Entre Amigas Anda la Cosa.

The public interface should foreground the Entre Amigas identity rather than presenting itself as an AI product or technical copilot.

### Purpose

HelpChat helps a person freely explain their situation and guides them towards associations, NGOs, and other resources that may be able to orient or support them.

The core interaction should feel like being listened to and guided, not like completing an administrative form or operating a search engine.

The product orients. It does not diagnose, determine eligibility, guarantee assistance, or replace professional advice.

### Principles

Conversation comes before forms.

Understand before recommending.

The user should not need to know internal tags, categories, database structure, or administrative terminology.

A conversation may contain several needs. Do not permanently design around one message equalling one tag.

Location is useful context, but it must remain secondary, visible, and easy to modify.

Conversational text and verifiable association data are separate concerns.

Association data must come from structured backend data and should be rendered using structured interface components rather than relying on AI-generated Markdown.

Voice and text will eventually be equivalent inputs:

voice → transcription → user review/edit → normal text submission.

Mobile is the primary responsive reference.

Desktop may later enrich the experience with conversation plus a dedicated resources area.

### Personality

The experience should be:

warm;
calm;
respectful;
clear;
human-centred;
non-clinical;
non-bureaucratic;
non-paternalistic.

The assistant must not pretend to be a person.

Avoid unnecessary technical language such as model, classification, query, processing, or detected category in public-facing copy.

Prefer language such as:

Buscando opciones…
Recursos que pueden orientarte.
¿Quieres que afinemos un poco más?
Cuéntanos qué está pasando con tus propias palabras.

### Trust

Structured NGO and association information is verifiable product data and must not be invented by the language model.

Territorial coverage must be described carefully.

Do not imply that a result list is exhaustive.

Use language that distinguishes local, provincial, neighbouring, regional, and national resources when appropriate.

### Privacy

In production, avoid storing literal conversation text merely for analytics.

Prefer aggregate operational metadata such as:

province or territorial scope;
need/category metadata;
date;
provider/model;
latency;
number of results;
fallback behaviour.

### Out of Scope

Explicitly exclude from the current product:

files and document management;
case tracking;
direct applications;
login and complex user profiles;
benefit calculations;
administrative-rule engines;
eligibility decisions.

Possible future evolution may include:

public resources;
discovery of grants or benefits;
pre-evaluation workflows;
deterministic calculations.

These future capabilities must not distort the current conversational orientation product.
