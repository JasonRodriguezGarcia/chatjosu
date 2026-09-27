import test from "node:test";
import assert from "node:assert/strict";

import {
  createHelpchatClarificationRendererV1,
} from "../services/helpchat-clarification-renderer-v1.js";

function ageIntent() {
  return {
    version: 1,
    action:
      "paraphrase_clarification",
    language:
      "es",
    askFor:
      "age",
    node:
      "age",
    targetPersonId:
      "person_1",
    relationship:
      "hermano",
    canonicalQuestion:
      "¿Qué edad tiene la persona de la que me hablas?",
  };
}

test(
  "accepts a valid bounded paraphrase",
  async () => {
    let requestBody = null;

    const renderer =
      createHelpchatClarificationRendererV1({
        fetchImpl:
          async (
            url,
            options,
          ) => {
            requestBody =
              JSON.parse(
                options.body,
              );

            return {
              ok: true,
              async json() {
                return {
                  response:
                    '{"question":"¿Qué edad tiene tu hermano?","ask_for":"age"}',
                };
              },
            };
          },
      });

    const result =
      await renderer.render({
        intent:
          ageIntent(),
      });

    assert.equal(
      result.rendered,
      true,
    );

    assert.equal(
      result.question,
      "¿Qué edad tiene tu hermano?",
    );

    assert.equal(
      requestBody.model,
      "qwen3:8b",
    );

    assert.equal(
      requestBody.stream,
      false,
    );

    assert.equal(
      requestBody.format,
      "json",
    );

    assert.equal(
      requestBody.think,
      false,
    );
  },
);

test(
  "falls back when model changes the requested dimension",
  async () => {
    const renderer =
      createHelpchatClarificationRendererV1({
        fetchImpl:
          async () => ({
            ok: true,
            async json() {
              return {
                response:
                  '{"question":"¿Dónde vive tu hermano?","ask_for":"territory"}',
              };
            },
          }),
      });

    const result =
      await renderer.render({
        intent:
          ageIntent(),
      });

    assert.equal(
      result.rendered,
      false,
    );

    assert.equal(
      result.reason,
      "contract_mismatch",
    );

    assert.equal(
      result.question,
      ageIntent()
        .canonicalQuestion,
    );
  },
);

test(
  "falls back when rendered text contains multiple questions",
  async () => {
    const renderer =
      createHelpchatClarificationRendererV1({
        fetchImpl:
          async () => ({
            ok: true,
            async json() {
              return {
                response:
                  '{"question":"¿Qué edad tiene? ¿Dónde vive?","ask_for":"age"}',
              };
            },
          }),
      });

    const result =
      await renderer.render({
        intent:
          ageIntent(),
      });

    assert.equal(
      result.rendered,
      false,
    );

    assert.equal(
      result.reason,
      "invalid_question:multiple_questions",
    );
  },
);

test(
  "falls back immediately on provider failure",
  async () => {
    const renderer =
      createHelpchatClarificationRendererV1({
        fetchImpl:
          async () => {
            throw new Error(
              "ollama unavailable",
            );
          },
      });

    const result =
      await renderer.render({
        intent:
          ageIntent(),
      });

    assert.equal(
      result.rendered,
      false,
    );

    assert.equal(
      result.reason,
      "provider_error",
    );

    assert.equal(
      result.question,
      ageIntent()
        .canonicalQuestion,
    );
  },
);

test(
  "skips ollama when there is no useful personalization context",
  async () => {
    let called = false;

    const renderer =
      createHelpchatClarificationRendererV1({
        fetchImpl:
          async () => {
            called = true;

            throw new Error(
              "ollama must not run",
            );
          },
      });

    const intent = {
      version: 1,
      action:
        "paraphrase_clarification",
      language:
        "es",
      askFor:
        "need_type",
      node:
        "need_type",
      targetPersonId:
        "self",
      relationship:
        "self",
      canonicalQuestion:
        "¿Sobre qué situación necesitas orientación?",
    };

    const result =
      await renderer.render({
        intent,
      });

    assert.equal(
      called,
      false,
    );

    assert.equal(
      result.rendered,
      false,
    );

    assert.equal(
      result.reason,
      "no_personalization_value",
    );

    assert.equal(
      result.durationMs,
      0,
    );

    assert.equal(
      result.question,
      intent.canonicalQuestion,
    );
  },
);
