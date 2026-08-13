import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildClarificationTaskContext,
  buildNeedClassificationTaskContext,
  buildSubjectResolutionTaskContext,
} from "../helpchat/task-context-v1.js";

function context() {
  return {
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
        facts: [
          "vive solo",
        ],
        constraints: [
          "no conduce",
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
        constraints: [],
      },
    ],
    currentFocus:
      "person_1",
    currentGoal:
      "encontrar apoyo",
    territory: {
      province:
        "Burgos",
      municipality: null,
    },
    resourcesShown: [
      "123",
      "456",
    ],
  };
}

describe(
  "task context v1",
  () => {
    it(
      "gives need classification only the focused person",
      () => {
        const result =
          buildNeedClassificationTaskContext({
            inputMessage:
              "También ha perdido el trabajo",
            relationalContext:
              context(),
          });

        expect(result).toEqual({
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
            facts: [
              "vive solo",
            ],
            constraints: [
              "no conduce",
            ],
          },
        });

        expect(
          JSON.stringify(
            result,
          ),
        ).not.toContain(
          "VIVIENDA",
        );

        expect(
          JSON.stringify(
            result,
          ),
        ).not.toContain(
          "resourcesShown",
        );
      },
    );

    it(
      "gives subject resolution identities without private need state",
      () => {
        const result =
          buildSubjectResolutionTaskContext({
            inputMessage:
              "Él vive en Burgos",
            relationalContext:
              context(),
          });

        expect(result).toEqual({
          version: 1,
          task:
            "resolve_subject",
          message:
            "Él vive en Burgos",
          currentFocus:
            "person_1",
          people: [
            {
              id: "self",
              relationship:
                "self",
            },
            {
              id: "person_1",
              relationship:
                "hermano",
            },
            {
              id: "person_2",
              relationship:
                "cuñado",
            },
          ],
        });

        expect(
          JSON.stringify(
            result,
          ),
        ).not.toContain(
          "ALCOHOLISMO",
        );

        expect(
          JSON.stringify(
            result,
          ),
        ).not.toContain(
          "VIVIENDA",
        );
      },
    );

    it(
      "passes only bounded semantic candidates to clarification",
      () => {
        const result =
          buildClarificationTaskContext({
            inputMessage:
              "Está muy mal últimamente",
            relationalContext:
              context(),
            candidates: [
              {
                tag:
                  "SALUD MENTAL",
                score:
                  0.64,
              },
              {
                tag:
                  "ALZHEIMER",
                score:
                  0.62,
              },
              {
                tag:
                  "AUTISMO",
                score:
                  0.2,
              },
              {
                tag:
                  "DIABETES",
                score:
                  0.1,
              },
              {
                tag:
                  "LUPUS",
                score:
                  0.01,
              },
            ],
          });

        expect(
          result.task,
        ).toBe(
          "clarify_need",
        );

        expect(
          result.candidates,
        ).toHaveLength(4);

        expect(
          result.candidates.map(
            (candidate) =>
              candidate.tag,
          ),
        ).not.toContain(
          "LUPUS",
        );
      },
    );

    it(
      "does not leak provider or resource metadata",
      () => {
        const source =
          context();

        source.provider =
          "gemini";

        source.model =
          "something";

        const result =
          buildNeedClassificationTaskContext({
            inputMessage:
              "Necesita ayuda",
            relationalContext:
              source,
          });

        expect(
          result.provider,
        ).toBeUndefined();

        expect(
          result.model,
        ).toBeUndefined();

        expect(
          result.resourcesShown,
        ).toBeUndefined();

        expect(
          result.territory,
        ).toBeUndefined();
      },
    );
  },
);
