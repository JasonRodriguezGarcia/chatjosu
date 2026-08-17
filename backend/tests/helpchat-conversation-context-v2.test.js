import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createEmptyConversationContextV2,
  migrateConversationContextV1ToV2,
  normalizeConversationContextV2,
  projectConversationContextV2ToV1,
} from "../helpchat/conversation-context-v2.js";

describe(
  "conversation context v2",
  () => {
    it(
      "creates an empty context with one self",
      () => {
        expect(
          createEmptyConversationContextV2(),
        ).toEqual({
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
          ],
          currentFocus: null,
          currentGoal: null,
          pendingClarification:
            null,
          territory: {
            province: null,
            municipality: null,
          },
          resourcesShown: [],
        });
      },
    );

    it(
      "normalizes multiple people without mixing their needs",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [
              {
                id: "person_1",
                relationship:
                  " hermano ",
                needs: [
                  "ALCOHOLISMO",
                  "ALCOHOLISMO",
                  "EMPLEO",
                ],
                facts: [
                  "vive solo",
                  "vive solo",
                ],
              },
              {
                id: "person_2",
                relationship:
                  " cuñado ",
                needs: [
                  "VIVIENDA",
                ],
              },
            ],
            currentFocus:
              "person_2",
            provider:
              "must disappear",
          });

        expect(result).toEqual({
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
                "EMPLEO",
              ],
              facts: [
                "vive solo",
              ],
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
          pendingClarification:
            null,
          territory: {
            province: null,
            municipality: null,
          },
          resourcesShown: [],
        });

        expect(
          result.provider,
        ).toBeUndefined();
      },
    );

    it(
      "normalizes supported resolved dimensions per person",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [
              {
                id: "person_1",
                relationship:
                  "hermano",
                resolvedDimensions: {
                  diagnosis_status:
                    "not_confirmed",
                  unsupported_dimension:
                    "must disappear",
                },
              },
              {
                id: "person_2",
                relationship:
                  "madre",
                resolvedDimensions: {
                  diagnosis_status:
                    "invalid_value",
                },
              },
            ],
          });

        const brother =
          result.people.find(
            (person) =>
              person.id ===
              "person_1",
          );

        const mother =
          result.people.find(
            (person) =>
              person.id ===
              "person_2",
          );

        expect(
          brother.resolvedDimensions,
        ).toEqual({
          diagnosis_status:
            "not_confirmed",
        });

        expect(
          mother.resolvedDimensions,
        ).toBeUndefined();
      },
    );

    it(
      "keeps resolved dimensions isolated between people",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [
              {
                id: "person_1",
                relationship:
                  "hermano",
                resolvedDimensions: {
                  diagnosis_status:
                    "not_confirmed",
                },
              },
              {
                id: "person_2",
                relationship:
                  "madre",
              },
            ],
          });

        expect(
          result.people.find(
            (person) =>
              person.id ===
              "person_1",
          ).resolvedDimensions,
        ).toEqual({
          diagnosis_status:
            "not_confirmed",
        });

        expect(
          result.people.find(
            (person) =>
              person.id ===
              "person_2",
          ).resolvedDimensions,
        ).toBeUndefined();
      },
    );

    it(
      "allows two people with the same relationship when ids differ",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [
              {
                id: "person_1",
                relationship:
                  "hermano",
              },
              {
                id: "person_2",
                relationship:
                  "hermano",
              },
            ],
          });

        expect(
          result.people.filter(
            (person) =>
              person.relationship ===
              "hermano",
          ),
        ).toHaveLength(2);
      },
    );

    it(
      "keeps only one self and rejects a fake self person",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [
              {
                id: "self",
                relationship:
                  "otra cosa",
                facts: [
                  "está cansada",
                ],
              },
              {
                id: "person_1",
                relationship:
                  "self",
                needs: [
                  "SALUD MENTAL",
                ],
              },
            ],
          });

        expect(result.people).toEqual([
          {
            id: "self",
            relationship:
              "self",
            needs: [],
            facts: [
              "está cansada",
            ],
            constraints: [],
          },
        ]);
      },
    );

    it(
      "drops duplicate ids deterministically",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [
              {
                id: "person_1",
                relationship:
                  "hermano",
              },
              {
                id: "person_1",
                relationship:
                  "cuñado",
              },
            ],
          });

        expect(
          result.people.find(
            (person) =>
              person.id ===
              "person_1",
          )?.relationship,
        ).toBe("hermano");
      },
    );

    it(
      "nulls a focus that does not reference an existing person",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [
              {
                id: "person_1",
                relationship:
                  "madre",
              },
            ],
            currentFocus:
              "person_404",
          });

        expect(
          result.currentFocus,
        ).toBeNull();
      },
    );

    it(
      "preserves global territory goal and resources",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [],
            currentGoal:
              " encontrar apoyo ",
            territory: {
              province:
                " Burgos ",
              municipality:
                " Miranda de Ebro ",
            },
            resourcesShown: [
              "213",
              "213",
              "481",
            ],
          });

        expect(result).toMatchObject({
          currentGoal:
            "encontrar apoyo",
          territory: {
            province:
              "Burgos",
            municipality:
              "Miranda de Ebro",
          },
          resourcesShown: [
            "213",
            "481",
          ],
        });
      },
    );

    it(
      "rejects malformed or unsupported payloads",
      () => {
        expect(
          normalizeConversationContextV2(
            null,
          ),
        ).toBeNull();

        expect(
          normalizeConversationContextV2(
            [],
          ),
        ).toBeNull();

        expect(
          normalizeConversationContextV2({
            version: 1,
          }),
        ).toBeNull();
      },
    );

    it(
      "migrates a V1 subject into a focused V2 person",
      () => {
        const result =
          migrateConversationContextV1ToV2({
            version: 1,
            subject: {
              relationship:
                "madre",
            },
            activeNeeds: [
              "ALZHEIMER",
            ],
            currentGoal:
              "encontrar apoyo",
            facts: [
              "vive sola",
            ],
            constraints: [
              "movilidad reducida",
            ],
            territory: {
              province:
                "Burgos",
              municipality: null,
            },
            resourcesShown: [
              "213",
            ],
          });

        expect(result).toMatchObject({
          version: 2,
          currentFocus:
            "person_1",
          currentGoal:
            "encontrar apoyo",
          territory: {
            province:
              "Burgos",
          },
        });

        expect(result.people).toEqual([
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
            needs: [
              "ALZHEIMER",
            ],
            facts: [
              "vive sola",
            ],
            constraints: [
              "movilidad reducida",
            ],
          },
        ]);
      },
    );

    it(
      "projects only the focused person back to V1",
      () => {
        const result =
          projectConversationContextV2ToV1({
            version: 2,
            people: [
              {
                id: "self",
                relationship:
                  "self",
                needs: [],
              },
              {
                id: "person_1",
                relationship:
                  "hermano",
                needs: [
                  "ALCOHOLISMO",
                ],
              },
              {
                id: "person_2",
                relationship:
                  "cuñado",
                needs: [
                  "VIVIENDA",
                ],
                facts: [
                  "vive en Burgos",
                ],
              },
            ],
            currentFocus:
              "person_2",
            territory: {
              province:
                "Burgos",
            },
          });

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
          facts: [
            "vive en Burgos",
          ],
          constraints: [],
          territory: {
            province:
              "Burgos",
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
      "projects an explicit self focus without inventing a relationship",
      () => {
        const result =
          projectConversationContextV2ToV1({
            version: 2,
            people: [
              {
                id: "self",
                relationship:
                  "self",
                needs: [
                  "APOYO",
                ],
                facts: [
                  "está agotada",
                ],
              },
            ],
            currentFocus:
              "self",
          });

        expect(
          result.subject.relationship,
        ).toBeNull();

        expect(
          result.activeNeeds,
        ).toEqual([
          "APOYO",
        ]);

        expect(
          result.facts,
        ).toEqual([
          "está agotada",
        ]);
      },
    );
  },
);

