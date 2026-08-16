import {
  normalizeConversationContextV2,
} from "./conversation-context-v2.js";

function canonicalContext(value) {
  return normalizeConversationContextV2(
    structuredClone(value),
  );
}

function sameValue(
  left,
  right,
) {
  return (
    JSON.stringify(left) ===
    JSON.stringify(right)
  );
}

function peopleById(context) {
  return new Map(
    context.people.map(
      (person) => [
        person.id,
        person,
      ],
    ),
  );
}

function assessPendingProgress(
  before,
  after,
  reasons,
) {
  const beforePending =
    before.pendingClarification;

  const afterPending =
    after.pendingClarification;

  if (
    beforePending &&
    !afterPending
  ) {
    reasons.push(
      "pending_cleared",
    );
    return;
  }

  if (
    !beforePending &&
    afterPending
  ) {
    reasons.push(
      "pending_opened",
    );
    return;
  }

  if (
    !beforePending ||
    !afterPending
  ) {
    return;
  }

  if (
    beforePending.node !==
    afterPending.node
  ) {
    reasons.push(
      "pending_node_changed",
    );
  }

  if (
    beforePending.personId !==
    afterPending.personId
  ) {
    reasons.push(
      "pending_person_changed",
    );
  }

  if (
    beforePending.mode !==
    afterPending.mode
  ) {
    reasons.push(
      "pending_mode_changed",
    );
  }

  if (
    (
      beforePending.dimension ||
      null
    ) !==
    (
      afterPending.dimension ||
      null
    )
  ) {
    reasons.push(
      "pending_dimension_changed",
    );
  }
}

function assessPeopleProgress(
  before,
  after,
  reasons,
) {
  const beforePeople =
    peopleById(before);

  const afterPeople =
    peopleById(after);

  const beforeIds =
    [...beforePeople.keys()]
      .sort();

  const afterIds =
    [...afterPeople.keys()]
      .sort();

  if (
    !sameValue(
      beforeIds,
      afterIds,
    )
  ) {
    reasons.push(
      "people_changed",
    );
  }

  const sharedIds =
    beforeIds.filter(
      (personId) =>
        afterPeople.has(
          personId,
        ),
    );

  for (
    const personId of
    sharedIds
  ) {
    const beforePerson =
      beforePeople.get(
        personId,
      );

    const afterPerson =
      afterPeople.get(
        personId,
      );

    if (
      !sameValue(
        beforePerson.needs,
        afterPerson.needs,
      )
    ) {
      reasons.push(
        "person_needs_changed",
      );
    }

    if (
      !sameValue(
        beforePerson.facts,
        afterPerson.facts,
      )
    ) {
      reasons.push(
        "person_facts_changed",
      );
    }

    if (
      !sameValue(
        beforePerson.constraints,
        afterPerson.constraints,
      )
    ) {
      reasons.push(
        "person_constraints_changed",
      );
    }

    if (
      !sameValue(
        beforePerson
          .resolvedDimensions ||
          null,
        afterPerson
          .resolvedDimensions ||
          null,
      )
    ) {
      reasons.push(
        "person_resolved_dimensions_changed",
      );
    }
  }
}

export function assessConversationProgressV1({
  beforeContext,
  afterContext,
} = {}) {
  const before =
    canonicalContext(
      beforeContext,
    );

  const after =
    canonicalContext(
      afterContext,
    );

  if (!before || !after) {
    return {
      progressed: false,
      reasons: [],
    };
  }

  const reasons = [];

  assessPendingProgress(
    before,
    after,
    reasons,
  );

  assessPeopleProgress(
    before,
    after,
    reasons,
  );

  if (
    before.currentFocus !==
    after.currentFocus
  ) {
    reasons.push(
      "current_focus_changed",
    );
  }

  if (
    before.currentGoal !==
    after.currentGoal
  ) {
    reasons.push(
      "current_goal_changed",
    );
  }

  if (
    !sameValue(
      before.territory,
      after.territory,
    )
  ) {
    reasons.push(
      "territory_changed",
    );
  }

  const uniqueReasons =
    [...new Set(reasons)];

  return {
    progressed:
      uniqueReasons.length > 0,
    reasons:
      uniqueReasons,
  };
}
