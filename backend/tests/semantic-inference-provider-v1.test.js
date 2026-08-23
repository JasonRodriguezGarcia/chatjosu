import assert from "node:assert/strict";
import test from "node:test";

import {
  createLlamaCppSemanticInferenceProviderV1,
} from "../scripts/lib/semantic-inference-provider-v1.js";

function jsonResponse(
  body,
  {
    status = 200,
  } = {}
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "content-type":
          "application/json",
      },
    }
  );
}

test(
  "discovers configured llama.cpp model",
  async () => {
    const calls = [];

    const provider =
      createLlamaCppSemanticInferenceProviderV1({
        baseUrl:
          "http://127.0.0.1:8080/",

        model:
          "example/model",

        fetchImpl:
          async (
            url
          ) => {
            calls.push(url);

            return jsonResponse({
              data: [
                {
                  id:
                    "example/model",

                  status: {
                    value:
                      "unloaded",
                  },

                  source:
                    "preset",
                },
              ],
            });
          },
      });

    const info =
      await provider
        .getModelInfo();

    assert.equal(
      info.provider,
      "llama.cpp"
    );

    assert.equal(
      info.model,
      "example/model"
    );

    assert.equal(
      info.status,
      "unloaded"
    );

    assert.deepEqual(
      calls,
      [
        "http://127.0.0.1:8080/v1/models",
      ]
    );
  }
);

test(
  "uses OpenAI-compatible structured chat completion",
  async () => {
    let request = null;

    const provider =
      createLlamaCppSemanticInferenceProviderV1({
        baseUrl:
          "http://127.0.0.1:8080",

        model:
          "example/model",

        fetchImpl:
          async (
            url,
            init
          ) => {
            request = {
              url,
              init,
            };

            return jsonResponse({
              choices: [
                {
                  message: {
                    content:
                      "{\"status\":\"ok\"}",
                  },

                  finish_reason:
                    "stop",
                },
              ],

              usage: {
                prompt_tokens:
                  10,

                completion_tokens:
                  5,

                total_tokens:
                  15,
              },
            });
          },
      });

    const schema = {
      type:
        "object",

      additionalProperties:
        false,

      required: [
        "status",
      ],

      properties: {
        status: {
          const:
            "ok",
        },
      },
    };

    const result =
      await provider
        .generateStructured({
          prompt:
            "Return JSON.",

          schema,
        });

    assert.equal(
      request.url,
      "http://127.0.0.1:8080/v1/chat/completions"
    );

    const body =
      JSON.parse(
        request.init.body
      );

    assert.equal(
      body.model,
      "example/model"
    );

    assert.equal(
      body.temperature,
      0
    );

    assert.equal(
      body.stream,
      false
    );

    assert.equal(
      body.response_format.type,
      "json_schema"
    );

    assert.deepEqual(
      body.response_format
        .json_schema
        .schema,
      schema
    );

    assert.deepEqual(
      result.result,
      {
        status:
          "ok",
      }
    );

    assert.equal(
      result.usage
        .total_tokens,
      15
    );
  }
);

test(
  "fails closed when model response is not JSON",
  async () => {
    const provider =
      createLlamaCppSemanticInferenceProviderV1({
        baseUrl:
          "http://127.0.0.1:8080",

        model:
          "example/model",

        fetchImpl:
          async () =>
            jsonResponse({
              choices: [
                {
                  message: {
                    content:
                      "not-json",
                  },
                },
              ],
            }),
      });

    await assert.rejects(
      () =>
        provider
          .generateStructured({
            prompt:
              "Return JSON.",

            schema: {
              type:
                "object",
            },
          }),

      /LLAMACPP_MODEL_RESPONSE_NOT_JSON/
    );
  }
);

test(
  "readiness returns immediately when model is already loaded",
  async () => {
    let calls = 0;

    const provider =
      createLlamaCppSemanticInferenceProviderV1({
        baseUrl:
          "http://127.0.0.1:8080",

        model:
          "example/model",

        fetchImpl:
          async () => {
            calls += 1;

            return jsonResponse({
              data: [
                {
                  id:
                    "example/model",

                  status: {
                    value:
                      "loaded",
                  },

                  source:
                    "preset",
                },
              ],
            });
          },
      });

    const ready =
      await provider
        .waitUntilReady({
          timeoutMs:
            1000,

          pollIntervalMs:
            1,
        });

    assert.equal(
      ready.ready,
      true
    );

    assert.equal(
      ready.status,
      "loaded"
    );

    assert.equal(
      ready.polls,
      1
    );

    assert.equal(
      calls,
      1
    );
  }
);

test(
  "readiness polls until model becomes loaded",
  async () => {
    let calls = 0;

    const provider =
      createLlamaCppSemanticInferenceProviderV1({
        baseUrl:
          "http://127.0.0.1:8080",

        model:
          "example/model",

        fetchImpl:
          async () => {
            calls += 1;

            return jsonResponse({
              data: [
                {
                  id:
                    "example/model",

                  status: {
                    value:
                      calls >= 3
                        ? "loaded"
                        : "loading",
                  },
                },
              ],
            });
          },
      });

    const ready =
      await provider
        .waitUntilReady({
          timeoutMs:
            1000,

          pollIntervalMs:
            1,
        });

    assert.equal(
      ready.ready,
      true
    );

    assert.equal(
      ready.status,
      "loaded"
    );

    assert.equal(
      ready.polls,
      3
    );
  }
);

test(
  "readiness fails closed on timeout",
  async () => {
    const provider =
      createLlamaCppSemanticInferenceProviderV1({
        baseUrl:
          "http://127.0.0.1:8080",

        model:
          "example/model",

        fetchImpl:
          async () =>
            jsonResponse({
              data: [
                {
                  id:
                    "example/model",

                  status: {
                    value:
                      "loading",
                  },
                },
              ],
            }),
      });

    await assert.rejects(
      () =>
        provider
          .waitUntilReady({
            timeoutMs:
              10,

            pollIntervalMs:
              1,
          }),

      /LLAMACPP_MODEL_READY_TIMEOUT/
    );
  }
);
