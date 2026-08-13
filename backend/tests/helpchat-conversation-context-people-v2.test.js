import {
  describe,
  expect,
  it,
} from "vitest";

import {
  addPersonConstraint,
  addPersonFact,
  addPersonNeed,
  createPerson,
  ensureSinglePersonByRelationship,
  findPeopleByRelationship,
  removePersonNeed,
  replacePersonFact,
  setCurrentFocus,
} from "../helpchat/conversation-context-people-v2.js";

import {
  createEmptyConversationContextV2,
} from "../helpchat/conversation-context-v2.js";

function contextWithPeople() {
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
    currentFocus: "person_1",
    currentGoal: null,
    territory: {
      province: null,
      municipality: null,
    },
    resourcesShown: [],
  };
}

describe(
  "conversation context people v2",
  () => {
    it(
      "finds zero one or many people by relationship",
      () => {
        let context =
          contextWithPeople();

        expect(
          findPeopleByRelationship(
            context,
            "madre",
          ),
        ).toEqual([]);

        expect(
          findPeopleByRelationship(
            context,
            " HERMANO ",
          ).map(
            (person) =>
              person.id,
          ),
        ).toEqual([
          "person_1",
        ]);

        context =
          createPerson(
            context,
            {
              relationship:
                "hermano",
            },
          ).context;

        expect(
          findPeopleByRelationship(
            context,
            "hermano",
          ),
        ).toHaveLength(2);
      },
    );

    it(
      "creates deterministic collision-free person ids",
      () => {
        let context =
          createEmptyConversationContextV2();

        const first =
          createPerson(
            context,
            {
              relationship:
                "madre",
            },
          );

        expect(
          first.person.id,
        ).toBe("person_1");

        const second =
          createPerson(
            first.context,
            {
              relationship:
                "padre",
            },
          );

        expect(
          second.person.id,
        ).toBe("person_2");

        context =
          createPerson(
            second.context,
            {
              relationship:
                "hermano",
              preferredId:
                "person_10",
            },
          ).context;

        expect(
          context.people.some(
            (person) =>
              person.id ===
              "person_10",
          ),
        ).toBe(true);
      },
    );

    it(
      "does not create self through the generic person creator",
      () => {
        const result =
          createPerson(
            createEmptyConversationContextV2(),
            {
              relationship:
                "self",
            },
          );

        expect(
          result.created,
        ).toBe(false);

        expect(
          result.context.people,
        ).toHaveLength(1);
      },
    );

    it(
      "reuses a unique relationship but reports ambiguity for duplicates",
      () => {
        let context =
          contextWithPeople();

        const existing =
          ensureSinglePersonByRelationship(
            context,
            "hermano",
          );

        expect(
          existing.status,
        ).toBe("existing");

        expect(
          existing.person.id,
        ).toBe("person_1");

        context =
          createPerson(
            context,
            {
              relationship:
                "hermano",
            },
          ).context;

        const ambiguous =
          ensureSinglePersonByRelationship(
            context,
            "hermano",
          );

        expect(
          ambiguous.status,
        ).toBe("ambiguous");

        expect(
          ambiguous.person,
        ).toBeNull();
      },
    );

    it(
      "creates a person when a relationship is new",
      () => {
        const result =
          ensureSinglePersonByRelationship(
            createEmptyConversationContextV2(),
            "madre",
          );

        expect(
          result.status,
        ).toBe("created");

        expect(
          result.person,
        ).toMatchObject({
          id: "person_1",
          relationship:
            "madre",
        });
      },
    );

    it(
      "sets focus only to an existing person",
      () => {
        const context =
          contextWithPeople();

        expect(
          setCurrentFocus(
            context,
            "person_2",
          ).currentFocus,
        ).toBe("person_2");

        expect(
          setCurrentFocus(
            context,
            "person_404",
          ).currentFocus,
        ).toBe("person_1");

        expect(
          setCurrentFocus(
            context,
            null,
          ).currentFocus,
        ).toBeNull();
      },
    );

    it(
      "adds a need only to the target person",
      () => {
        const result =
          addPersonNeed(
            contextWithPeople(),
            "person_1",
            "EMPLEO",
          );

        const brother =
          result.people.find(
            (person) =>
              person.id ===
              "person_1",
          );

        const brotherInLaw =
          result.people.find(
            (person) =>
              person.id ===
              "person_2",
          );

        expect(
          brother.needs,
        ).toEqual([
          "ALCOHOLISMO",
          "EMPLEO",
        ]);

        expect(
          brotherInLaw.needs,
        ).toEqual([
          "VIVIENDA",
        ]);
      },
    );

    it(
      "deduplicates person values case-insensitively",
      () => {
        let result =
          addPersonNeed(
            contextWithPeople(),
            "person_1",
            " alcoholismo ",
          );

        result =
          addPersonFact(
            result,
            "person_1",
            " vive solo ",
          );

        result =
          addPersonFact(
            result,
            "person_1",
            "VIVE SOLO",
          );

        const person =
          result.people.find(
            (item) =>
              item.id ===
              "person_1",
          );

        expect(
          person.needs,
        ).toEqual([
          "ALCOHOLISMO",
        ]);

        expect(
          person.facts,
        ).toEqual([
          "vive solo",
        ]);
      },
    );

    it(
      "removes a need only from the requested person",
      () => {
        const result =
          removePersonNeed(
            contextWithPeople(),
            "person_1",
            "alcoholismo",
          );

        expect(
          result.people.find(
            (person) =>
              person.id ===
              "person_1",
          ).needs,
        ).toEqual([]);

        expect(
          result.people.find(
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
      "replaces a fact instead of accumulating a correction",
      () => {
        let context =
          addPersonFact(
            contextWithPeople(),
            "person_2",
            "vive en Burgos",
          );

        context =
          replacePersonFact(
            context,
            "person_2",
            {
              previous:
                "vive en Burgos",
              next:
                "vive en Gipuzkoa",
            },
          );

        expect(
          context.people.find(
            (person) =>
              person.id ===
              "person_2",
          ).facts,
        ).toEqual([
          "vive en Gipuzkoa",
        ]);
      },
    );

    it(
      "keeps facts and constraints scoped to one person",
      () => {
        let context =
          contextWithPeople();

        context =
          addPersonFact(
            context,
            "person_2",
            "vive solo",
          );

        context =
          addPersonConstraint(
            context,
            "person_2",
            "movilidad reducida",
          );

        const brother =
          context.people.find(
            (person) =>
              person.id ===
              "person_1",
          );

        const brotherInLaw =
          context.people.find(
            (person) =>
              person.id ===
              "person_2",
          );

        expect(
          brother.facts,
        ).toEqual([]);

        expect(
          brother.constraints,
        ).toEqual([]);

        expect(
          brotherInLaw.facts,
        ).toEqual([
          "vive solo",
        ]);

        expect(
          brotherInLaw.constraints,
        ).toEqual([
          "movilidad reducida",
        ]);
      },
    );
  },
);
