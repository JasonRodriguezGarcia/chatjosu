import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import HelpChat from "../HelpChat";

import {
  associationResponse,
  deferred,
  isIacallRequest,
  isLocationRequest,
  isTesterFeedbackRequest,
  isTesterSessionRequest,
  isTesterTurnRequest,
  jsonResponse,
  locationResponse,
  provincesResponse,
} from "../../test/helpchatTestUtils";

describe(
  "HelpChat Tester Capture",
  () => {
    beforeEach(() => {
      window.history.replaceState(
        {},
        "",
        "/?tester=1",
      );
    });

    it(
      "crea una sesión y captura el turno sin bloquear la respuesta visible",
      async () => {
        const pendingTurnCapture =
          deferred();

        const testerBodies = {
          session: [],
          turn: [],
        };

        globalThis.fetch =
          vi.fn(
            (
              url,
              options = {},
            ) => {
              if (
                String(url).includes(
                  "/provincias",
                )
              ) {
                return Promise.resolve(
                  provincesResponse(),
                );
              }

              if (
                isLocationRequest(url)
              ) {
                return Promise.resolve(
                  locationResponse({
                    province:
                      "Burgos",
                  }),
                );
              }

              if (
                isTesterSessionRequest(
                  url,
                )
              ) {
                testerBodies.session.push(
                  JSON.parse(
                    options.body,
                  ),
                );

                return Promise.resolve(
                  jsonResponse(
                    {
                      version: 1,
                      status:
                        "ok",
                    },
                    {
                      status: 201,
                    },
                  ),
                );
              }

              if (
                isTesterTurnRequest(
                  url,
                )
              ) {
                testerBodies.turn.push(
                  JSON.parse(
                    options.body,
                  ),
                );

                return pendingTurnCapture
                  .promise;
              }

              if (
                isIacallRequest(url)
              ) {
                return Promise.resolve(
                  associationResponse({
                    name:
                      "Recurso tester",
                  }),
                );
              }

              throw new Error(
                `Unexpected URL: ${url}`,
              );
            },
          );

        render(
          <HelpChat />,
        );

        await screen.findByRole(
          "combobox",
          {
            name:
              /Provincia actual.*Burgos/i,
          },
        );

        const input =
          screen.getByRole(
            "textbox",
            {
              name:
                /Escribe qué necesitas/i,
            },
          );

        fireEvent.change(
          input,
          {
            target: {
              value:
                "Necesito orientación",
            },
          },
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Enviar",
            },
          ),
        );

        await screen.findByText(
          /He encontrado un recurso/i,
        );

        expect(
          testerBodies.session,
        ).toHaveLength(1);

        await waitFor(
          () => {
            expect(
              testerBodies.turn,
            ).toHaveLength(1);
          },
        );

        expect(
          testerBodies.turn[0],
        ).toMatchObject({
          sequence: 1,
          inputMessage:
            "Necesito orientación",
          assistantMessage:
            expect.any(String),
          runtimeMetadata: {
            tag:
              "BIENESTAR SOCIAL",
          },
        });

        expect(
          testerBodies.turn[0]
            .sessionId,
        ).toBe(
          testerBodies.session[0]
            .sessionId,
        );

        expect(
          testerBodies.turn[0]
            .turnId,
        ).toMatch(
          /^turn-/,
        );

        // La respuesta ya se ha mostrado aunque
        // la persistencia Tester Capture siga pendiente.
        expect(
          screen.getByText(
            /He encontrado un recurso/i,
          ),
        ).toBeInTheDocument();

        pendingTurnCapture.resolve(
          jsonResponse(
            {
              version: 1,
              status:
                "created",
            },
            {
              status: 201,
            },
          ),
        );

        await waitFor(() => {
          expect(
            screen.getByRole(
              "button",
              {
                name:
                  "Reportar un problema en esta conversación",
              },
            ),
          ).not.toBeDisabled();
        });
      },
    );

    it(
      "preserva el mismo turnId al reintentar un iacall fallido",
      async () => {
        let iacallCount = 0;
        const turnBodies = [];

        globalThis.fetch =
          vi.fn(
            (
              url,
              options = {},
            ) => {
              if (
                String(url).includes(
                  "/provincias",
                )
              ) {
                return Promise.resolve(
                  provincesResponse(),
                );
              }

              if (
                isLocationRequest(url)
              ) {
                return Promise.resolve(
                  locationResponse({
                    province:
                      "Burgos",
                  }),
                );
              }

              if (
                isTesterSessionRequest(
                  url,
                )
              ) {
                return Promise.resolve(
                  jsonResponse(
                    {
                      status:
                        "ok",
                    },
                    {
                      status: 201,
                    },
                  ),
                );
              }

              if (
                isTesterTurnRequest(
                  url,
                )
              ) {
                turnBodies.push(
                  JSON.parse(
                    options.body,
                  ),
                );

                return Promise.resolve(
                  jsonResponse(
                    {
                      status:
                        "created",
                    },
                    {
                      status: 201,
                    },
                  ),
                );
              }

              if (
                isIacallRequest(url)
              ) {
                iacallCount += 1;

                if (
                  iacallCount === 1
                ) {
                  return Promise.resolve(
                    jsonResponse(
                      {
                        error:
                          "fallo",
                      },
                      {
                        ok: false,
                        status: 500,
                      },
                    ),
                  );
                }

                return Promise.resolve(
                  associationResponse(),
                );
              }

              throw new Error(
                `Unexpected URL: ${url}`,
              );
            },
          );

        vi.spyOn(
          console,
          "error",
        ).mockImplementation(
          () => {},
        );

        render(
          <HelpChat />,
        );

        await screen.findByRole(
          "combobox",
          {
            name:
              /Provincia actual.*Burgos/i,
          },
        );

        const input =
          screen.getByRole(
            "textbox",
            {
              name:
                /Escribe qué necesitas/i,
            },
          );

        fireEvent.change(
          input,
          {
            target: {
              value:
                "Mensaje tester",
            },
          },
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Enviar",
            },
          ),
        );

        const retry =
          await screen.findByRole(
            "button",
            {
              name:
                "Reintentar",
            },
          );

        fireEvent.click(
          retry,
        );

        await waitFor(
          () => {
            expect(
              turnBodies,
            ).toHaveLength(1);
          },
        );

        expect(
          iacallCount,
        ).toBe(2);

        expect(
          turnBodies[0].sequence,
        ).toBe(1);

        expect(
          turnBodies[0].turnId,
        ).toMatch(
          /^turn-/,
        );
      },
    );
  },
);

