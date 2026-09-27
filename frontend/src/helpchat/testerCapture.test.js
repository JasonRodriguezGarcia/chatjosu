import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  cloneTesterSnapshot,
  createHelpchatTesterCaptureClient,
  createTesterId,
  isHelpchatTesterModeEnabled,
  projectTesterRuntimeMetadata,
} from "./testerCapture";

describe(
  "HelpChat Tester Capture",
  () => {
    it(
      "activa tester sólo mediante señal explícita",
      () => {
        expect(
          isHelpchatTesterModeEnabled(
            "?tester=1",
          ),
        ).toBe(true);

        expect(
          isHelpchatTesterModeEnabled(
            "?tester=true",
          ),
        ).toBe(true);

        expect(
          isHelpchatTesterModeEnabled(
            "?foo=1",
          ),
        ).toBe(false);
      },
    );

    it(
      "genera IDs independientes de mensajes UI",
      () => {
        const target = {
          crypto: {
            randomUUID: () =>
              "uuid-123",
          },
        };

        expect(
          createTesterId(
            "turn",
            target,
          ),
        ).toBe(
          "turn-uuid-123",
        );
      },
    );

    it(
      "clona snapshots sin compartir referencias",
      () => {
        const source = {
          version: 2,
          person: {
            id:
              "person_1",
          },
        };

        const result =
          cloneTesterSnapshot(
            source,
          );

        source.person.id =
          "self";

        expect(
          result.person.id,
        ).toBe(
          "person_1",
        );
      },
    );

    it(
      "proyecta sólo metadata runtime útil",
      () => {
        const result =
          projectTesterRuntimeMetadata(
            {
              status:
                "needs_clarification",
              provider:
                "health_statement_authority",
              model:
                "health-statement-authority-v1",
              durationMs:
                31,
              quickReplies: [
                {
                  id:
                    "choice-a",
                },
              ],
              associations: [
                {
                  huge:
                    "not persisted here",
                },
              ],
            },
            {
              roundTripMs:
                45,
              selectedProvincia:
                "Bizkaia",
            },
          );

        expect(
          result.status,
        ).toBe(
          "needs_clarification",
        );

        expect(
          result.quickReplyIds,
        ).toEqual([
          "choice-a",
        ]);

        expect(
          result.roundTripMs,
        ).toBe(45);

        expect(
          result,
        ).not.toHaveProperty(
          "associations",
        );
      },
    );

    it(
      "retry de captura no bloqueante puede recuperarse de un 500",
      async () => {
        const fetchImpl =
          vi.fn()
            .mockResolvedValueOnce({
              ok: false,
              status: 500,
            })
            .mockResolvedValueOnce({
              ok: true,
              status: 201,
              json:
                async () => ({
                  status:
                    "created",
                }),
            });

        const client =
          createHelpchatTesterCaptureClient({
            fetchImpl,
            retries: 1,
          });

        const result =
          await client.appendTurn({
            turnId:
              "turn-1",
          });

        expect(
          result.status,
        ).toBe(
          "created",
        );

        expect(
          fetchImpl,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );

    it(
      "no reintenta errores de contrato",
      async () => {
        const fetchImpl =
          vi.fn()
            .mockResolvedValue({
              ok: false,
              status: 400,
            });

        const client =
          createHelpchatTesterCaptureClient({
            fetchImpl,
            retries: 1,
          });

        await expect(
          client.appendTurn({
            turnId:
              "turn-1",
          }),
        ).rejects.toThrow(
          "HTTP 400",
        );

        expect(
          fetchImpl,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );
  },
);
