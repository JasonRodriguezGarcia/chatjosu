import test from "node:test";
import assert from "node:assert/strict";

import {
  assessConversationProgressV1,
} from "../helpchat/conversation-progress-v1.js";

function context({
  pendingClarification = {
    node: "mental_behavior_detail",
    personId: "person_1",
    mode: "free_text",
  },
  needs = ["SALUD MENTAL"],
  facts = [],
  constraints = [],
  resolvedDimensions = null,
  currentFocus = "person_1",
} = {}) {
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
        needs,
        facts,
        constraints,
        ...(resolvedDimensions
          ? { resolvedDimensions }
          : {}),
      },
    ],
    currentFocus,
    currentGoal: null,
    pendingClarification,
    territory: {
      province: "Álava",
      municipality: null,
    },
    resourcesShown: [],
  };
}

test(
  "same clarification and same meaningful state is not progress",
  () => {
    const before = context();
    const after = structuredClone(before);

    assert.deepEqual(
      assessConversationProgressV1({
        beforeContext: before,
        afterContext: after,
      }),
      {
        progressed: false,
        reasons: [],
      },
    );
  },
);

test(
  "moving to another clarification node is progress",
  () => {
    const before = context({
      pendingClarification: {
        node: "mental_health_detail",
        personId: "person_1",
        mode: "choice",
      },
    });

    const after = context({
      pendingClarification: {
        node: "mental_behavior_detail",
        personId: "person_1",
        mode: "free_text",
      },
    });

    const result =
      assessConversationProgressV1({
        beforeContext: before,
        afterContext: after,
      });

    assert.equal(
      result.progressed,
      true,
    );

    assert.ok(
      result.reasons.includes(
        "pending_node_changed",
      ),
    );
  },
);

test(
  "clearing a pending clarification is progress",
  () => {
    const before = context();

    const after = context({
      pendingClarification: null,
    });

    const result =
      assessConversationProgressV1({
        beforeContext: before,
        afterContext: after,
      });

    assert.equal(
      result.progressed,
      true,
    );

    assert.ok(
      result.reasons.includes(
        "pending_cleared",
      ),
    );
  },
);

test(
  "adding a need while opening an optional refinement is progress",
  () => {
    const before = context({
      pendingClarification: {
        node: "mental_health_detail",
        personId: "person_1",
        mode: "choice",
      },
      needs: [],
    });

    const after = context({
      pendingClarification: {
        node: "mental_behavior_detail",
        personId: "person_1",
        mode: "free_text",
      },
      needs: [
        "SALUD MENTAL",
      ],
    });

    const result =
      assessConversationProgressV1({
        beforeContext: before,
        afterContext: after,
      });

    assert.equal(
      result.progressed,
      true,
    );

    assert.ok(
      result.reasons.includes(
        "person_needs_changed",
      ),
    );

    assert.ok(
      result.reasons.includes(
        "pending_node_changed",
      ),
    );
  },
);

test(
  "resolving a dimension is progress even without relying on node change",
  () => {
    const before = context({
      pendingClarification: {
        node: "health_detail",
        personId: "person_1",
        mode: "free_text",
        dimension: "diagnosis_status",
      },
    });

    const after = context({
      pendingClarification: {
        node: "health_detail",
        personId: "person_1",
        mode: "free_text",
        dimension: "diagnosis_status",
      },
      resolvedDimensions: {
        diagnosis_status:
          "not_confirmed",
      },
    });

    const result =
      assessConversationProgressV1({
        beforeContext: before,
        afterContext: after,
      });

    assert.equal(
      result.progressed,
      true,
    );

    assert.ok(
      result.reasons.includes(
        "person_resolved_dimensions_changed",
      ),
    );
  },
);

test(
  "changing focus is progress",
  () => {
    const before = context();

    const after = context({
      currentFocus: "self",
    });

    const result =
      assessConversationProgressV1({
        beforeContext: before,
        afterContext: after,
      });

    assert.equal(
      result.progressed,
      true,
    );

    assert.ok(
      result.reasons.includes(
        "current_focus_changed",
      ),
    );
  },
);

test(
  "changing clarification mode is progress",
  () => {
    const before = context({
      pendingClarification: {
        node:
          "mental_health_detail",
        personId:
          "person_1",
        mode:
          "choice",
      },
    });

    const after = context({
      pendingClarification: {
        node:
          "mental_health_detail",
        personId:
          "person_1",
        mode:
          "free_text",
      },
    });

    const result =
      assessConversationProgressV1({
        beforeContext:
          before,
        afterContext:
          after,
      });

    assert.equal(
      result.progressed,
      true,
    );

    assert.ok(
      result.reasons.includes(
        "pending_mode_changed",
      ),
    );
  },
);

test(
  "changing the pending dimension is progress",
  () => {
    const before = context({
      pendingClarification: {
        node:
          "health_detail",
        personId:
          "person_1",
        mode:
          "free_text",
      },
    });

    const after = context({
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

    const result =
      assessConversationProgressV1({
        beforeContext:
          before,
        afterContext:
          after,
      });

    assert.equal(
      result.progressed,
      true,
    );

    assert.ok(
      result.reasons.includes(
        "pending_dimension_changed",
      ),
    );
  },
);

test(
  "adding a person fact is progress even when the clarification node stays the same",
  () => {
    const before =
      context({
        facts: [],
      });

    const after =
      context({
        facts: [
          "Los cambios empezaron hace dos meses",
        ],
      });

    const result =
      assessConversationProgressV1({
        beforeContext:
          before,
        afterContext:
          after,
      });

    assert.equal(
      result.progressed,
      true,
    );

    assert.ok(
      result.reasons.includes(
        "person_facts_changed",
      ),
    );
  },
);

test(
  "adding a person constraint is progress even when the clarification node stays the same",
  () => {
    const before =
      context({
        constraints: [],
      });

    const after =
      context({
        constraints: [
          "No puede desplazarse fuera de la provincia",
        ],
      });

    const result =
      assessConversationProgressV1({
        beforeContext:
          before,
        afterContext:
          after,
      });

    assert.equal(
      result.progressed,
      true,
    );

    assert.ok(
      result.reasons.includes(
        "person_constraints_changed",
      ),
    );
  },
);

test(
  "opening a pending clarification is progress",
  () => {
    const before =
      context({
        pendingClarification:
          null,
      });

    const after =
      context({
        pendingClarification: {
          node:
            "mental_health_detail",
          personId:
            "person_1",
          mode:
            "choice",
        },
      });

    const result =
      assessConversationProgressV1({
        beforeContext:
          before,
        afterContext:
          after,
      });

    assert.equal(
      result.progressed,
      true,
    );

    assert.ok(
      result.reasons.includes(
        "pending_opened",
      ),
    );
  },
);
