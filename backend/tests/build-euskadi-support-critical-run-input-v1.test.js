import assert from "node:assert/strict";
import test from "node:test";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  spawnSync,
} from "node:child_process";

test(
  "support critical run input preserves distinct source evidence fields",
  () => {
    const source =
      fs.readFileSync(
        "backend/scripts/build-euskadi-support-critical-run-input-v1.js",
        "utf8"
      );

    for (
      const ref
      of [
        "N1",
        "C1",
        "C2",
        "C3",
        "S1",
        "T1",
        "M1",
        "D1",
      ]
    ) {
      assert.match(
        source,
        new RegExp(
          `\\b${ref}\\b`
        )
      );
    }

    assert.match(
      source,
      /preserve_original/
    );

    assert.match(
      source,
      /proposal_only/
    );

    assert.doesNotMatch(
      source,
      /translation_applied:\s*true/
    );
  }
);

test(
  "builder never requires description when other source evidence exists",
  () => {
    const source =
      fs.readFileSync(
        "backend/scripts/build-euskadi-support-critical-run-input-v1.js",
        "utf8"
      );

    assert.match(
      source,
      /evidenceCoverage\.D1 !==\s*309/
    );

    assert.doesNotMatch(
      source,
      /if\s*\(\s*!fields\.D1\s*\)/
    );
  }
);
