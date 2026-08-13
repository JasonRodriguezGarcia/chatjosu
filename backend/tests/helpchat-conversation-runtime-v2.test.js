import {
  describe,
  expect,
  it,
} from "vitest";

import {
  applyClarificationTransitionV2,
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
            personId:
              prepared.personId,
            subjectStatus:
              prepared.status,
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
            personId:
              prepared.personId,
            subjectStatus:
              prepared.status,
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

describe(
  "prepared subject persistence",
  () => {
    it(
      "does not create a second person when finalizing mi otro hermano",
      () => {
        const initialContext = {
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
          ],
          currentFocus:
            "person_1",
          currentGoal: null,
          territory: {
            province: null,
            municipality: null,
          },
          resourcesShown: [],
        };

        const prepared =
          prepareHelpchatRuntimeContextV2({
            conversationContext:
              initialContext,
            inputMessage:
              "Mi otro hermano necesita vivienda",
          });

        expect(
          prepared.status,
        ).toBe("resolved");

        expect(
          prepared.personId,
        ).toBe("person_2");

        expect(
          prepared.relationalContext.people.filter(
            (person) =>
              person.relationship ===
              "hermano",
          ),
        ).toHaveLength(2);

        const finalized =
          finalizeHelpchatRuntimeContextV2({
            relationalContext:
              prepared.relationalContext,
            personId:
              prepared.personId,
            subjectStatus:
              prepared.status,
            resolvedNeeds: [
              "VIVIENDA",
            ],
          });

        expect(
          finalized.status,
        ).toBe("resolved");

        expect(
          finalized.context.people.filter(
            (person) =>
              person.relationship ===
              "hermano",
          ),
        ).toHaveLength(2);

        expect(
          finalized.context.people,
        ).toHaveLength(3);

        expect(
          finalized.context.people.find(
            (person) =>
              person.id ===
              "person_2",
          ).needs,
        ).toEqual([
          "VIVIENDA",
        ]);

        expect(
          finalized.context.people.find(
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
      "does not persist when prepared subject was ambiguous",
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
              "Mi hermano necesita vivienda",
          });

        expect(
          prepared.status,
        ).toBe(
          "ambiguous_subject",
        );

        expect(
          prepared.personId,
        ).toBeNull();

        const finalized =
          finalizeHelpchatRuntimeContextV2({
            relationalContext:
              prepared.relationalContext,
            personId:
              prepared.personId,
            subjectStatus:
              prepared.status,
            resolvedNeeds: [
              "VIVIENDA",
            ],
          });

        expect(
          finalized.needsPersisted,
        ).toBe(false);

        expect(
          finalized.context.people
            .filter(
              (person) =>
                person.id !==
                "self",
            )
            .every(
              (person) =>
                person.needs.length ===
                0,
            ),
        ).toBe(true);
      },
    );

    it(
      "refuses an invalid prepared person id",
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
                    "madre",
                  needs: [],
                  facts: [],
                  constraints: [],
                },
              ],
              currentFocus:
                "person_1",
              currentGoal: null,
              territory: {
                province: null,
                municipality: null,
              },
              resourcesShown: [],
            },
            inputMessage:
              "Ella necesita ayuda",
          });

        const finalized =
          finalizeHelpchatRuntimeContextV2({
            relationalContext:
              prepared.relationalContext,
            personId:
              "person_999",
            subjectStatus:
              prepared.status,
            resolvedNeeds: [
              "SOLEDAD",
            ],
          });

        expect(
          finalized.status,
        ).toBe(
          "unresolved",
        );

        expect(
          finalized.needsPersisted,
        ).toBe(false);

        expect(
          finalized.context.people.find(
            (person) =>
              person.id ===
              "person_1",
          ).needs,
        ).toEqual([]);
      },
    );
  },
);

describe(
  "clarification runtime transitions",
  () => {
    it(
      "stores goto as pending choice for the resolved person",
      () => {
        const result =
          applyClarificationTransitionV2({
            relationalContext: {
              version: 2,
              people: [
                {
                  id: "self",
                  relationship: "self",
                },
                {
                  id: "person_1",
                  relationship: "hermano",
                },
              ],
              currentFocus: "person_1",
              pendingClarification: null,
            },
            personId: "person_1",
            sourceNode: "need_type",
            action: {
              type: "goto",
              node: "mental_health_detail",
            },
          });

        expect(
          result.pendingClarification,
        ).toEqual({
          node: "mental_health_detail",
          personId: "person_1",
          mode: "choice",
        });
      },
    );

    it(
      "free text preserves the originating graph node",
      () => {
        const result =
          applyClarificationTransitionV2({
            relationalContext: {
              version: 2,
              people: [
                {
                  id: "self",
                  relationship: "self",
                },
                {
                  id: "person_1",
                  relationship: "hermano",
                },
              ],
              currentFocus: "person_1",
              pendingClarification: {
                node: "mental_health_detail",
                personId: "person_1",
                mode: "choice",
              },
            },
            personId: "person_1",
            sourceNode: "mental_health_detail",
            action: {
              type: "free_text",
            },
          });

        expect(
          result.pendingClarification,
        ).toEqual({
          node: "mental_health_detail",
          personId: "person_1",
          mode: "free_text",
        });
      },
    );

    it(
      "resolution clears pending clarification",
      () => {
        const result =
          applyClarificationTransitionV2({
            relationalContext: {
              version: 2,
              people: [
                {
                  id: "self",
                  relationship: "self",
                },
              ],
              currentFocus: "self",
              pendingClarification: {
                node: "mental_health_detail",
                personId: "self",
                mode: "choice",
              },
            },
            personId: "self",
            sourceNode: "mental_health_detail",
            action: {
              type: "resolve_need",
            },
          });

        expect(
          result.pendingClarification,
        ).toBeNull();
      },
    );
  },
);
