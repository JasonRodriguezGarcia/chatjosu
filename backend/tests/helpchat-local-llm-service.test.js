import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createHelpchatLocalLlmService,
} from "../services/helpchat-local-llm-service.js";

function candidateList() {
  return [
    {
      tagId: 25,
      tag:
        "INSERCIÓN LABORAL",
      score: 0.61,
    },
    {
      tagId: 31,
      tag:
        "SALUD MENTAL",
      score: 0.59,
    },
  ];
}

describe(
  "helpchat local llm service",
  () => {
    it(
      "resolves only among supplied embedding candidates",
      async () => {
        const calls = [];

        const service =
          createHelpchatLocalLlmService({
            model:
              "qwen3:8b",
            fetchImpl:
              async (
                url,
                options,
              ) => {
                calls.push({
                  url,
                  body:
                    JSON.parse(
                      options.body,
                    ),
                });

                return {
                  ok: true,
                  async json() {
                    return {
                      response:
                        '{"status":"resolved","option":1}',
                    };
                  },
                };
              },
          });

        const result =
          await service.classify({
            taskContext: {
              version: 1,
              task:
                "classify_need",
              message:
                "También ha perdido el trabajo",
              focus: {
                relationship:
                  "hermano",
                needs: [
                  "ALCOHOLISMO",
                ],
              },
            },
            candidates:
              candidateList(),
          });

        expect(result).toMatchObject({
          status:
            "resolved",
          tag: {
            tag_id: 25,
            descripcion:
              "INSERCIÓN LABORAL",
          },
          provider:
            "ollama",
          model:
            "qwen3:8b",
        });

        expect(calls).toHaveLength(1);

        expect(
          calls[0].body.stream,
        ).toBe(false);

        expect(
          calls[0].body.format,
        ).toBe("json");

        expect(
          calls[0].body.prompt,
        ).toContain(
          "INSERCIÓN LABORAL",
        );

        expect(
          calls[0].body.prompt,
        ).toContain(
          "SALUD MENTAL",
        );
      },
    );

    it(
      "returns clarification when model declines candidates",
      async () => {
        const service =
          createHelpchatLocalLlmService({
            fetchImpl:
              async () => ({
                ok: true,
                async json() {
                  return {
                    response:
                      '{"status":"needs_clarification","option":null}',
                  };
                },
              }),
          });

        const result =
          await service.classify({
            taskContext: {
              task:
                "classify_need",
              message:
                "Está fatal",
            },
            candidates:
              candidateList(),
          });

        expect(
          result.status,
        ).toBe(
          "needs_clarification",
        );

        expect(
          result.tag,
        ).toBeNull();
      },
    );

    it(
      "rejects an option outside supplied candidates",
      async () => {
        const service =
          createHelpchatLocalLlmService({
            fetchImpl:
              async () => ({
                ok: true,
                async json() {
                  return {
                    response:
                      '{"status":"resolved","option":99}',
                  };
                },
              }),
          });

        const result =
          await service.classify({
            taskContext: {
              task:
                "classify_need",
              message:
                "Necesita algo",
            },
            candidates:
              candidateList(),
          });

        expect(
          result.status,
        ).toBe(
          "needs_clarification",
        );

        expect(
          result.tag,
        ).toBeNull();
      },
    );

    it(
      "does not call Ollama when there are no candidates",
      async () => {
        let called = false;

        const service =
          createHelpchatLocalLlmService({
            fetchImpl:
              async () => {
                called = true;
                throw new Error(
                  "should not run",
                );
              },
          });

        const result =
          await service.classify({
            taskContext: {
              task:
                "classify_need",
              message:
                "Necesita ayuda",
            },
            candidates: [],
          });

        expect(
          called,
        ).toBe(false);

        expect(
          result.status,
        ).toBe(
          "needs_clarification",
        );
      },
    );

    it(
      "accepts JSON embedded in surrounding model text",
      async () => {
        const service =
          createHelpchatLocalLlmService({
            fetchImpl:
              async () => ({
                ok: true,
                async json() {
                  return {
                    response:
                      'Resultado: {"status":"resolved","option":2}',
                  };
                },
              }),
          });

        const result =
          await service.classify({
            taskContext: {
              task:
                "classify_need",
              message:
                "No duerme y está muy triste",
            },
            candidates:
              candidateList(),
          });

        expect(
          result.tag.descripcion,
        ).toBe(
          "SALUD MENTAL",
        );
      },
    );
  },
);

it(
  "passes configured keep alive to Ollama",
  async () => {
    let requestBody = null;

    const service =
      createHelpchatLocalLlmService({
        keepAlive:
          "30m",
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
                    '{"status":"needs_clarification","option":null}',
                };
              },
            };
          },
      });

    await service.classify({
      taskContext: {
        task:
          "resolve_open_clarification",
        message:
          "Está mal",
      },
      candidates: [
        {
          tagId: 4,
          tag:
            "ALZHEIMER",
          score: 0.63,
        },
        {
          tagId: 31,
          tag:
            "SALUD MENTAL",
          score: 0.62,
        },
      ],
    });

    expect(
      requestBody.keep_alive,
    ).toBe(
      "30m",
    );
  },
);
