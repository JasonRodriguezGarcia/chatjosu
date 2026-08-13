function createTimeoutError() {
  const error =
    new Error(
      "Timeout del LLM local."
    );

  error.code =
    "LOCAL_LLM_TIMEOUT";

  error.providerStatus = 504;

  return error;
}

function normalizeCandidate(candidate) {
  if (
    !candidate ||
    typeof candidate !== "object"
  ) {
    return null;
  }

  const tag =
    typeof candidate.tag === "string"
      ? candidate.tag.trim()
      : "";

  if (!tag) {
    return null;
  }

  return {
    tag,
    tagId:
      Number.isFinite(
        Number(candidate.tagId)
      )
        ? Number(candidate.tagId)
        : null,
    score:
      Number.isFinite(
        Number(candidate.score)
      )
        ? Number(candidate.score)
        : null,
  };
}

function buildPrompt({
  taskContext,
  candidates,
}) {
  const candidateList =
    candidates.map(
      (candidate, index) => ({
        option:
          index + 1,
        tag:
          candidate.tag,
      }),
    );

  return [
    "Eres un clasificador interno de HelpChat.",
    "No converses con la persona usuaria.",
    "No diagnostiques.",
    "No inventes categorías.",
    "",
    "Debes elegir únicamente una de las opciones proporcionadas.",
    "Si ninguna encaja suficientemente, responde needs_clarification.",
    "",
    "Devuelve SOLO JSON con esta forma:",
    '{"status":"resolved","option":1}',
    "o",
    '{"status":"needs_clarification","option":null}',
    "",
    "CONTEXTO DE TAREA:",
    JSON.stringify(taskContext),
    "",
    "OPCIONES:",
    JSON.stringify(candidateList),
  ].join("\n");
}

function parseResponseText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed =
    value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(
      trimmed,
    );
  } catch {
    const match =
      trimmed.match(
        /\{[\s\S]*\}/
      );

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(
        match[0],
      );
    } catch {
      return null;
    }
  }
}

export function createHelpchatLocalLlmService({
  baseUrl =
    "http://127.0.0.1:11434",
  model =
    "qwen3:8b",
  timeoutMs = 5000,
  fetchImpl = fetch,
} = {}) {
  const generateUrl =
    `${baseUrl.replace(/\/$/, "")}/api/generate`;

  async function classify({
    taskContext,
    candidates = [],
  } = {}) {
    const normalizedCandidates =
      candidates
        .map(
          normalizeCandidate,
        )
        .filter(Boolean)
        .slice(0, 5);

    if (
      normalizedCandidates.length === 0
    ) {
      return {
        status:
          "needs_clarification",
        tag: null,
        provider:
          "ollama",
        model,
        durationMs: 0,
      };
    }

    const startedAt =
      performance.now();

    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () =>
          controller.abort(),
        timeoutMs,
      );

    let response;

    try {
      response =
        await fetchImpl(
          generateUrl,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                model,
                prompt:
                  buildPrompt({
                    taskContext,
                    candidates:
                      normalizedCandidates,
                  }),
                stream: false,
                format: "json",
                keep_alive:
                  "10m",
                options: {
                  temperature: 0,
                  num_predict: 64,
                },
              }),
            signal:
              controller.signal,
          },
        );
    } catch (error) {
      if (
        error?.name ===
          "AbortError"
      ) {
        throw createTimeoutError();
      }

      const wrapped =
        new Error(
          error?.message ||
          "No se pudo consultar el LLM local.",
        );

      wrapped.code =
        "LOCAL_LLM_ERROR";

      throw wrapped;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const error =
        new Error(
          `LLM local respondió HTTP ${response.status}.`,
        );

      error.code =
        "LOCAL_LLM_HTTP_ERROR";

      error.providerStatus =
        response.status;

      throw error;
    }

    const payload =
      await response.json();

    const parsed =
      parseResponseText(
        payload?.response,
      );

    const durationMs =
      Math.round(
        (
          performance.now() -
          startedAt
        ) * 10,
      ) / 10;

    if (
      parsed?.status ===
        "resolved" &&
      Number.isInteger(
        parsed.option,
      ) &&
      parsed.option >= 1 &&
      parsed.option <=
        normalizedCandidates.length
    ) {
      const selected =
        normalizedCandidates[
          parsed.option - 1
        ];

      return {
        status:
          "resolved",
        tag: {
          tag_id:
            selected.tagId,
          descripcion:
            selected.tag,
        },
        provider:
          "ollama",
        model,
        durationMs,
      };
    }

    return {
      status:
        "needs_clarification",
      tag: null,
      provider:
        "ollama",
      model,
      durationMs,
    };
  }

  return {
    classify,
    model,
  };
}
