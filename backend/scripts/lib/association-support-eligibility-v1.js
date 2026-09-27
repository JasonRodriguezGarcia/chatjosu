const PROTECTIVE_HINTS_V1 =
  new Set([
    "health_or_condition_resource",
    "social_support_resource",
    "family_support",
    "widowhood_support",
    "accident_support",
  ]);

function uniqueStrings(
  values
) {
  return [
    ...new Set(
      (values ?? [])
        .map(value =>
          String(
            value ?? ""
          ).trim()
        )
        .filter(Boolean)
    ),
  ];
}

/*
 * Publication eligibility is intentionally
 * stricter than acquisition utility.
 *
 * A function describes what an entity does.
 * It does not establish by itself that the
 * entity belongs to an assistive/support
 * domain.
 *
 * Therefore functions are retained as
 * semantic evidence but do not independently
 * grant the support_resource publication lane.
 */
export function
buildAssociationSupportEligibilityV1({
  relevanceDecision = null,
  needKeys = [],
  hints = [],
} = {}) {
  const needs =
    uniqueStrings(
      needKeys
    );

  const normalizedHints =
    uniqueStrings(
      hints
    );

  const protectiveHints =
    normalizedHints.filter(
      value =>
        PROTECTIVE_HINTS_V1.has(
          value
        )
    );

  const reasons = [];

  if (
    relevanceDecision ===
    "keep"
  ) {
    reasons.push(
      "direct_relevance"
    );
  }

  if (
    needs.length > 0
  ) {
    reasons.push(
      "need"
    );
  }

  if (
    protectiveHints.length > 0
  ) {
    reasons.push(
      "protective_hint"
    );
  }

  return {
    format_version: 1,

    eligible:
      reasons.length > 0,

    reasons,

    evidence: {
      needs,
      protective_hints:
        protectiveHints,
    },
  };
}
