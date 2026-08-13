import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import HelpChat from "../HelpChat";

import {
  isLocationRequest,
  jsonResponse,
  locationResponse,
} from "../../test/helpchatTestUtils";

const STARTERS = [
  "Necesito ayuda para un familiar",
  "Busco orientación social",
  "Necesito apoyo relacionado con una enfermedad",
];

function gipuzkoaProvincesResponse() {
  return jsonResponse([
    {
      province_key: "GUIPUZCOA",
      name: "Gipuzkoa",
      label: "Gipuzkoa",
    },
  ]);
}

function usefulClarificationResponse(
  question = "¿Puedes contarme un poco más sobre el tipo de ayuda que necesitas?",
) {
  return jsonResponse({
    status: "needs_clarification",
    needsClarification: true,
    clarificationQuestion: question,
    message: question,
    tag: null,

    context: {
      version: 1,
      subject: {
        relationship: null,
      },
      activeNeeds: [],
      currentGoal: null,
      facts: [],
      constraints: [],
      territory: {
        province: "Gipuzkoa",
        municipality: null,
      },
      resourcesShown: [],
    },

    requestedProvince: "Gipuzkoa",
    resolvedProvince: "Gipuzkoa",
    effectiveProvince: "Gipuzkoa",

    needsLocation: false,
    locationReason: null,

    fallbackUsed: false,
    fallbackType: null,

    localCount: 0,
    neighborCount: 0,
    nationalCount: 0,

    associations: [],
    provider: "rule",
    model: "test",
    durationMs: 10,
  });
}

describe(
  "HelpChat welcome suggestions",
  () => {
    for (const suggestion of STARTERS) {
      it(
        `sends starter immediately: ${suggestion}`,
        { timeout: 10000 },
        async () => {
          const requestBodies = [];

          globalThis.fetch =
            vi.fn(
              async (
                url,
                options = {},
              ) => {
                if (
                  String(url).includes(
                    "/provincias",
                  )
                ) {
                  return gipuzkoaProvincesResponse();
                }

                if (
                  isLocationRequest(url)
                ) {
                  return locationResponse({
                    province:
                      "Gipuzkoa",
                    provinceKey:
                      "GUIPUZCOA",
                  });
                }

                requestBodies.push(
                  JSON.parse(
                    options.body,
                  ),
                );

                return usefulClarificationResponse();
              },
            );

          render(<HelpChat />);

          await screen.findByRole(
            "combobox",
            {
              name:
                /Provincia actual.*Gipuzkoa/i,
            },
          );

          fireEvent.click(
            screen.getByRole(
              "button",
              {
                name:
                  suggestion,
              },
            ),
          );

          await waitFor(() => {
            expect(
              requestBodies,
            ).toHaveLength(1);
          });

          expect(
            requestBodies[0],
          ).toMatchObject({
            inputMessage:
              suggestion,
            selectedProvincia:
              "Gipuzkoa",
          });

          expect(
            await screen.findByText(
              suggestion,
            ),
          ).toBeInTheDocument();

          expect(
            await screen.findByText(
              /puedes contarme un poco más/i,
            ),
          ).toBeInTheDocument();
        },
      );
    }

    it(
      "never leaves a starter interaction without a useful assistant outcome",
      { timeout: 10000 },
      async () => {
        globalThis.fetch =
          vi.fn(
            async (
              url,
            ) => {
              if (
                String(url).includes(
                  "/provincias",
                )
              ) {
                return gipuzkoaProvincesResponse();
              }

              if (
                isLocationRequest(url)
              ) {
                return locationResponse({
                  province:
                    "Gipuzkoa",
                  provinceKey:
                    "GUIPUZCOA",
                });
              }

              return usefulClarificationResponse(
                "¿Buscas apoyo para ti o para otra persona?",
              );
            },
          );

        render(<HelpChat />);

        await screen.findByRole(
          "combobox",
          {
            name:
              /Provincia actual.*Gipuzkoa/i,
          },
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Busco orientación social",
            },
          ),
        );

        expect(
          await screen.findByText(
            "¿Buscas apoyo para ti o para otra persona?",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            /ALCOHOLISMO|SALUD MENTAL|INSERCIÓN LABORAL/,
          ),
        ).not.toBeInTheDocument();
      },
    );
  },
);
