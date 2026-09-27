import {
  describe,
  expect,
  it,
} from "vitest";

import {
  clearPendingClarificationV2,
  setPendingClarificationV2,
} from "../helpchat/conversation-clarification-v2.js";

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
        relationship:
          "hermano",
        needs: [],
        facts: [],
        constraints: [],
      },
    ],
    currentFocus:
      "person_1",
    currentGoal: null,
    pendingClarification: null,
    territory: {
      province: null,
      municipality: null,
    },
    resourcesShown: [],
  };
}

describe(
  "conversation clarification v2",
  () => {
    it(
      "stores the pending graph node for the focused person",
      () => {
        const result =
          setPendingClarificationV2(
            contextV2(),
            {
              node:
                "mental_health_detail",
              personId:
                "person_1",
            },
          );

        expect(
          result.pendingClarification,
        ).toEqual({
          node:
            "mental_health_detail",
          personId:
            "person_1",
          mode:
            "choice",
        });
      },
    );

    it(
      "supports free text while preserving the originating node",
      () => {
        const result =
          setPendingClarificationV2(
            contextV2(),
            {
              node:
                "mental_health_detail",
              personId:
                "person_1",
              mode:
                "free_text",
            },
          );

        expect(
          result.pendingClarification,
        ).toEqual({
          node:
            "mental_health_detail",
          personId:
            "person_1",
          mode:
            "free_text",
        });
      },
    );

    it(
      "does not retain an invalid person reference",
      () => {
        const result =
          setPendingClarificationV2(
            contextV2(),
            {
              node:
                "mental_behavior_detail",
              personId:
                "person_999",
            },
          );

        expect(
          result.pendingClarification,
        ).toEqual({
          node:
            "mental_behavior_detail",
          personId: null,
          mode:
            "choice",
        });
      },
    );

    it(
      "does not accept an unknown graph node",
      () => {
        const original =
          contextV2();

        const result =
          setPendingClarificationV2(
            original,
            {
              node:
                "invented_node",
              personId:
                "person_1",
            },
          );

        expect(
          result.pendingClarification,
        ).toBeNull();
      },
    );

    it(
      "clears a pending clarification after resolution",
      () => {
        const pending =
          setPendingClarificationV2(
            contextV2(),
            {
              node:
                "mental_health_detail",
              personId:
                "person_1",
            },
          );

        const result =
          clearPendingClarificationV2(
            pending,
          );

        expect(
          result.pendingClarification,
        ).toBeNull();
      },
    );
  },
);
