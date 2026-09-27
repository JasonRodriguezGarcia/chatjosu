import test from "node:test";
import assert from "node:assert/strict";

import {
  createHelpchatEmbeddingService,
} from "../services/helpchat-embedding-service.js";

test(
  "preload uses the embedding endpoint with an explicit warmup timeout",
  async () => {
    const originalFetch =
      globalThis.fetch;

    let requestBody = null;

    globalThis.fetch =
      async (
        _url,
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
              embeddings: [
                [
                  1,
                  0,
                ],
              ],
              total_duration:
                100,
              load_duration:
                10,
              prompt_eval_count:
                1,
            };
          },
        };
      };

    try {
      const service =
        createHelpchatEmbeddingService({
          timeoutMs: 100,
          keepAlive: "30m",
        });

      const result =
        await service.preload({
          timeoutMs: 15000,
        });

      assert.equal(
        result.vectors.length,
        1,
      );

      assert.equal(
        requestBody.model,
        "nomic-embed-text",
      );

      assert.equal(
        requestBody.keep_alive,
        "30m",
      );

      assert.equal(
        requestBody.input,
        "helpchat embedding warmup",
      );
    } finally {
      globalThis.fetch =
        originalFetch;
    }
  },
);
