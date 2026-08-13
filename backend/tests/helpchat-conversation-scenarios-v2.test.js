import {
  describe,
  expect,
  it,
} from "vitest";

import {
  persistResolvedNeedsV2,
  prepareConversationMemoryV2,
} from "../helpchat/conversation-memory-v2.js";

import {
  createEmptyConversationContextV2,
} from "../helpchat/conversation-context-v2.js";

function person(
  context,
  relationship,
) {
  return context.people.find(
    (entry) =>
      entry.relationship ===
      relationship,
  );
}

describe(
  "HelpChat V2 conversation scenarios",
  () => {
    it(
      "L1 keeps one person across natural continuation",
      () => {
        let result =
          persistResolvedNeedsV2({
            conversationContext:
              createEmptyConversationContextV2(),

            inputMessage:
              "Mi hermano tiene problemas con el alcohol",

            resolvedNeeds: [
              "ALCOHOLISMO",
            ],
          });

        expect(
          result.status,
        ).toBe("resolved");

        expect(
          result.context.currentFocus,
        ).toBe("person_1");

        expect(
          person(
            result.context,
            "hermano",
          ).needs,
        ).toEqual([
          "ALCOHOLISMO",
        ]);

        result =
          persistResolvedNeedsV2({
            conversationContext:
              result.context,

            inputMessage:
              "También ha perdido el trabajo",

            resolvedNeeds: [
              "INSERCIÓN LABORAL",
            ],
          });

        expect(
          person(
            result.context,
            "hermano",
          ).needs,
        ).toEqual([
          "ALCOHOLISMO",
          "INSERCIÓN LABORAL",
        ]);

        expect(
          result.context.people,
        ).toHaveLength(2);
      },
    );

    it(
      "L2 keeps needs isolated between two people",
      () => {
        let result =
          persistResolvedNeedsV2({
            conversationContext:
              createEmptyConversationContextV2(),

            inputMessage:
              "Mi hermano tiene problemas con el alcohol",

            resolvedNeeds: [
              "ALCOHOLISMO",
            ],
          });

        result =
          persistResolvedNeedsV2({
            conversationContext:
              result.context,

            inputMessage:
              "Mi cuñado está a punto de perder la casa",

            resolvedNeeds: [
              "VIVIENDA",
            ],
          });

        expect(
          result.context.currentFocus,
        ).toBe("person_2");

        expect(
          person(
            result.context,
            "hermano",
          ).needs,
        ).toEqual([
          "ALCOHOLISMO",
        ]);

        expect(
          person(
            result.context,
            "cuñado",
          ).needs,
        ).toEqual([
          "VIVIENDA",
        ]);

        result =
          persistResolvedNeedsV2({
            conversationContext:
              result.context,

            inputMessage:
              "Volvamos a lo de mi hermano, también está desempleado",

            resolvedNeeds: [
              "INSERCIÓN LABORAL",
            ],
          });

        expect(
          result.context.currentFocus,
        ).toBe("person_1");

        expect(
          person(
            result.context,
            "hermano",
          ).needs,
        ).toEqual([
          "ALCOHOLISMO",
          "INSERCIÓN LABORAL",
        ]);

        expect(
          person(
            result.context,
            "cuñado",
          ).needs,
        ).toEqual([
          "VIVIENDA",
        ]);
      },
    );

    it(
      "L3 refuses to contaminate memory when subject is ambiguous",
      () => {
        const context = {
          version: 2,

          people: [
            {
              id: "self",
              relationship: "self",
              needs: [],
              facts: [],
              constraints: [],
            },
            {
              id: "person_1",
              relationship:
                "hermano",
              needs: [
                "ALCOHOLISMO",
              ],
              facts: [],
              constraints: [],
            },
            {
              id: "person_2",
              relationship:
                "hermano",
              needs: [],
              facts: [],
              constraints: [],
            },
          ],

          currentFocus: null,
          currentGoal: null,

          territory: {
            province: null,
            municipality: null,
          },

          resourcesShown: [],
        };

        const result =
          persistResolvedNeedsV2({
            conversationContext:
              context,

            inputMessage:
              "Mi hermano ha perdido el trabajo",

            resolvedNeeds: [
              "INSERCIÓN LABORAL",
            ],
          });

        expect(
          result.status,
        ).toBe(
          "ambiguous_subject",
        );

        expect(
          result.needsPersisted,
        ).toBe(false);

        expect(
          result.context.people[1]
            .needs,
        ).toEqual([
          "ALCOHOLISMO",
        ]);

        expect(
          result.context.people[2]
            .needs,
        ).toEqual([]);
      },
    );

    it(
      "L4 refuses blind assignment across multiple explicit subjects",
      () => {
        const result =
          persistResolvedNeedsV2({
            conversationContext:
              createEmptyConversationContextV2(),

            inputMessage:
              "Mi hermano tiene problemas con el alcohol y mi cuñado necesita vivienda",

            resolvedNeeds: [
              "ALCOHOLISMO",
              "VIVIENDA",
            ],
          });

        expect(
          result.status,
        ).toBe(
          "multiple_subjects",
        );

        expect(
          result.needsPersisted,
        ).toBe(false);

        expect(
          result.context.people,
        ).toHaveLength(1);
      },
    );

    it(
      "L5 does not create people or needs from a generic continuation",
      () => {
        const result =
          prepareConversationMemoryV2({
            conversationContext:
              createEmptyConversationContextV2(),

            inputMessage:
              "Gracias",
          });

        expect(
          result.status,
        ).toBe("unresolved");

        expect(
          result.person,
        ).toBeNull();

        expect(
          result.context.people,
        ).toEqual([
          {
            id: "self",
            relationship:
              "self",
            needs: [],
            facts: [],
            constraints: [],
          },
        ]);
      },
    );
  },
);