describe(
  "HelpChat inline tester feedback",
  () => {
    it(
      "convierte el compositor en reporte y conserva el snapshot seleccionado",
      async () => {
        window.history.replaceState(
          {},
          "",
          "/?tester=1",
        );

        const turnBodies = [];
        const feedbackBodies = [];

        globalThis.fetch =
          vi.fn(
            (
              url,
              options = {},
            ) => {
              if (
                String(url).includes(
                  "/provincias",
                )
              ) {
                return Promise.resolve(
                  provincesResponse(),
                );
              }

              if (
                isLocationRequest(url)
              ) {
                return Promise.resolve(
                  locationResponse({
                    province:
                      "Burgos",
                  }),
                );
              }

              if (
                isTesterSessionRequest(
                  url,
                )
              ) {
                return Promise.resolve(
                  jsonResponse(
                    {
                      status:
                        "ok",
                    },
                    {
                      status: 201,
                    },
                  ),
                );
              }

              if (
                isTesterTurnRequest(
                  url,
                )
              ) {
                turnBodies.push(
                  JSON.parse(
                    options.body,
                  ),
                );

                return Promise.resolve(
                  jsonResponse(
                    {
                      status:
                        "created",
                    },
                    {
                      status: 201,
                    },
                  ),
                );
              }

              if (
                isTesterFeedbackRequest(
                  url,
                )
              ) {
                feedbackBodies.push(
                  JSON.parse(
                    options.body,
                  ),
                );

                return Promise.resolve(
                  jsonResponse(
                    {
                      status:
                        "ok",
                      feedbackId: 1,
                      reviewStatus:
                        "pending",
                    },
                    {
                      status: 201,
                    },
                  ),
                );
              }

              if (
                isIacallRequest(url)
              ) {
                return Promise.resolve(
                  associationResponse(),
                );
              }

              throw new Error(
                `Unexpected URL: ${url}`,
              );
            },
          );

        render(
          <HelpChat />,
        );

        await screen.findByRole(
          "combobox",
          {
            name:
              /Provincia actual.*Burgos/i,
          },
        );

        const composer =
          screen.getByRole(
            "textbox",
            {
              name:
                /Escribe qué necesitas/i,
            },
          );

        fireEvent.change(
          composer,
          {
            target: {
              value:
                "Mensaje con problema",
            },
          },
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Enviar",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              turnBodies,
            ).toHaveLength(1);
          },
        );

        const capturedTurnId =
          turnBodies[0].turnId;

        const reportButton =
          screen.getByRole(
            "button",
            {
              name:
                "Reportar un problema en esta conversación",
            },
          );

        expect(
          reportButton,
        ).not.toBeDisabled();

        fireEvent.click(
          reportButton,
        );

        expect(
          screen.getByText(
            "⚑ Estás reportando un problema",
          ),
        ).toBeInTheDocument();

        const reportComposer =
          screen.getByRole(
            "textbox",
            {
              name:
                "¿Qué ha ocurrido? ¿Cuál es el error que has detectado?",
            },
          );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Cancelar reporte de problema",
            },
          ),
        ).toBeInTheDocument();

        fireEvent.change(
          reportComposer,
          {
            target: {
              value:
                "Ha repetido la misma pregunta. Esperaba que avanzase.",
            },
          },
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Enviar error",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              feedbackBodies,
            ).toHaveLength(1);
          },
        );

        expect(
          feedbackBodies[0],
        ).toMatchObject({
          snapshotThroughTurnId:
            capturedTurnId,
          anchorTurnIds: [],
          category:
            "other",
          reasonText:
            "Ha repetido la misma pregunta. Esperaba que avanzase.",
          expectedText:
            null,
          reasonSource:
            "text",
        });
      },
    );

    it(
      "permite dictar el reporte revisar la transcripción y lo registra como speech",
      async () => {
        window.history.replaceState(
          {},
          "",
          "/?tester=1",
        );

        let recognitionInstance =
          null;

        class FakeSpeechRecognition {
          constructor() {
            recognitionInstance =
              this;

            this.lang = "";
            this.interimResults =
              false;
            this.continuous =
              false;
          }

          start() {
            this.onstart?.();
          }

          stop() {
            this.onend?.();
          }

          abort() {
            this.onend?.();
          }
        }

        globalThis.SpeechRecognition =
          FakeSpeechRecognition;

        const turnBodies = [];
        const feedbackBodies = [];

        globalThis.fetch =
          vi.fn(
            (
              url,
              options = {},
            ) => {
              if (
                String(url).includes(
                  "/provincias",
                )
              ) {
                return Promise.resolve(
                  provincesResponse(),
                );
              }

              if (
                isLocationRequest(url)
              ) {
                return Promise.resolve(
                  locationResponse({
                    province:
                      "Burgos",
                  }),
                );
              }

              if (
                isTesterSessionRequest(
                  url,
                )
              ) {
                return Promise.resolve(
                  jsonResponse(
                    {
                      status:
                        "ok",
                    },
                    {
                      status: 201,
                    },
                  ),
                );
              }

              if (
                isTesterTurnRequest(
                  url,
                )
              ) {
                turnBodies.push(
                  JSON.parse(
                    options.body,
                  ),
                );

                return Promise.resolve(
                  jsonResponse(
                    {
                      status:
                        "created",
                    },
                    {
                      status: 201,
                    },
                  ),
                );
              }

              if (
                isTesterFeedbackRequest(
                  url,
                )
              ) {
                feedbackBodies.push(
                  JSON.parse(
                    options.body,
                  ),
                );

                return Promise.resolve(
                  jsonResponse(
                    {
                      status:
                        "ok",
                      feedbackId: 2,
                      reviewStatus:
                        "pending",
                    },
                    {
                      status: 201,
                    },
                  ),
                );
              }

              if (
                isIacallRequest(url)
              ) {
                return Promise.resolve(
                  associationResponse(),
                );
              }

              throw new Error(
                `Unexpected URL: ${url}`,
              );
            },
          );

        render(
          <HelpChat />,
        );

        await screen.findByRole(
          "combobox",
          {
            name:
              /Provincia actual.*Burgos/i,
          },
        );

        const normalComposer =
          screen.getByRole(
            "textbox",
            {
              name:
                /Escribe qué necesitas/i,
            },
          );

        fireEvent.change(
          normalComposer,
          {
            target: {
              value:
                "Conversación de prueba",
            },
          },
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Enviar",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              turnBodies,
            ).toHaveLength(1);
          },
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Reportar un problema en esta conversación",
            },
          ),
        );

        const microphone =
          screen.getByRole(
            "button",
            {
              name:
                "Dictar reporte de problema",
            },
          );

        fireEvent.click(
          microphone,
        );

        expect(
          recognitionInstance,
        ).not.toBeNull();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Detener dictado",
            },
          ),
        ).toBeInTheDocument();

        const result = [
          {
            transcript:
              "ha repetido la misma pregunta",
          },
        ];

        result.isFinal =
          true;

        await act(
          async () => {
            recognitionInstance
              .onresult?.({
                resultIndex: 0,
                results: [
                  result,
                ],
              });
          },
        );

        const reportComposer =
          screen.getByRole(
            "textbox",
            {
              name:
                "¿Qué ha ocurrido? ¿Cuál es el error que has detectado?",
            },
          );

        expect(
          reportComposer,
        ).toHaveValue(
          "ha repetido la misma pregunta",
        );

        // El tester puede revisar o ampliar la transcripción.
        fireEvent.change(
          reportComposer,
          {
            target: {
              value:
                "Ha repetido la misma pregunta y esperaba que avanzase.",
            },
          },
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Enviar error",
            },
          ),
        );

        await waitFor(
          () => {
            expect(
              feedbackBodies,
            ).toHaveLength(1);
          },
        );

        expect(
          feedbackBodies[0],
        ).toMatchObject({
          snapshotThroughTurnId:
            turnBodies[0].turnId,
          reasonText:
            "Ha repetido la misma pregunta y esperaba que avanzase.",
          expectedText:
            null,
          reasonSource:
            "speech",
        });

        delete globalThis
          .SpeechRecognition;
      },
    );
  },
);
