import assert from "node:assert/strict";
import fs from "node:fs";

import {
  getEuskadiSourceTaxonomyCoverageV1,
  mapEuskadiSourceTaxonomyV1,
} from "../scripts/lib/euskadi-source-taxonomy-mapper-v1.js";

const GOLD_PATH =
  "data/curation/semantic/gold/"
  + "euskadi-source-taxonomy-gold-v1.json";

const gold = JSON.parse(
  fs.readFileSync(
    GOLD_PATH,
    "utf8"
  )
);

function sortedJson(value) {
  if (Array.isArray(value)) {
    return value
      .map(sortedJson)
      .sort(
        (a, b) =>
          JSON.stringify(a)
            .localeCompare(
              JSON.stringify(b)
            )
      );
  }

  if (
    value
    && typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(
          key => [
            key,
            sortedJson(
              value[key]
            ),
          ]
        )
    );
  }

  return value;
}

const coverage =
  getEuskadiSourceTaxonomyCoverageV1();

assert.equal(
  coverage.goal_type_count,
  60
);

for (const testCase of gold.cases) {
  const sample =
    testCase.evidence_samples[0];

  assert.ok(
    sample,
    `Missing evidence sample for ${testCase.source_value}`
  );

  const result =
    mapEuskadiSourceTaxonomyV1({
      section:
        "Asociación",

      sorting:
        sample.sorting,

      goalType:
        testCase.source_value,
    });

  assert.equal(
    result.matched,
    true,
    testCase.source_value
  );

  assert.equal(
    result.mode,
    testCase.expected_mode,
    testCase.source_value
  );

  if (
    testCase.expected_mode
    === "source_assertion"
  ) {
    assert.deepEqual(
      sortedJson(
        result.assertions
      ),
      sortedJson(
        testCase.expected_semantics
      ),
      testCase.source_value
    );

    assert.deepEqual(
      result.candidates,
      {},
      testCase.source_value
    );
  }

  if (
    testCase.expected_mode
      === "strong_candidate"
    || testCase.expected_mode
      === "candidate_set"
  ) {
    assert.deepEqual(
      result.assertions,
      {},
      testCase.source_value
    );

    assert.deepEqual(
      sortedJson(
        result.candidates
      ),
      sortedJson(
        testCase.expected_semantics
      ),
      testCase.source_value
    );
  }

  if (
    testCase.expected_mode
      === "context"
    || testCase.expected_mode
      === "none"
  ) {
    assert.deepEqual(
      result.assertions,
      {},
      testCase.source_value
    );

    assert.deepEqual(
      result.candidates,
      {},
      testCase.source_value
    );
  }

  assert.deepEqual(
    sortedJson(
      result.hints
    ),
    sortedJson(
      testCase.expected_hints
    ),
    testCase.source_value
  );
}

const unknown =
  mapEuskadiSourceTaxonomyV1({
    goalType:
      "THIS VALUE DOES NOT EXIST",
  });

assert.equal(
  unknown.matched,
  false
);

assert.deepEqual(
  unknown.assertions,
  {}
);

assert.deepEqual(
  unknown.candidates,
  {}
);

console.log(
  "EUSKADI_SOURCE_TAXONOMY_GOLD_CASES=",
  gold.cases.length
);

console.log(
  "EUSKADI_SOURCE_TAXONOMY_MAPPER=PASS"
);
