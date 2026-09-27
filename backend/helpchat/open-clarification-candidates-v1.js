import {
  HELPCHAT_SEMANTIC_PROTOTYPES,
} from "./semantic-prototypes.js";

import {
  getOpenClarificationPolicyV1,
} from "./open-clarification-policy-v1.js";

function clone(value) {
  return structuredClone(value);
}

export function buildOpenClarificationCandidatesV1(
  nodeId,
) {
  const policy =
    getOpenClarificationPolicyV1(
      nodeId,
    );

  if (
    !policy ||
    policy.canResolveDirectly !== true ||
    !Array.isArray(
      policy.allowedTagIds,
    ) ||
    policy.allowedTagIds.length === 0
  ) {
    return [];
  }

  const allowed =
    new Set(
      policy.allowedTagIds.map(
        Number,
      ),
    );

  return HELPCHAT_SEMANTIC_PROTOTYPES
    .filter(
      (prototype) =>
        allowed.has(
          Number(
            prototype.tagId,
          ),
        ),
    )
    .map(
      (prototype) =>
        clone({
          tagId:
            prototype.tagId,
          tag:
            prototype.tag,
          text:
            prototype.text,
        }),
    );
}
