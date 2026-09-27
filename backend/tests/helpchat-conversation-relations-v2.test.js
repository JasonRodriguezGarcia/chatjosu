import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolveConversationSubjectV2,
} from "../helpchat/conversation-relations-v2.js";

import {
  createEmptyConversationContextV2,
} from "../helpchat/conversation-context-v2.js";

function relationalContext() {
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
  };
}

describe(
  "conversation relations v2",
  () => {
    it(
      "creates and focuses a new explicit relationship",
      () => {
        const result =
          resolveConversationSubjectV2({
            conversationContext:
              createEmptyConversationContextV2(),
            inputMessage:
              "Mi hermano tiene problemas con el alcohol",
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
          result.context.currentFocus,
        ).toBe("person_1");
      },
    );

    it(
      "reuses the unique known person for an explicit relationship",
      () => {
        const result =
          resolveConversationSubjectV2({
            conversationContext:
              relationalContext(),
            inputMessage:
              "Mi hermano también ha perdido el trabajo",
          });

        expect(
          result.person.id,
        ).toBe("person_1");

        expect(
          result.context.people,
        ).toHaveLength(3);
      },
    );

    it(
      "creates a distinct person for another sibling",
      () => {
        const result =
          resolveConversationSubjectV2({
            conversationContext:
              relationalContext(),
            inputMessage:
              "Mi otro hermano también necesita ayuda",
          });

        expect(
          result.status,
        ).toBe("resolved");

        expect(
          result.person.id,
        ).toBe("person_3");

        expect(
          result.person.relationship,
        ).toBe("hermano");

        expect(
          result.context.currentFocus,
        ).toBe("person_3");
      },
    );

    it(
      "changes focus when user explicitly returns to a known person",
      () => {
        const result =
          resolveConversationSubjectV2({
            conversationContext:
              relationalContext(),
            inputMessage:
              "Volvamos a lo de mi hermano",
          });

        expect(
          result.status,
        ).toBe("resolved");

        expect(
          result.person.id,
        ).toBe("person_1");

        expect(
          result.context.currentFocus,
        ).toBe("person_1");
      },
    );

    it(
      "uses current focus for a contextual pronoun",
      () => {
        const result =
          resolveConversationSubjectV2({
            conversationContext:
              relationalContext(),
            inputMessage:
              "Él vive en Burgos",
          });

        expect(
          result.status,
        ).toBe("resolved");

        expect(
          result.person.id,
        ).toBe("person_2");

        expect(
          result.source,
        ).toBe("pronoun");
      },
    );

    it(
      "does not resolve a pronoun without current focus",
      () => {
        const context =
          relationalContext();

        context.currentFocus =
          null;

        const result =
          resolveConversationSubjectV2({
            conversationContext:
              context,
            inputMessage:
              "Él vive en Burgos",
          });

        expect(
          result.status,
        ).toBe(
          "ambiguous_subject",
        );

        expect(
          result.person,
        ).toBeNull();
      },
    );

    it(
      "does not guess when two known people share one relationship",
      () => {
        const context =
          relationalContext();

        context.people.push({
          id: "person_3",
          relationship:
            "hermano",
          needs: [],
          facts: [],
          constraints: [],
        });

        const result =
          resolveConversationSubjectV2({
            conversationContext:
              context,
            inputMessage:
              "Mi hermano necesita otra cosa",
          });

        expect(
          result.status,
        ).toBe(
          "ambiguous_subject",
        );

        expect(
          result.person,
        ).toBeNull();
      },
    );

    it(
      "reports multiple explicitly mentioned subjects",
      () => {
        const result =
          resolveConversationSubjectV2({
            conversationContext:
              createEmptyConversationContextV2(),
            inputMessage:
              "Mi hermano y mi cuñado necesitan ayuda",
          });

        expect(
          result.status,
        ).toBe(
          "multiple_subjects",
        );

        expect(
          result.relationships,
        ).toEqual([
          "hermano",
          "cuñado",
        ]);

        expect(
          result.person,
        ).toBeNull();
      },
    );

    it(
      "supports cuñado and cuñada relationships",
      () => {
        const male =
          resolveConversationSubjectV2({
            conversationContext:
              createEmptyConversationContextV2(),
            inputMessage:
              "Mi cuñado necesita ayuda",
          });

        expect(
          male.person.relationship,
        ).toBe("cuñado");

        const female =
          resolveConversationSubjectV2({
            conversationContext:
              createEmptyConversationContextV2(),
            inputMessage:
              "Mi cuñada necesita ayuda",
          });

        expect(
          female.person.relationship,
        ).toBe("cuñada");
      },
    );

    it(
      "keeps current focus for a continuation without an explicit subject",
      () => {
        const result =
          resolveConversationSubjectV2({
            conversationContext:
              relationalContext(),
            inputMessage:
              "También ha perdido el trabajo",
          });

        expect(
          result.status,
        ).toBe("resolved");

        expect(
          result.person.id,
        ).toBe("person_2");

        expect(
          result.source,
        ).toBe(
          "current_focus",
        );
      },
    );
  },
);

it(
  "defaults a generic help request to self when no third person is implied",
  () => {
    const result =
      resolveConversationSubjectV2({
        conversationContext:
          createEmptyConversationContextV2(),
        inputMessage:
          "Busco orientación social",
      });

    expect(
      result.status,
    ).toBe("resolved");

    expect(
      result.person,
    ).toMatchObject({
      id: "self",
      relationship: "self",
    });

    expect(
      result.context.currentFocus,
    ).toBe("self");

    expect(
      result.source,
    ).toBe("implicit_self");
  },
);

it(
  "does not default a generic third-person request to self",
  () => {
    const result =
      resolveConversationSubjectV2({
        conversationContext:
          createEmptyConversationContextV2(),
        inputMessage:
          "Busco ayuda para otra persona",
      });

    expect(
      result.status,
    ).toBe("unresolved");

    expect(
      result.person,
    ).toBeNull();

    expect(
      result.context.currentFocus,
    ).toBeNull();
  },
);

it(
  "does not default an unspecified family member to self",
  () => {
    const result =
      resolveConversationSubjectV2({
        conversationContext:
          createEmptyConversationContextV2(),
        inputMessage:
          "Necesito ayuda para un familiar",
      });

    expect(
      result.status,
    ).toBe("unresolved");

    expect(
      result.person,
    ).toBeNull();
  },
);
