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
      purpose:
        "optional_refinement",
      baseNeed: {
        tag_id: 31,
        descripcion:
          "SALUD MENTAL",
      },
      insufficientStrategy:
        "retain_existing_base_need",
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

export function resolveOpenClarificationInsufficientV1({
  nodeId,
  person = null,
} = {}) {
  const policy =
    getOpenClarificationPolicyV1(
      nodeId,
    );

  if (
    !policy ||
    policy.purpose !==
      "optional_refinement" ||
    policy.insufficientStrategy !==
      "retain_existing_base_need" ||
    !policy.baseNeed
  ) {
    return {
      status:
        "unresolved",
      reason:
        "strategy_not_applicable",
      need: null,
    };
  }

  const baseNeed =
    policy.baseNeed;

  const hasBaseNeed =
    Array.isArray(
      person?.needs,
    ) &&
    person.needs.includes(
      baseNeed.descripcion,
    );

  if (!hasBaseNeed) {
    return {
      status:
        "unresolved",
      reason:
        "base_need_not_established",
      need: null,
    };
  }

  return {
    status:
      "resolved",
    reason:
      "optional_detail_unavailable",
    need:
      clone(baseNeed),
  };
}

export function listOpenClarificationPoliciesV1() {
  return Object.keys(
    OPEN_CLARIFICATION_POLICIES,
  );
}
