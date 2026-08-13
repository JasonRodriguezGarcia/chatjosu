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
  associationResponse,
  conversationContextV1,
  isLocationRequest,
  locationResponse,
  provincesResponse,
} from "../../test/helpchatTestUtils";

describe(
  "HelpChat clarification quick replies",
  () => {
    it(
      "renders public labels and sends the natural-language message",
      { timeout: 10000 },
      async () => {
        const requests = [];

        const context =
          conversationContextV1({
            province: "Gipuzkoa",
          });

        let iacallCount = 0;

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
                return provincesResponse();
              }

              if (
                isLocationRequest(url)
              ) {
                return locationResponse({
                  province:
                    "Gipuzkoa",
                });
              }

              iacallCount += 1;

              requests.push(
                JSON.parse(
                  options.body,
                ),
              );

              if (
                iacallCount === 1
              ) {
                return {
                  ok: true,
                  status: 200,

                  json:
                    async () => ({
                      status:
                        "needs_clarification",

                      needsClarification:
                        true,

                      clarificationQuestion:
                        "¿Sobre qué situación necesitas orientación principalmente?",

                      quickReplies: [
                        {
                          id:
                            "housing",
                          label:
                            "Vivienda",
                          message:
                            "Necesito orientación sobre vivienda",
                        },
                        {
                          id:
                            "employment",
                          label:
                            "Empleo",
                          message:
                            "Necesito orientación sobre empleo",
                        },
                      ],

                      tag: null,

                      context,

                      requestedProvince:
                        "Gipuzkoa",

                      resolvedProvince:
                        "Gipuzkoa",

                      effectiveProvince:
                        "Gipuzkoa",

                      associations: [],

                      durationMs:
                        10,
                    }),
                };
              }

              return associationResponse({
                associationId:
                  "quick-reply-result",
              });
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
            "¿Sobre qué situación necesitas orientación principalmente?",
          ),
        ).toBeInTheDocument();

        const housing =
          screen.getByRole(
            "button",
            {
              name:
                "Vivienda",
            },
          );

        expect(
          housing,
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Empleo",
            },
          ),
        ).toBeInTheDocument();

        fireEvent.click(
          housing,
        );

        await waitFor(() => {
          expect(
            iacallCount,
          ).toBe(2);
        });

        expect(
          requests[1],
        ).toMatchObject({
          inputMessage:
            "Necesito orientación sobre vivienda",

          selectedProvincia:
            "Gipuzkoa",

          conversationContext:
            context,
        });

        expect(
          await screen.findByText(
            "Necesito orientación sobre vivienda",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "housing",
          ),
        ).not.toBeInTheDocument();
      },
    );

    it(
      "does not show provisional resources when clarification includes quick replies",
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
                return provincesResponse();
              }

              if (
                isLocationRequest(url)
              ) {
                return locationResponse({
                  province:
                    "Burgos",
                });
              }

              const base =
                await associationResponse().json();

              return {
                ok: true,
                status: 200,

                json:
                  async () => ({
                    ...base,

                    status:
                      "needs_clarification",

                    needsClarification:
                      true,

                    clarificationQuestion:
                      "¿Para quién estás buscando la ayuda?",

                    quickReplies: [
                      {
                        id:
                          "self",
                        label:
                          "Para mí",
                        message:
                          "Busco ayuda para mí",
                      },
                      {
                        id:
                          "other_person",
                        label:
                          "Para otra persona",
                        message:
                          "Busco ayuda para otra persona",
                      },
                    ],
                  }),
              };
            },
          );

        render(<HelpChat />);

        await screen.findByRole(
          "combobox",
          {
            name:
              /Provincia actual.*Burgos/i,
          },
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Necesito ayuda para un familiar",
            },
          ),
        );

        expect(
          await screen.findByRole(
            "button",
            {
              name:
                "Para mí",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Para otra persona",
            },
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Recursos que pueden orientarte",
          ),
        ).not.toBeInTheDocument();
      },
    );

    it(
      "ignores malformed quick replies from the backend",
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
                return provincesResponse();
              }

              if (
                isLocationRequest(url)
              ) {
                return locationResponse({
                  province:
                    "Burgos",
                });
              }

              return {
                ok: true,
                status: 200,

                json:
                  async () => ({
                    status:
                      "needs_clarification",

                    needsClarification:
                      true,

                    clarificationQuestion:
                      "Cuéntame un poco más.",

                    quickReplies: [
                      null,
                      {
                        id:
                          "broken",
                        label:
                          "No debe verse",
                      },
                    ],

                    associations:
                      [],

                    durationMs:
                      5,
                  }),
              };
            },
          );

        render(<HelpChat />);

        await screen.findByRole(
          "combobox",
          {
            name:
              /Provincia actual.*Burgos/i,
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
            "Cuéntame un poco más.",
          ),
        ).toBeInTheDocument();

        expect(
          screen.queryByRole(
            "button",
            {
              name:
                "No debe verse",
            },
          ),
        ).not.toBeInTheDocument();
      },
    );
  },
);
