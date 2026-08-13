function normalizeModelName(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/:latest$/, "");
}

function matchesModel(
  candidate,
  requested,
) {
  return (
    normalizeModelName(candidate) ===
    normalizeModelName(requested)
  );
}

async function readJson(
  response,
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createHelpchatOllamaReadiness({
  baseUrl =
    "http://127.0.0.1:11434",
  fetchImpl = fetch,
  timeoutMs = 3000,
} = {}) {
  const root =
    baseUrl.replace(/\/$/, "");

  async function request(
    path,
    options = {},
  ) {
    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () =>
          controller.abort(),
        timeoutMs,
      );

    try {
      return await fetchImpl(
        `${root}${path}`,
        {
          ...options,
          signal:
            controller.signal,
        },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function inspectModel(
    model,
  ) {
    try {
      const [
        tagsResponse,
        psResponse,
      ] =
        await Promise.all([
          request("/api/tags"),
          request("/api/ps"),
        ]);

      if (
        !tagsResponse.ok ||
        !psResponse.ok
      ) {
        return {
          model,
          installed: false,
          loaded: false,
          state: "unavailable",
        };
      }

      const tags =
        await readJson(
          tagsResponse,
        );

      const ps =
        await readJson(
          psResponse,
        );

      const installed =
        Array.isArray(
          tags?.models,
        ) &&
        tags.models.some(
          (entry) =>
            matchesModel(
              entry?.name ||
              entry?.model,
              model,
            ),
        );

      const loaded =
        Array.isArray(
          ps?.models,
        ) &&
        ps.models.some(
          (entry) =>
            matchesModel(
              entry?.name ||
              entry?.model,
              model,
            ),
        );

      return {
        model,
        installed,
        loaded,
        state:
          !installed
            ? "missing"
            : loaded
              ? "ready"
              : "cold",
      };
    } catch (error) {
      return {
        model,
        installed: false,
        loaded: false,
        state: "unavailable",
        error:
          error?.name ===
          "AbortError"
            ? "OLLAMA_TIMEOUT"
            : (
                error?.message ||
                "OLLAMA_ERROR"
              ),
      };
    }
  }

  async function preloadGenerate({
    model,
    keepAlive = "30m",
    timeoutMs:
      preloadTimeoutMs = 30000,
  } = {}) {
    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () =>
          controller.abort(),
        preloadTimeoutMs,
      );

    try {
      const response =
        await fetchImpl(
          `${root}/api/generate`,
          {
            method: "POST",
            signal:
              controller.signal,
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                model,
                prompt: "OK",
                stream: false,
                keep_alive:
                  keepAlive,
                options: {
                  temperature: 0,
                  num_predict: 1,
                },
              }),
          },
        );

      if (!response.ok) {
        return {
          ok: false,
          error:
            `OLLAMA_HTTP_${response.status}`,
        };
      }

      await readJson(response);

      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error?.name ===
          "AbortError"
            ? "OLLAMA_PRELOAD_TIMEOUT"
            : (
                error?.message ||
                "OLLAMA_PRELOAD_ERROR"
              ),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    inspectModel,
    preloadGenerate,
  };
}