describe(
  "pending clarification normalization",
  () => {
    it(
      "preserves a valid graph clarification",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [
              {
                id: "person_1",
                relationship:
                  "hermano",
              },
            ],
            currentFocus:
              "person_1",
            pendingClarification: {
              node:
                "mental_behavior_detail",
              personId:
                "person_1",
              mode:
                "free_text",
            },
          });

        expect(
          result.pendingClarification,
        ).toEqual({
          node:
            "mental_behavior_detail",
          personId:
            "person_1",
          mode:
            "free_text",
        });
      },
    );

    it(
      "preserves an explicit pending clarification dimension",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [
              {
                id: "person_1",
                relationship:
                  "hermano",
              },
            ],
            currentFocus:
              "person_1",
            pendingClarification: {
              node:
                "health_detail",
              personId:
                "person_1",
              mode:
                "free_text",
              dimension:
                "diagnosis_status",
            },
          });

        expect(
          result.pendingClarification,
        ).toEqual({
          node:
            "health_detail",
          personId:
            "person_1",
          mode:
            "free_text",
          dimension:
            "diagnosis_status",
        });
      },
    );

    it(
      "drops an unsupported pending clarification dimension",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [
              {
                id: "person_1",
                relationship:
                  "hermano",
              },
            ],
            pendingClarification: {
              node:
                "health_detail",
              personId:
                "person_1",
              mode:
                "free_text",
              dimension:
                "invented_dimension",
            },
          });

        expect(
          result.pendingClarification,
        ).toEqual({
          node:
            "health_detail",
          personId:
            "person_1",
          mode:
            "free_text",
        });
      },
    );

    it(
      "drops an unknown clarification node",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [],
            pendingClarification: {
              node:
                "made_up",
              mode:
                "choice",
            },
          });

        expect(
          result.pendingClarification,
        ).toBeNull();
      },
    );

    it(
      "nulls a pending person that is no longer present",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [],
            pendingClarification: {
              node:
                "mental_health_detail",
              personId:
                "person_404",
            },
          });

        expect(
          result.pendingClarification,
        ).toEqual({
          node:
            "mental_health_detail",
          personId: null,
          mode:
            "choice",
        });
      },
    );
  },
);

