import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createHelpchatFeedbackAnalystLlmService,
} from "../services/helpchat-feedback-analyst-llm-service.js";

function sampleSnapshot() {
  return {
    feedback: {
      feedback_id: 6,
      reason_text:
        "Ha repetido la pregunta.",
      snapshot_through_turn_id:
        "turn-4",
    },

    turns: [
      {
        turn_id:
          "turn-3",
        sequence: 3,
        input_message:
          "le han encontrado una sombra en el pulmón",
        assistant_message:
          "¿Os han indicado ya alguna enfermedad?",
        context_before: {
          version: 2,
          pendingClarification: {
            node:
              "health_detail",
          },
        },
        context_after: {
          version: 2,
          pendingClarification: {
            node:
              "health_detail",
          },
        },
        runtime_metadata: {
          provider:
            "health_statement_authority",
          model:
            "health-statement-authority-v1",
        },
      },
      {
        turn_id:
          "turn-4",
        sequence: 4,
        input_message:
          "estamos observando los síntomas",
        assistant_message:
          "¿Os han indicado ya alguna enfermedad?",
        runtime_metadata: {
          status:
            "needs_clarification",
        },
      },
    ],
  };
}

describe(
  "helpchat feedback analyst llm service",
  () => {
    it(
      "envía al Analyst el snapshot completo",
      async () => {
        let requestBody =
          null;

        const service =
          createHelpchatFeedbackAnalystLlmService({
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
                        JSON.stringify({
                          status:
                            "analyzed",
                          category:
                            "repeated_question",
                          confidence:
                            0.98,
                          summary:
                            "Existe un bucle.",
                          suspectedInvariants: [
                            "informative_answer_must_advance",
                          ],
                          suspectedComponents: [
                            "health-statement-authority-v1",
                          ],
                          evidenceTurnIds: [
                            "turn-3",
                            "turn-4",
                          ],
                          observedSoftwareBehavior:
                            "Repite pregunta.",
                          expectedSoftwareBehavior:
                            "Debe avanzar.",
                        }),
                    };
                  },
                };
              },
          });

        const snapshot =
          sampleSnapshot();

        const result =
          await service.analyze({
            snapshot,
          });

        expect(
          result.analysis.category,
        ).toBe(
          "repeated_question",
        );

        expect(
          requestBody.prompt,
        ).toContain(
          "health-statement-authority-v1",
        );

        expect(
          requestBody.prompt,
        ).toContain(
          "estamos observando los síntomas",
        );

        expect(
          requestBody.prompt,
        ).toContain(
          "context_before",
        );

        expect(
          requestBody.prompt,
        ).toContain(
          "runtime_metadata",
        );
      },
    );

    it(
      "permite conocimiento médico para lógica pero prohíbe diagnóstico individual",
      async () => {
        let prompt =
          "";

        const service =
          createHelpchatFeedbackAnalystLlmService({
            fetchImpl:
              async (
                url,
                options,
              ) => {
                prompt =
                  JSON.parse(
                    options.body,
                  ).prompt;

                return {
                  ok: true,
                  async json() {
                    return {
                      response:
                        '{"status":"insufficient_evidence","category":"other","confidence":0.5,"summary":"Falta evidencia","observedSoftwareBehavior":"No concluyente","expectedSoftwareBehavior":"Conservar estado"}',
                    };
                  },
                };
              },
          });

        await service.analyze({
          snapshot:
            sampleSnapshot(),
        });

        expect(prompt).toContain(
          "Puedes usar conocimiento médico general",
        );

        expect(prompt).toContain(
          "No concluyas qué enfermedad tiene una persona",
        );

        expect(prompt).toContain(
          "lógica del SOFTWARE",
        );
      },
    );

    it(
      "usa un presupuesto amplio y JSON estructurado",
      async () => {
        let body =
          null;

        const service =
          createHelpchatFeedbackAnalystLlmService({
            numPredict:
              2500,
            keepAlive:
              "45m",
            fetchImpl:
              async (
                url,
                options,
              ) => {
                body =
                  JSON.parse(
                    options.body,
                  );

                return {
                  ok: true,
                  async json() {
                    return {
                      response:
                        '{"status":"analyzed","category":"other","confidence":0.6,"summary":"x","observedSoftwareBehavior":"x","expectedSoftwareBehavior":"y"}',
                    };
                  },
                };
              },
          });

        await service.analyze({
          snapshot:
            sampleSnapshot(),
        });

        expect(
          body.format,
        ).toBe(
          "json",
        );

        expect(
          body.stream,
        ).toBe(false);

        expect(
          body.options.num_predict,
        ).toBe(2500);

        expect(
          body.keep_alive,
        ).toBe(
          "45m",
        );
      },
    );

    it(
      "rechaza respuesta que no contiene JSON utilizable",
      async () => {
        const service =
          createHelpchatFeedbackAnalystLlmService({
            fetchImpl:
              async () => ({
                ok: true,
                async json() {
                  return {
                    response:
                      "No tengo JSON.",
                  };
                },
              }),
          });

        await expect(
          service.analyze({
            snapshot:
              sampleSnapshot(),
          }),
        ).rejects.toMatchObject({
          code:
            "FEEDBACK_ANALYST_INVALID_RESPONSE",
        });
      },
    );
  },
);

it(
  "pide analizar defectos adicionales aunque el tester reporte otro problema",
  async () => {
    let prompt = "";

    const service =
      createHelpchatFeedbackAnalystLlmService({
        fetchImpl:
          async (
            url,
            options,
          ) => {
            prompt =
              JSON.parse(
                options.body,
              ).prompt;

            return {
              ok: true,
              async json() {
                return {
                  response:
                    JSON.stringify({
                      status:
                        "analyzed",
                      category:
                        "repeated_question",
                      confidence:
                        0.95,
                      summary:
                        "Pregunta repetida.",
                      observedSoftwareBehavior:
                        "Pregunta repetida.",
                      expectedSoftwareBehavior:
                        "Avanzar.",
                      additionalFindings: [
                        {
                          category:
                            "context_loss",
                          confidence:
                            0.9,
                          summary:
                            "Cambio territorial no justificado.",
                        },
                      ],
                    }),
                };
              },
            };
          },
      });

    const result =
      await service.analyze({
        snapshot:
          sampleSnapshot(),
      });

    expect(prompt).toContain(
      "inspecciona TODA la captura",
    );

    expect(prompt).toContain(
      "additionalFindings",
    );

    expect(
      result.analysis
        .additionalFindings[0]
        .category,
    ).toBe(
      "context_loss",
    );
  },
);
