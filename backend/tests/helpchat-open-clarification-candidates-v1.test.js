import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOpenClarificationCandidatesV1,
} from "../helpchat/open-clarification-candidates-v1.js";

test(
  "health_detail exposes only its allowed operational catalog",
  () => {
    const candidates =
      buildOpenClarificationCandidatesV1(
        "health_detail",
      );

    const ids =
      candidates.map(
        (candidate) =>
          candidate.tagId,
      );

    assert.ok(
      ids.includes(13),
    );

    assert.ok(
      ids.includes(31),
    );

    assert.equal(
      ids.includes(25),
      false,
    );

    assert.equal(
      ids.includes(2),
      false,
    );
  },
);

test(
  "mental_behavior_detail exposes only bounded mental-health outcomes",
  () => {
    const candidates =
      buildOpenClarificationCandidatesV1(
        "mental_behavior_detail",
      );

    assert.deepEqual(
      candidates.map(
        (candidate) =>
          candidate.tagId,
      ),
      [
        4,
        31,
        32,
        33,
      ],
    );
  },
);

test(
  "substance addiction has no operational candidates to invent",
  () => {
    assert.deepEqual(
      buildOpenClarificationCandidatesV1(
        "addiction_substance_detail",
      ),
      [],
    );
  },
);

test(
  "behavioral addiction has no operational candidates to invent",
  () => {
    assert.deepEqual(
      buildOpenClarificationCandidatesV1(
        "addiction_behavior_detail",
      ),
      [],
    );
  },
);

test(
  "unknown open node exposes no candidates",
  () => {
    assert.deepEqual(
      buildOpenClarificationCandidatesV1(
        "something_else",
      ),
      [],
    );
  },
);
