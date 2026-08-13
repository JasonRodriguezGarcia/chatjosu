import test from "node:test";
import assert from "node:assert/strict";

import {
  createHelpchatOllamaReadiness,
} from "../services/helpchat-ollama-readiness.js";

function jsonResponse(
  data,
  ok = true,
  status = 200,
) {
  return {
    ok,
    status,
    async json() {
      return data;
    },
  };
}

test(
  "detects an installed and loaded model",
  async () => {
    const fetchImpl =
      async (url) => {
        if (
          url.endsWith(
            "/api/tags",
          )
        ) {
          return jsonResponse({
            models: [
              {
                name:
                  "nomic-embed-text:latest",
              },
            ],
          });
        }

        return jsonResponse({
          models: [
            {
              name:
                "nomic-embed-text:latest",
            },
          ],
        });
      };

    const service =
      createHelpchatOllamaReadiness({
        fetchImpl,
      });

    const result =
      await service.inspectModel(
        "nomic-embed-text",
      );

    assert.equal(
      result.state,
      "ready",
    );

    assert.equal(
      result.installed,
      true,
    );

    assert.equal(
      result.loaded,
      true,
    );
  },
);

test(
  "distinguishes installed but cold from missing",
  async () => {
    let installed = true;

    const fetchImpl =
      async (url) => {
        if (
          url.endsWith(
            "/api/tags",
          )
        ) {
          return jsonResponse({
            models:
              installed
                ? [
                    {
                      name:
                        "qwen3:8b",
                    },
                  ]
                : [],
          });
        }

        return jsonResponse({
          models: [],
        });
      };

    const service =
      createHelpchatOllamaReadiness({
        fetchImpl,
      });

    const cold =
      await service.inspectModel(
        "qwen3:8b",
      );

    assert.equal(
      cold.state,
      "cold",
    );

    installed = false;

    const missing =
      await service.inspectModel(
        "qwen3:8b",
      );

    assert.equal(
      missing.state,
      "missing",
    );
  },
);

test(
  "preloadGenerate requests a minimal generation with keep alive",
  async () => {
    let request = null;

    const service =
      createHelpchatOllamaReadiness({
        fetchImpl:
          async (
            url,
            options,
          ) => {
            request = {
              url,
              options,
            };

            return jsonResponse({
              response: "",
            });
          },
      });

    const result =
      await service.preloadGenerate({
        model: "qwen3:8b",
        keepAlive: "30m",
      });

    assert.equal(
      result.ok,
      true,
    );

    const body =
      JSON.parse(
        request.options.body,
      );

    assert.equal(
      body.model,
      "qwen3:8b",
    );

    assert.equal(
      body.keep_alive,
      "30m",
    );

    assert.equal(
      body.options.num_predict,
      1,
    );
  },
);
