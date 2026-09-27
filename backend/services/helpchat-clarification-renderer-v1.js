import {
  validateClarificationQuestion,
} from "../helpchat/clarification-policy-v1.js";

function cleanString(
  value,
  maxLength = 220,
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const cleaned =
    value
      .replace(/\s+/g, " ")
      .trim();

  return cleaned
    ? cleaned.slice(
        0,
        maxLength,
      )
    : null;
}

function parseResponseText(
  value,
) {
  if (
    typeof value !== "string"
  ) {
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
        /\{[\s\S]*\}/,
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

function buildPrompt(
  intent,
) {
  return [
    "Eres el redactor conversacional de HelpChat.",
    "Tu única tarea es reformular una pregunta ya decidida por el sistema.",
    "",
    "REGLAS OBLIGATORIAS:",
    "- Escribe en español natural, cálido y profesional.",
    "- Conserva exactamente el significado de la pregunta canónica.",
    "- No añadas información nueva.",
    "- No diagnostiques.",
    "- No sugieras categorías, recursos ni soluciones.",
    "- No cambies la persona sobre la que se pregunta.",
    "- Formula una sola pregunta.",
    "- Sé breve.",
    "- No menciones nombres internos, tags, nodos o dimensiones.",
    "",
    "Devuelve SOLO JSON:",
    '{"question":"...","ask_for":"..."}',
    "",
    "Debes copiar ask_for exactamente desde INPUT.",
    "",
    "INPUT:",
    JSON.stringify({
      ask_for:
        intent.askFor,
      relationship:
        intent.relationship || null,
      canonical:
        intent.canonicalQuestion,
    }),
  ].join("\n");
}

function hasUsefulPersonalizationContext(
  intent,
) {
  const relationship =
    cleanString(
      intent?.relationship,
      80,
    );

  if (
    !relationship ||
    relationship === "self"
  ) {
    return false;
  }

  return true;
}

function fallbackResult({
  canonicalQuestion,
  model,
  reason,
  durationMs,
} = {}) {
  return {
    question:
      canonicalQuestion,
    rendered: false,
    provider:
      "canonical",
    model,
    reason,
    durationMs,
  };
}

export function createHelpchatClarificationRendererV1({
  baseUrl =
    "http://127.0.0.1:11434",
  model =
    "qwen3:8b",
  timeoutMs = 1800,
  keepAlive =
    "30m",
  fetchImpl = fetch,
} = {}) {
  const generateUrl =
    `${baseUrl.replace(/\/$/, "")}/api/generate`;

  async function render({
    intent,
  } = {}) {
    const canonicalQuestion =
      cleanString(
        intent
          ?.canonicalQuestion,
      );

    if (
      !canonicalQuestion ||
      !intent?.askFor
    ) {
      return fallbackResult({
        canonicalQuestion:
          canonicalQuestion || "",
        model,
        reason:
          "invalid_intent",
        durationMs: 0,
      });
    }

    if (
      !hasUsefulPersonalizationContext(
        intent,
      )
    ) {
      return fallbackResult({
        canonicalQuestion,
        model,
        reason:
          "no_personalization_value",
        durationMs: 0,
      });
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
            method:
              "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                model,
                prompt:
                  buildPrompt(
                    intent,
                  ),
                stream: false,
                format: "json",
                think: false,
                keep_alive:
                  keepAlive,
                options: {
                  temperature:
                    0.35,
                  num_predict:
                    72,
                },
              }),
            signal:
              controller.signal,
          },
        );
    } catch (error) {
      const durationMs =
        Math.round(
          (
            performance.now() -
            startedAt
          ) * 10,
        ) / 10;

      return fallbackResult({
        canonicalQuestion,
        model,
        reason:
          error?.name ===
            "AbortError"
            ? "timeout"
            : "provider_error",
        durationMs,
      });
    } finally {
      clearTimeout(
        timer,
      );
    }

    const durationMs =
      Math.round(
        (
          performance.now() -
          startedAt
        ) * 10,
      ) / 10;

    if (!response.ok) {
      return fallbackResult({
        canonicalQuestion,
        model,
        reason:
          "provider_http_error",
        durationMs,
      });
    }

    let payload;

    try {
      payload =
        await response.json();
    } catch {
      return fallbackResult({
        canonicalQuestion,
        model,
        reason:
          "invalid_provider_payload",
        durationMs,
      });
    }

    const parsed =
      parseResponseText(
        payload?.response,
      );

    if (
      !parsed ||
      parsed.ask_for !==
        intent.askFor
    ) {
      return fallbackResult({
        canonicalQuestion,
        model,
        reason:
          "contract_mismatch",
        durationMs,
      });
    }

    const validation =
      validateClarificationQuestion(
        parsed.question,
      );

    if (!validation.valid) {
      return fallbackResult({
        canonicalQuestion,
        model,
        reason:
          `invalid_question:${validation.reason}`,
        durationMs,
      });
    }

    return {
      question:
        validation.question,
      rendered: true,
      provider:
        "ollama",
      model,
      reason:
        "rendered",
      durationMs,
    };
  }

  return {
    render,
    model,
  };
}
