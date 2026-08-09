function createTimeoutError(timeoutMs) {
  const error = new Error(
    `Embedding local superó ${timeoutMs} ms.`
  );

  error.code = "LOCAL_EMBEDDING_TIMEOUT";
  error.providerStatus = 504;

  return error;
}

export function createHelpchatEmbeddingService({
  baseUrl = "http://127.0.0.1:11434",
  model = "nomic-embed-text",
  timeoutMs = 2000,
  keepAlive = "30m",
} = {}) {
  const endpoint =
    `${baseUrl.replace(/\/$/, "")}/api/embed`;

  async function embed(input) {
    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      timeoutMs
    );

    try {
      const response = await fetch(
        endpoint,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            model,
            input,
            keep_alive: keepAlive,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(
          data?.error ||
          `Embedding HTTP ${response.status}`
        );

        error.code =
          "LOCAL_EMBEDDING_ERROR";

        error.providerStatus =
          response.status;

        throw error;
      }

      const vectors =
        data?.embeddings;

      if (
        !Array.isArray(vectors) ||
        vectors.length === 0
      ) {
        const error = new Error(
          "Embedding local no devolvió vectores."
        );

        error.code =
          "LOCAL_EMBEDDING_INVALID_RESPONSE";

        error.providerStatus = 502;

        throw error;
      }

      return {
        vectors,
        model,
        totalDurationNs:
          data?.total_duration || null,
        loadDurationNs:
          data?.load_duration || null,
        promptEvalCount:
          data?.prompt_eval_count || null,
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw createTimeoutError(
          timeoutMs
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    model,
    embed,
  };
}
