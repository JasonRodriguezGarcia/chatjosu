import assert from "node:assert/strict";

import {
  getNavarraSourceTaxonomyCoverageV1,
  mapNavarraSourceTaxonomyV1,
} from "../scripts/lib/navarra-source-taxonomy-mapper-v1.js";

const coverage =
  getNavarraSourceTaxonomyCoverageV1();

assert.equal(
  coverage.class_count,
  27
);

assert.equal(
  new Set(
    coverage.classes
  ).size,
  27
);

/*
 * Official population assertion.
 */
{
  const result =
    mapNavarraSourceTaxonomyV1({
      sourceClass:
        "Personas Mayores",
    });

  assert.equal(
    result.matched,
    true
  );

  assert.equal(
    result.mode,
    "source_assertion"
  );

  assert.deepEqual(
    result.assertions,
    {
      populations: [
        "PERSONAS_MAYORES",
      ],
    }
  );

  assert.deepEqual(
    result.candidates,
    {}
  );
}

/*
 * Strong but not automatic population
 * materialization.
 */
{
  const result =
    mapNavarraSourceTaxonomyV1({
      sourceClass:
        "Inmigración",
    });

  assert.equal(
    result.mode,
    "strong_candidate"
  );

  assert.deepEqual(
    result.assertions,
    {}
  );

  assert.deepEqual(
    result.candidates,
    {
      populations: [
        "MIGRANTES",
      ],
    }
  );
}

/*
 * Broad activity set.
 */
{
  const result =
    mapNavarraSourceTaxonomyV1({
      sourceClass:
        "Deportivas, Recreativas y de Ocio",
    });

  assert.equal(
    result.mode,
    "candidate_set"
  );

  assert.ok(
    result.candidates
      .activities
      .includes(
        "DEPORTE"
      )
  );

  assert.ok(
    result.candidates
      .activities
      .includes(
        "OCIO"
      )
  );
}

/*
 * APYMA/alumnado is broad family/education context.
 * It must not manufacture INFANCIA or JUVENTUD.
 */
{
  const result =
    mapNavarraSourceTaxonomyV1({
      sourceClass:
        "Apymas y Alumnos",
    });

  assert.equal(
    result.mode,
    "candidate_set"
  );

  assert.deepEqual(
    result.assertions,
    {}
  );

  assert.deepEqual(
    result.candidates,
    {
      populations: [
        "FAMILIAS",
      ],
    }
  );
}

/*
 * The official disability/social-health class
 * is disjunctive, therefore disability remains
 * a candidate rather than a strong assertion.
 */
{
  const result =
    mapNavarraSourceTaxonomyV1({
      sourceClass:
        "Discapacidad y Asistencia Socio-Sanitaria",
    });

  assert.equal(
    result.mode,
    "candidate_set"
  );

  assert.deepEqual(
    result.assertions,
    {}
  );

  assert.deepEqual(
    result.candidates,
    {
      populations: [
        "PERSONAS_CON_DISCAPACIDAD",
      ],
    }
  );
}

/*
 * Context does not assert concepts.
 */
{
  const result =
    mapNavarraSourceTaxonomyV1({
      sourceClass:
        "Sanitarias",
    });

  assert.equal(
    result.mode,
    "context"
  );

  assert.deepEqual(
    result.assertions,
    {}
  );

  assert.deepEqual(
    result.candidates,
    {}
  );

  assert.deepEqual(
    result.hints,
    [
      "health_context",
    ]
  );
}

/*
 * Missing official class is an explicit
 * known taxonomy value, not an unknown.
 */
{
  const result =
    mapNavarraSourceTaxonomyV1({
      sourceClass: null,
    });

  assert.equal(
    result.matched,
    true
  );

  assert.equal(
    result.mode,
    "none"
  );
}

/*
 * Truly unknown values must remain visible.
 */
{
  const result =
    mapNavarraSourceTaxonomyV1({
      sourceClass:
        "THIS CLASS DOES NOT EXIST",
    });

  assert.equal(
    result.matched,
    false
  );

  assert.deepEqual(
    result.assertions,
    {}
  );

  assert.deepEqual(
    result.candidates,
    {}
  );
}

console.log(
  "NAVARRA_SOURCE_TAXONOMY_CLASSES=",
  coverage.class_count
);

console.log(
  "NAVARRA_SOURCE_TAXONOMY_MAPPER=PASS"
);
