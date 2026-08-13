import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildLegacyConversationContextV1,
  persistResolvedNeedsV2,
  prepareConversationMemoryV2,
} from "../helpchat/conversation-memory-v2.js";

function contextV2() {
  return {
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
        relationship: "hermano",
        needs: [
          "ALCOHOLISMO",
        ],
        facts: [],
        constraints: [],
      },
      {
        id: "person_2",
        relationship: "cuñado",
        needs: [
          "VIVIENDA",
        ],
        facts: [],
        constraints: [],
      },
    ],
    currentFocus:
      "person_2",
    currentGoal: null,
    territory: {
      province: null,
      municipality: null,
    },
    resourcesShown: [],
  };
}

describe(
  "conversation memory v2",
  () => {
    it(
      "starts from an empty V2 context when no context exists",
      () => {
        const result =
          prepareConversationMemoryV2({
            conversationContext:
              null,
            inputMessage:
              "Mi hermano necesita ayuda",
          });

        expect(
          result.status,
        ).toBe("resolved");

        expect(
          result.person,
        ).toMatchObject({
          id: "person_1",
          relationship:
            "hermano",
        });

        expect(
          result.context.version,
        ).toBe(2);
      },
    );

    it(
      "migrates incoming V1 before relational resolution",
      () => {
        const result =
          prepareConversationMemoryV2({
            conversationContext: {
              version: 1,
              subject: {
                relationship:
                  "madre",
              },
              activeNeeds: [
                "ALZHEIMER",
              ],
              currentGoal: null,
              facts: [],
              constraints: [],
              territory: {
                province:
                  "Burgos",
                municipality:
                  null,
              },
              resourcesShown: [],
            },
            inputMessage:
              "Ella vive sola",
          });

        expect(
          result.context.version,
        ).toBe(2);

        expect(
          result.person,
        ).toMatchObject({
          id: "person_1",
          relationship:
            "madre",
        });

        expect(
          result.person.needs,
        ).toEqual([
          "ALZHEIMER",
        ]);
      },
    );

    it(
      "persists a resolved need only on the focused person",
      () => {
        const result =
          persistResolvedNeedsV2({
            conversationContext:
              contextV2(),
            inputMessage:
              "También ha perdido el trabajo",
            resolvedNeeds: [
              {
                descripcion:
                  "EMPLEO",
              },
            ],
          });

        expect(
          result.needsPersisted,
        ).toBe(true);

        expect(
          result.context.people.find(
            (person) =>
              person.id ===
              "person_2",
          ).needs,
        ).toEqual([
          "VIVIENDA",
          "EMPLEO",
        ]);

        expect(
          result.context.people.find(
            (person) =>
              person.id ===
              "person_1",
          ).needs,
        ).toEqual([
          "ALCOHOLISMO",
        ]);
      },
    );

    it(
      "changes focus before persisting a new need",
      () => {
        const result =
          persistResolvedNeedsV2({
            conversationContext:
              contextV2(),
            inputMessage:
              "Volvamos a lo de mi hermano, también ha perdido el trabajo",
            resolvedNeeds: [
              {
                descripcion:
                  "EMPLEO",
              },
            ],
          });

        expect(
          result.context.currentFocus,
        ).toBe("person_1");

        expect(
          result.context.people.find(
            (person) =>
              person.id ===
              "person_1",
          ).needs,
        ).toEqual([
          "ALCOHOLISMO",
          "EMPLEO",
        ]);

        expect(
          result.context.people.find(
            (person) =>
              person.id ===
              "person_2",
          ).needs,
        ).toEqual([
          "VIVIENDA",
        ]);
      },
    );

    it(
      "creates a new explicit person and assigns needs to it",
      () => {
        const result =
          persistResolvedNeedsV2({
            conversationContext:
              contextV2(),
            inputMessage:
              "Mi madre necesita ayuda por soledad",
            resolvedNeeds: [
              "SOLEDAD",
            ],
          });

        expect(
          result.status,
        ).toBe("resolved");

        expect(
          result.person.relationship,
        ).toBe("madre");

        expect(
          result.person.needs,
        ).toEqual([
          "SOLEDAD",
        ]);
      },
    );

    it(
      "does not persist needs when subject is ambiguous",
      () => {
        const context =
          contextV2();

        context.people.push({
          id: "person_3",
          relationship:
            "hermano",
          needs: [],
          facts: [],
          constraints: [],
        });

        const result =
          persistResolvedNeedsV2({
            conversationContext:
              context,
            inputMessage:
              "Mi hermano ha perdido el trabajo",
            resolvedNeeds: [
              "EMPLEO",
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
          result.context.people.find(
            (person) =>
              person.id ===
              "person_1",
          ).needs,
        ).toEqual([
          "ALCOHOLISMO",
        ]);

        expect(
          result.context.people.find(
            (person) =>
              person.id ===
              "person_3",
          ).needs,
        ).toEqual([]);
      },
    );

    it(
      "does not assign multiple-subject needs blindly",
      () => {
        const result =
          persistResolvedNeedsV2({
            conversationContext:
              null,
            inputMessage:
              "Mi hermano y mi cuñado necesitan ayuda",
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
      },
    );

    it(
      "deduplicates repeated resolved needs",
      () => {
        const result =
          persistResolvedNeedsV2({
            conversationContext:
              contextV2(),
            inputMessage:
              "Mi hermano sigue con problemas de alcohol",
            resolvedNeeds: [
              "ALCOHOLISMO",
              "alcoholismo",
            ],
          });

        expect(
          result.person.needs,
        ).toEqual([
          "ALCOHOLISMO",
        ]);
      },
    );

    it(
      "projects only current focus into the legacy V1 bridge",
      () => {
        const result =
          buildLegacyConversationContextV1(
            contextV2(),
          );

        expect(result).toEqual({
          version: 1,
          subject: {
            relationship:
              "cuñado",
          },
          activeNeeds: [
            "VIVIENDA",
          ],
          currentGoal: null,
          facts: [],
          constraints: [],
          territory: {
            province: null,
            municipality: null,
          },
          resourcesShown: [],
        });

        expect(
          result.activeNeeds,
        ).not.toContain(
          "ALCOHOLISMO",
        );
      },
    );

    it(
      "preserves V1 compatibility when passed through the legacy bridge",
      () => {
        const result =
          buildLegacyConversationContextV1({
            version: 1,
            subject: {
              relationship:
                "padre",
            },
            activeNeeds: [
              "PARKINSON",
            ],
            currentGoal:
              "buscar apoyo",
            facts: [
              "vive solo",
            ],
            constraints: [],
            territory: {
              province:
                "Navarra",
              municipality:
                null,
            },
            resourcesShown: [
              "123",
            ],
          });

        expect(result).toEqual({
          version: 1,
          subject: {
            relationship:
              "padre",
          },
          activeNeeds: [
            "PARKINSON",
          ],
          currentGoal:
            "buscar apoyo",
          facts: [
            "vive solo",
          ],
          constraints: [],
          territory: {
            province:
              "Navarra",
            municipality:
              null,
          },
          resourcesShown: [
            "123",
          ],
        });
      },
    );
  },
);
