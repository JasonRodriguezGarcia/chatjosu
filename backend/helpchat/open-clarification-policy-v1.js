const OPEN_CLARIFICATION_POLICIES =
  Object.freeze({
    health_detail: {
      node:
        "health_detail",
      domain:
        "health",
      catalogStrategy:
        "bounded_semantic_catalog",
      canResolveDirectly:
        true,
      allowedTagIds: [
        3,
        4,
        9,
        10,
        12,
        13,
        14,
        15,
        16,
        18,
        19,
        22,
        28,
        29,
        31,
        32,
        33,
        34,
      ],
    },

    mental_behavior_detail: {
      node:
        "mental_behavior_detail",
      domain:
        "mental_health",
      catalogStrategy:
        "bounded_semantic_catalog",
      canResolveDirectly:
        true,
      allowedTagIds: [
        4,
        31,
        32,
        33,
      ],
    },

    addiction_substance_detail: {
      node:
        "addiction_substance_detail",
      domain:
        "addiction_substance",
      catalogStrategy:
        "capture_without_catalog_resolution",
      canResolveDirectly:
        false,
      allowedTagIds: [],
    },

    addiction_behavior_detail: {
      node:
        "addiction_behavior_detail",
      domain:
        "addiction_behavior",
      catalogStrategy:
        "capture_without_catalog_resolution",
      canResolveDirectly:
        false,
      allowedTagIds: [],
    },
  });

function clone(value) {
  return structuredClone(value);
}

export function getOpenClarificationPolicyV1(
  nodeId,
) {
  if (
    typeof nodeId !== "string"
  ) {
    return null;
  }

  const policy =
    OPEN_CLARIFICATION_POLICIES[
      nodeId
    ] || null;

  return policy
    ? clone(policy)
    : null;
}

export function isAllowedOpenClarificationTagV1({
  nodeId,
  tagId,
} = {}) {
  const policy =
    getOpenClarificationPolicyV1(
      nodeId,
    );

  if (!policy) {
    return false;
  }

  return (
    policy.canResolveDirectly ===
      true &&
    policy.allowedTagIds.includes(
      Number(tagId),
    )
  );
}

export function listOpenClarificationPoliciesV1() {
  return Object.keys(
    OPEN_CLARIFICATION_POLICIES,
  );
}
