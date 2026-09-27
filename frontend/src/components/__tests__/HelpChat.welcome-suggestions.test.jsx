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
  {
    label:
      "Necesito ayuda para un familiar",
    controlledReply:
      null,
  },
  {
    label:
      "Un problema de salud",
    controlledReply: {
      type:
        "clarification_choice",
      node:
        "need_type",
      choice:
        "health",
    },
  },
  {
    label:
      "Trabajo o empleo",
    controlledReply: {
      type:
        "clarification_choice",
      node:
        "need_type",
      choice:
        "employment",
    },
  },
  {
    label:
      "Me preocupa cómo me siento",
    controlledReply: {
      type:
        "clarification_choice",
      node:
        "need_type",
      choice:
        "emotional_health",
    },
  },
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
    for (const starter of STARTERS) {
      it(
        `sends typed starter immediately: ${starter.label}`,
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
                  starter.label,
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
              starter.label,
            selectedProvincia:
              "Gipuzkoa",
          });

          if (starter.controlledReply) {
            expect(
              requestBodies[0]
                .controlledReply,
            ).toEqual(
              starter.controlledReply,
            );
          } else {
            expect(
              requestBodies[0],
            ).not.toHaveProperty(
              "controlledReply",
            );
          }

          expect(
            await screen.findByText(
              starter.label,
            ),
          ).toBeInTheDocument();
        },
      );
    }

    it(
      "does not expose the redundant generic social-orientation starter",
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

        expect(
          screen.queryByRole(
            "button",
            {
              name:
                "Busco orientación social",
            },
          ),
        ).not.toBeInTheDocument();
      },
    );
  },
);
