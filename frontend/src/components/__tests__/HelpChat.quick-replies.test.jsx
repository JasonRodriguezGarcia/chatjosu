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
                            "employment",
                          label:
                            "Empleo",
                          message:
                            "Necesito orientación sobre empleo",
                          controlledReply: {
                            type:
                              "need_domain",
                            value:
                              "employment",
                          },
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
                "Necesito ayuda para un familiar",
            },
          ),
        );

        expect(
          await screen.findByText(
            "¿Sobre qué situación necesitas orientación principalmente?",
          ),
        ).toBeInTheDocument();

        const employment =
          screen.getByRole(
            "button",
            {
              name:
                "Empleo",
            },
          );

        expect(
          employment,
        ).toBeInTheDocument();

        fireEvent.click(
          employment,
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
            "Necesito orientación sobre empleo",

          selectedProvincia:
            "Gipuzkoa",

          conversationContext:
            context,

          controlledReply: {
            type:
              "need_domain",
            value:
              "employment",
          },
        });

        expect(
          await screen.findByText(
            "Necesito orientación sobre empleo",
          ),
        ).toBeInTheDocument();

        await waitFor(() => {
          expect(
            screen.queryByRole(
              "button",
              {
                name:
                  "Empleo",
              },
            ),
          ).not.toBeInTheDocument();
        });

        expect(
          iacallCount,
        ).toBe(2);

        fireEvent.click(
          employment,
        );

        expect(
          iacallCount,
        ).toBe(2);

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
                "Necesito ayuda para un familiar",
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

it(
  "preserves controlled reply metadata when retrying a failed quick reply",
  { timeout: 10000 },
  async () => {
    const requestBodies = [];
    let iacallCount = 0;

    const context =
      conversationContextV1({
        province: "Gipuzkoa",
      });

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

          requestBodies.push(
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
                        "employment",
                      label:
                        "Empleo",
                      message:
                        "Necesito orientación sobre empleo",
                      controlledReply: {
                        type:
                          "need_domain",
                        value:
                          "employment",
                      },
                    },
                  ],
                  context,
                  associations: [],
                  requestedProvince:
                    "Gipuzkoa",
                  resolvedProvince:
                    "Gipuzkoa",
                  durationMs: 5,
                }),
            };
          }

          if (
            iacallCount === 2
          ) {
            return {
              ok: false,
              status: 500,
            };
          }

          return associationResponse({
            associationId:
              "controlled-retry",
          });
        },
      );

    vi.spyOn(
      console,
      "error",
    ).mockImplementation(
      () => {},
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
            "Necesito ayuda para un familiar",
        },
      ),
    );

    const employment =
      await screen.findByRole(
        "button",
        {
          name: "Empleo",
        },
      );

    fireEvent.click(
      employment,
    );

    const retry =
      await screen.findByRole(
        "button",
        {
          name: "Reintentar",
        },
      );

    expect(
      requestBodies[1],
    ).toMatchObject({
      inputMessage:
        "Necesito orientación sobre empleo",
      selectedProvincia:
        "Gipuzkoa",
      conversationContext:
        context,
      controlledReply: {
        type:
          "need_domain",
        value:
          "employment",
      },
    });

    fireEvent.click(
      retry,
    );

    await waitFor(() => {
      expect(
        iacallCount,
      ).toBe(3);
    });

    expect(
      requestBodies[2],
    ).toMatchObject({
      inputMessage:
        "Necesito orientación sobre empleo",
      selectedProvincia:
        "Gipuzkoa",
      conversationContext:
        context,
      controlledReply: {
        type:
          "need_domain",
        value:
          "employment",
      },
    });
  },
);

it(
  "renders second-level emotional health quick replies",
  { timeout: 10000 },
  async () => {
    const requestBodies = [];
    let iacallCount = 0;

    const context =
      conversationContextV1({
        province: "Gipuzkoa",
      });

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

          requestBodies.push(
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
                        "emotional_health",
                      label:
                        "Salud emocional",
                      message:
                        "Necesito orientación sobre salud emocional",
                      controlledReply: {
                        type:
                          "clarification_choice",
                        node:
                          "need_type",
                        choice:
                          "emotional_health",
                      },
                    },
                  ],
                  context,
                  associations: [],
                  requestedProvince:
                    "Gipuzkoa",
                  resolvedProvince:
                    "Gipuzkoa",
                  durationMs: 2,
                }),
            };
          }

          if (
            iacallCount === 2
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
                    "¿Qué es lo que más te preocupa: el ánimo o la ansiedad, el sueño, cambios de conducta, u otra situación?",
                  quickReplies: [
                    {
                      id:
                        "mood_anxiety",
                      label:
                        "Ánimo o ansiedad",
                      message:
                        "Lo que más preocupa es el ánimo o la ansiedad",
                      controlledReply: {
                        type:
                          "need_domain",
                        value:
                          "mental_mood_anxiety",
                      },
                    },
                    {
                      id:
                        "sleep",
                      label:
                        "Sueño",
                      message:
                        "Lo que más preocupa es el sueño",
                      controlledReply: {
                        type:
                          "clarification_choice",
                        node:
                          "mental_health_detail",
                        choice:
                          "sleep",
                      },
                    },
                    {
                      id:
                        "behavior_changes",
                      label:
                        "Cambios de conducta",
                      message:
                        "Lo que más preocupa son los cambios de conducta",
                      controlledReply: {
                        type:
                          "need_domain",
                        value:
                          "mental_behavior_changes",
                      },
                    },
                    {
                      id:
                        "mental_other",
                      label:
                        "Otra situación",
                      message:
                        "Quiero contarte otra situación relacionada con la salud emocional",
                      controlledReply: {
                        type:
                          "need_domain",
                        value:
                          "mental_other",
                      },
                    },
                  ],
                  context,
                  associations: [],
                  requestedProvince:
                    "Gipuzkoa",
                  resolvedProvince:
                    "Gipuzkoa",
                  durationMs: 1,
                }),
            };
          }

          return associationResponse({
            associationId:
              "mental-sleep-result",
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
            "Necesito ayuda para un familiar",
        },
      ),
    );

    const emotionalHealth =
      await screen.findByRole(
        "button",
        {
          name:
            "Salud emocional",
        },
      );

    fireEvent.click(
      emotionalHealth,
    );

    expect(
      await screen.findByText(
        /Qué es lo que más te preocupa/i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole(
        "button",
        {
          name:
            "Ánimo o ansiedad",
        },
      ),
    ).toBeInTheDocument();

    const sleep =
      screen.getByRole(
        "button",
        {
          name:
            "Sueño",
        },
      );

    expect(
      sleep,
    ).toBeInTheDocument();

    expect(
      screen.getByRole(
        "button",
        {
          name:
            "Cambios de conducta",
        },
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      sleep,
    );

    await waitFor(() => {
      expect(
        iacallCount,
      ).toBe(3);
    });

    expect(
      requestBodies[2],
    ).toMatchObject({
      inputMessage:
        "Lo que más preocupa es el sueño",
      selectedProvincia:
        "Gipuzkoa",
      controlledReply: {
        type:
          "clarification_choice",
        node:
          "mental_health_detail",
        choice:
          "sleep",
      },
    });

    await waitFor(() => {
      expect(
        screen.queryByRole(
          "button",
          {
            name:
              "Sueño",
          },
        ),
      ).not.toBeInTheDocument();
    });
  },
);
