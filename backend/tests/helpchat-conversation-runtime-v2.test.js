import {
  describe,
  expect,
  it,
} from "vitest";

import {
  finalizeHelpchatRuntimeContextV2,
  prepareHelpchatRuntimeContextV2,
} from "../helpchat/conversation-runtime-v2.js";

describe(
  "conversation runtime v2",
  () => {
    it(
      "accepts V1 and exposes a legacy projection for existing classifiers",
      () => {
        const result =
          prepareHelpchatRuntimeContextV2({
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
          result.status,
        ).toBe("resolved");

        expect(
          result.relationalContext.version,
        ).toBe(2);

        expect(
          result.legacyContext,
        ).toMatchObject({
          version: 1,
          subject: {
            relationship:
              "madre",
          },
          activeNeeds: [
            "ALZHEIMER",
          ],
        });
      },
    );

    it(
      "changes focused subject without mixing legacy needs",
      () => {
        const result =
          prepareHelpchatRuntimeContextV2({
            conversationContext: {
              version: 2,
              people: [
                {
                  id: "self",
                  relationship:
                    "self",
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
                    "cuñado",
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
            },
            inputMessage:
              "Volvamos a lo de mi hermano",
          });

        expect(
          result.relationalContext.currentFocus,
        ).toBe("person_1");

        expect(
          result.legacyContext.subject.relationship,
        ).toBe("hermano");

        expect(
          result.legacyContext.activeNeeds,
        ).toEqual([
          "ALCOHOLISMO",
        ]);

        expect(
          result.legacyContext.activeNeeds,
        ).not.toContain(
          "VIVIENDA",
        );
      },
    );

    it(
      "preserves ambiguity without guessing a legacy subject",
      () => {
        const result =
          prepareHelpchatRuntimeContextV2({
            conversationContext: {
              version: 2,
              people: [
                {
                  id: "self",
                  relationship:
                    "self",
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
            },
            inputMessage:
              "Mi hermano necesita ayuda",
          });

        expect(
          result.status,
        ).toBe(
          "ambiguous_subject",
        );

        expect(
          result.legacyContext.subject.relationship,
        ).toBeNull();

        expect(
          result.legacyContext.activeNeeds,
        ).toEqual([]);
      },
    );

    it(
      "persists resolved needs back into the relational focused person",
      () => {
        const prepared =
          prepareHelpchatRuntimeContextV2({
            conversationContext: {
              version: 2,
              people: [
                {
                  id: "self",
                  relationship:
                    "self",
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
                    "cuñado",
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
            },
            inputMessage:
              "Volvamos a lo de mi hermano, también ha perdido el trabajo",
          });

        const finalized =
          finalizeHelpchatRuntimeContextV2({
            relationalContext:
              prepared.relationalContext,
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
          finalized.context.currentFocus,
        ).toBe("person_1");

        expect(
          finalized.context.people.find(
            (person) =>
              person.id ===
              "person_1",
          ).needs,
        ).toEqual([
          "ALCOHOLISMO",
          "EMPLEO",
        ]);

        expect(
          finalized.context.people.find(
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
      "does not persist needs when subject resolution is ambiguous",
      () => {
        const prepared =
          prepareHelpchatRuntimeContextV2({
            conversationContext: {
              version: 2,
              people: [
                {
                  id: "self",
                  relationship:
                    "self",
                  needs: [],
                  facts: [],
                  constraints: [],
                },
                {
                  id: "person_1",
                  relationship:
                    "hermano",
                  needs: [],
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
            },
            inputMessage:
              "Mi hermano ha perdido el trabajo",
          });

        expect(
          prepared.status,
        ).toBe(
          "ambiguous_subject",
        );

        const finalized =
          finalizeHelpchatRuntimeContextV2({
            relationalContext:
              prepared.relationalContext,
            inputMessage:
              "Mi hermano ha perdido el trabajo",
            resolvedNeeds: [
              "EMPLEO",
            ],
          });

        expect(
          finalized.needsPersisted,
        ).toBe(false);
      },
    );
  },
);
