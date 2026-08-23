import crypto from "node:crypto";

function sha256(
  value
) {
  return crypto
    .createHash("sha256")
    .update(
      String(value ?? "")
    )
    .digest("hex");
}

function requiredString(
  value,
  label
) {
  if (
    typeof value !== "string"
    || !value.trim()
  ) {
    throw new TypeError(
      `${label} is required`
    );
  }

  return value.trim();
}

async function readJsonResponse(
  response,
  context
) {
  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `${context}:HTTP_${response.status}:${text.slice(0, 500)}`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `${context}:INVALID_JSON_RESPONSE`
    );
  }
}

export function
createLlamaCppSemanticInferenceProviderV1({
  baseUrl,
  model,
  fetchImpl = globalThis.fetch,
} = {}) {
  const normalizedBaseUrl =
    requiredString(
      baseUrl,
      "baseUrl"
    ).replace(
      /\/+$/,
      ""
    );

  const modelId =
    requiredString(
      model,
      "model"
    );

  if (
    typeof fetchImpl !== "function"
  ) {
    throw new TypeError(
      "fetchImpl must be a function"
    );
  }

  async function
  getModelInfo() {
    const response =
      await fetchImpl(
        `${normalizedBaseUrl}/v1/models`
      );

    const doc =
      await readJsonResponse(
        response,
        "LLAMACPP_MODELS"
      );

    const row =
      (
        doc.data ?? []
      ).find(
        item =>
          item?.id === modelId
      );

    if (!row) {
      throw new Error(
        `LLAMACPP_MODEL_NOT_FOUND:${modelId}`
      );
    }

    return {
      provider:
        "llama.cpp",

      model:
        modelId,

      status:
        row.status?.value
        ?? null,

      source:
        row.source
        ?? null,

      meta:
        row.meta
        ?? null,
    };
  }

  async function
  requestModelLoad() {
    const response =
      await fetchImpl(
        `${normalizedBaseUrl}/models/load`,
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",
          },

          body:
            JSON.stringify({
              model:
                modelId,
            }),
        }
      );

    const data =
      await readJsonResponse(
        response,
        "LLAMACPP_MODEL_LOAD"
      );

    return {
      provider:
        "llama.cpp",

      model:
        modelId,

      response:
        data,
    };
  }

  async function
  waitUntilReady({
    timeoutMs = 900_000,
    pollIntervalMs = 10_000,
  } = {}) {
    if (
      !Number.isFinite(timeoutMs)
      || timeoutMs < 1
    ) {
      throw new TypeError(
        "timeoutMs must be positive"
      );
    }

    if (
      !Number.isFinite(
        pollIntervalMs
      )
      || pollIntervalMs < 1
    ) {
      throw new TypeError(
        "pollIntervalMs must be positive"
      );
    }

    const started =
      Date.now();

    let polls = 0;
    let lastInfo = null;

    while (true) {
      lastInfo =
        await getModelInfo();

      polls += 1;

      if (
        lastInfo.status === "loaded"
        || lastInfo.status === "ready"
      ) {
        return {
          ready:
            true,

          provider:
            "llama.cpp",

          model:
            modelId,

          status:
            lastInfo.status,

          elapsed_ms:
            Date.now()
            - started,

          polls,

          model_info:
            lastInfo,
        };
      }

      const elapsed =
        Date.now()
        - started;

      if (
        elapsed >= timeoutMs
      ) {
        throw new Error(
          `LLAMACPP_MODEL_READY_TIMEOUT:${modelId}:${lastInfo.status ?? "unknown"}`
        );
      }

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            Math.min(
              pollIntervalMs,
              Math.max(
                1,
                timeoutMs - elapsed
              )
            )
          )
      );
    }
  }

  async function
  ensureModelReady({
    timeoutMs = 900_000,
    pollIntervalMs = 10_000,
  } = {}) {
    const initial =
      await getModelInfo();

    if (
      initial.status === "loaded"
      || initial.status === "ready"
    ) {
      return {
        ready:
          true,

        provider:
          "llama.cpp",

        model:
          modelId,

        status:
          initial.status,

        load_requested:
          false,

        elapsed_ms:
          0,

        polls:
          1,

        initial_model_info:
          initial,

        model_info:
          initial,
      };
    }

    if (
      initial.status === "failed"
    ) {
      throw new Error(
        `LLAMACPP_MODEL_FAILED:${modelId}`
      );
    }

    const started =
      Date.now();

    const load =
      await requestModelLoad();

    const readiness =
      await waitUntilReady({
        timeoutMs,
        pollIntervalMs,
      });

    if (
      readiness.model !==
      modelId
    ) {
      throw new Error(
        `LLAMACPP_READY_MODEL_MISMATCH:${readiness.model}:${modelId}`
      );
    }

    return {
      ...readiness,

      load_requested:
        true,

      load_response:
        load.response,

      initial_model_info:
        initial,

      elapsed_ms:
        Date.now()
        - started,
    };
  }

  async function
  generateStructured({
    prompt,
    schema,
    temperature = 0,
    maxTokens = 1536,
  } = {}) {
    const promptText =
      requiredString(
        prompt,
        "prompt"
      );

    if (
      !schema
      || typeof schema !== "object"
      || Array.isArray(schema)
    ) {
      throw new TypeError(
        "schema is required"
      );
    }

    const requestBody = {
      model:
        modelId,

      messages: [
        {
          role:
            "user",

          content:
            promptText,
        },
      ],

      temperature,

      max_tokens:
        maxTokens,

      stream:
        false,

      response_format: {
        type:
          "json_schema",

        json_schema: {
          name:
            "semantic_result",

          strict:
            true,

          schema,
        },
      },
    };

    const started =
      Date.now();

    const response =
      await fetchImpl(
        `${normalizedBaseUrl}/v1/chat/completions`,
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",
          },

          body:
            JSON.stringify(
              requestBody
            ),
        }
      );

    const api =
      await readJsonResponse(
        response,
        "LLAMACPP_CHAT"
      );

    const elapsedMs =
      Date.now()
      - started;

    const content =
      api
        ?.choices
        ?.[0]
        ?.message
        ?.content;

    if (
      typeof content !== "string"
      || !content.trim()
    ) {
      throw new Error(
        "LLAMACPP_EMPTY_CONTENT"
      );
    }

    let parsed;

    try {
      parsed =
        JSON.parse(
          content
        );
    } catch {
      throw new Error(
        "LLAMACPP_MODEL_RESPONSE_NOT_JSON"
      );
    }

    return {
      provider:
        "llama.cpp",

      model:
        modelId,

      elapsed_ms:
        elapsedMs,

      prompt_sha256:
        sha256(
          promptText
        ),

      response_text:
        content,

      result:
        parsed,

      usage: {
        prompt_tokens:
          api
            ?.usage
            ?.prompt_tokens
          ?? null,

        completion_tokens:
          api
            ?.usage
            ?.completion_tokens
          ?? null,

        total_tokens:
          api
            ?.usage
            ?.total_tokens
          ?? null,
      },

      finish_reason:
        api
          ?.choices
          ?.[0]
          ?.finish_reason
        ?? null,

      raw_api:
        api,
    };
  }

  return {
    provider:
      "llama.cpp",

    model:
      modelId,

    baseUrl:
      normalizedBaseUrl,

    getModelInfo,
    requestModelLoad,
    waitUntilReady,
    ensureModelReady,
    generateStructured,
  };
}