describe(
  "generic age dimension",
  () => {
    it(
      "normalizes age as a reusable person dimension",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [
              {
                id: "person_1",
                relationship:
                  "hermano",
                resolvedDimensions: {
                  age: "72",
                },
              },
            ],
          });

        expect(
          result.people[0]
            .resolvedDimensions,
        ).toEqual({
          age: "72",
        });
      },
    );

    it(
      "rejects invalid ages",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [
              {
                id: "person_1",
                relationship:
                  "hermano",
                resolvedDimensions: {
                  age: "200",
                },
              },
            ],
          });

        expect(
          result.people[0]
            .resolvedDimensions,
        ).toBeUndefined();
      },
    );

    it(
      "keeps age isolated between people",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [
              {
                id: "person_1",
                relationship:
                  "hermano",
                resolvedDimensions: {
                  age: "42",
                },
              },
              {
                id: "person_2",
                relationship:
                  "hija",
                resolvedDimensions: {
                  age: "13",
                },
              },
            ],
          });

        expect(
          result.people[0]
            .resolvedDimensions
            .age,
        ).toBe("42");

        expect(
          result.people[1]
            .resolvedDimensions
            .age,
        ).toBe("13");
      },
    );

    it(
      "preserves age clarification metadata",
      () => {
        const result =
          normalizeConversationContextV2({
            version: 2,
            people: [
              {
                id: "self",
                relationship:
                  "self",
              },
            ],
            currentFocus:
              "self",
            pendingClarification: {
              node:
                "age",
              personId:
                "self",
              mode:
                "free_text",
              dimension:
                "age",
            },
          });

        expect(
          result.pendingClarification,
        ).toEqual({
          node:
            "age",
          personId:
            "self",
          mode:
            "free_text",
          dimension:
            "age",
        });
      },
    );
  },
);
