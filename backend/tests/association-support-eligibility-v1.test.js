import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAssociationSupportEligibilityV1,
} from "../scripts/lib/association-support-eligibility-v1.js";

test(
  "direct relevance grants support eligibility",
  () => {
    const result =
      buildAssociationSupportEligibilityV1({
        relevanceDecision:
          "keep",
      });

    assert.equal(
      result.eligible,
      true
    );

    assert.deepEqual(
      result.reasons,
      [
        "direct_relevance",
      ]
    );
  }
);

test(
  "explicit need grants support eligibility",
  () => {
    const result =
      buildAssociationSupportEligibilityV1({
        relevanceDecision:
          "review",

        needKeys: [
          "SALUD_MENTAL",
        ],
      });

    assert.equal(
      result.eligible,
      true
    );

    assert.ok(
      result.reasons.includes(
        "need"
      )
    );
  }
);

test(
  "protective support-domain hint grants eligibility",
  () => {
    const result =
      buildAssociationSupportEligibilityV1({
        relevanceDecision:
          "review",

        hints: [
          "social_support_resource",
        ],
      });

    assert.equal(
      result.eligible,
      true
    );

    assert.ok(
      result.reasons.includes(
        "protective_hint"
      )
    );
  }
);

test(
  "non-protective hint does not grant eligibility",
  () => {
    const result =
      buildAssociationSupportEligibilityV1({
        relevanceDecision:
          "review",

        hints: [
          "neighbourhood_association",
        ],
      });

    assert.equal(
      result.eligible,
      false
    );
  }
);

test(
  "review without domain signal is not support eligible",
  () => {
    const result =
      buildAssociationSupportEligibilityV1({
        relevanceDecision:
          "review",
      });

    assert.equal(
      result.eligible,
      false
    );

    assert.deepEqual(
      result.reasons,
      []
    );
  }
);

test(
  "drop can be rescued by explicit need",
  () => {
    const result =
      buildAssociationSupportEligibilityV1({
        relevanceDecision:
          "drop",

        needKeys: [
          "DISCAPACIDAD",
        ],
      });

    assert.equal(
      result.eligible,
      true
    );

    assert.deepEqual(
      result.reasons,
      [
        "need",
      ]
    );
  }
);
