function createTimeoutError() {
  const error =
    new Error(
      "Timeout del Feedback Analyst local."
    );

  error.code =
    "FEEDBACK_ANALYST_TIMEOUT";

  error.providerStatus =
    504;

  return error;
}

function parseResponseText(value) {
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

function buildPrompt({
  snapshot,
}) {
  return [
    "Eres Feedback Analyst, una herramienta INTERNA de ingeniería y QA de HelpChat.",
    "No conversas con la persona usuaria y tu respuesta nunca se muestra en la UI.",
    "",
    "OBJETIVO PRINCIPAL:",
    "Analizar el comportamiento del SOFTWARE HelpChat y proponer mejoras de lógica, estado, grafos, clasificación, routing, recursos, UX, arquitectura, código y tests.",
    "",
    "CONTENIDO MÉDICO:",
    "Puedes usar conocimiento médico general cuando sea necesario para evaluar la lógica del producto.",
    "Puedes razonar sobre asociaciones generales entre síntomas, signos, observaciones clínicas y enfermedades.",
    "Ese razonamiento sólo sirve para evaluar o diseñar la lógica del SOFTWARE.",
    "No estás diagnosticando a la persona concreta de la conversación.",
    "No concluyas qué enfermedad tiene una persona.",
    "No asignes probabilidades diagnósticas individuales.",
    "No recomiendes tratamientos a la persona.",
    "Una asociación médica general nunca debe convertirse automáticamente en una conclusión clínica individual.",
    "",
    "EJEMPLO DE RAZONAMIENTO PERMITIDO:",
    "\"Una observación puede estar asociada a múltiples enfermedades; por tanto el software no debería resolverla directamente como diagnóstico y puede necesitar desambiguación.\"",
    "",
    "EJEMPLO NO PERMITIDO:",
    "\"Esta persona probablemente tiene la enfermedad X.\"",
    "",
    "BUSCA ESPECIALMENTE:",
    "- preguntas repetidas o bucles sin progreso;",
    "- pérdida o contaminación de contexto;",
    "- atribución a la persona incorrecta;",
    "- transiciones de grafo incorrectas;",
    "- inferencias excesivamente fuertes;",
    "- asociaciones o categorías insuficientes;",
    "- recursos incorrectos;",
    "- contradicciones entre input, context_before y context_after;",
    "- discrepancias entre runtime_metadata y comportamiento visible;",
    "- regresiones reproducibles.",
    "",
    "No asumas que el comentario del tester identifica correctamente la causa.",
    "Úsalo como evidencia junto con la conversación y el estado interno.",
    "",
    "IMPORTANTE:",
    "Además del problema reportado, inspecciona TODA la captura buscando otros defectos independientes.",
    "Compara input, output, context_before, context_after y runtime_metadata entre turnos.",
    "Si encuentras anomalías adicionales, inclúyelas en additionalFindings.",
    "No ocultes un segundo defecto sólo porque el tester informó de otro.",
    "Ejemplos: cambio de persona, territorio sin evidencia, pérdida de necesidades, transición incoherente o inferencia no justificada.",
    "",
    "Devuelve SOLO JSON.",
    "",
    "FORMA ESPERADA:",
    JSON.stringify({
      status:
        "analyzed",
      category:
        "repeated_question",
      confidence:
        0.95,
      summary:
        "Resumen técnico breve.",
      suspectedInvariants: [
        "invariant_name",
      ],
      suspectedComponents: [
        "component-name",
      ],
      evidenceTurnIds: [
        "turn-id",
      ],
      observedSoftwareBehavior:
        "Qué hizo el software.",
      expectedSoftwareBehavior:
        "Qué debería hacer.",
      safetyConstraints: {
        forbiddenSemanticLeaps: [
          "association -> individual diagnosis",
        ],
      },
      additionalFindings: [
        {
          category:
            "context_loss",
          confidence:
            0.9,
          summary:
            "Otro defecto independiente encontrado en la captura.",
          evidenceTurnIds: [
            "turn-id",
          ],
          suspectedComponents: [
            "component-name",
          ],
          regressionRecommended:
            true,
        },
      ],
      regressionCandidate: {
        recommended:
          true,
        fixtureType:
          "multi_turn",
      },
      solutionProposal: {
        summary:
          "Cambio lógico propuesto.",
        filesLikelyAffected: [
          "ruta/o/componente",
        ],
        risks: [
          "riesgo",
        ],
      },
    }),
    "",
    "CATEGORÍAS PERMITIDAS:",
    "repeated_question, wrong_person, context_loss, incorrect_inference, wrong_resources, invalid_transition, classification_error, latency, ux, other",
    "",
    "Si falta evidencia suficiente usa status=\"insufficient_evidence\".",
    "Si el caso no puede analizarse como comportamiento del producto usa status=\"invalid_scope\".",
    "",
    "CAPTURA COMPLETA DEL FEEDBACK:",
    JSON.stringify(
      snapshot,
    ),
  ].join("\n");
}

export function createHelpchatFeedbackAnalystLlmService({
  baseUrl =
    "http://127.0.0.1:11434",
  model =
    "qwen3:8b",
  timeoutMs =
    60000,
  keepAlive =
    "30m",
  numPredict =
    2048,
  fetchImpl =
    fetch,
} = {}) {
  const generateUrl =
    `${baseUrl.replace(/\/$/, "")}/api/generate`;

  async function analyze({
    snapshot,
  } = {}) {
    if (
      !snapshot ||
      typeof snapshot !== "object"
    ) {
      const error =
        new Error(
          "snapshot es obligatorio."
        );

      error.code =
        "FEEDBACK_ANALYST_INVALID_INPUT";

      throw error;
    }

    const prompt =
      buildPrompt({
        snapshot,
      });

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
                prompt,
                stream: false,
                format: "json",
                keep_alive:
                  keepAlive,
                options: {
                  temperature:
                    0.1,
                  num_predict:
                    numPredict,
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
          "No se pudo consultar Feedback Analyst."
        );

      wrapped.code =
        "FEEDBACK_ANALYST_ERROR";

      throw wrapped;
    } finally {
      clearTimeout(
        timer,
      );
    }

    if (!response.ok) {
      const error =
        new Error(
          `Feedback Analyst respondió HTTP ${response.status}.`
        );

      error.code =
        "FEEDBACK_ANALYST_HTTP_ERROR";

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

    if (
      !parsed ||
      typeof parsed !== "object"
    ) {
      const error =
        new Error(
          "Feedback Analyst devolvió JSON inválido."
        );

      error.code =
        "FEEDBACK_ANALYST_INVALID_RESPONSE";

      throw error;
    }

    const durationMs =
      Math.round(
        (
          performance.now() -
          startedAt
        ) * 10,
      ) / 10;

    return {
      analysis:
        parsed,
      provider:
        "ollama",
      model,
      durationMs,
      inputChars:
        prompt.length,
    };
  }

  return {
    analyze,
    model,
  };
}
