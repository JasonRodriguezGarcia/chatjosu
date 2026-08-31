import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  buildAssociationSemanticCandidateGateV1,
} from "./lib/association-semantic-candidate-gate-v1.js";

const ROOT = process.cwd();

const PROMPT_PATH = path.join(
  ROOT,
  "data/curation/semantic/prompts/discovery-single-v3.txt"
);

const INPUT_PATH = path.join(
  ROOT,
  "data/curation/semantic/discovery/euskadi-single-benchmark-6-v2.json"
);

const OUTPUT_DIR = path.join(
  ROOT,
  "data/curation/semantic/discovery/runs/single-gated-v5"
);

const MODEL = "qwen3:8b";

const NUM_CTX = 8192;
const NUM_PREDICT = 1536;

const WORKERS = [
  {
    id: "gpu0-3060ti",
    url: "http://127.0.0.1:11436",
  },
  {
    id: "gpu1-3080",
    url: "http://127.0.0.1:11437",
  },
];

const RELEVANCE_CODES =
  ["D", "S", "C", "I", "O", "U"];

const ROLE_CODES =
  ["D", "S", "I", "U"];

const CONFIDENCE_CODES =
  ["H", "M", "L"];

function sha256(text) {
  return crypto
    .createHash("sha256")
    .update(text)
    .digest("hex");
}

function loadJson(filename) {
  return JSON.parse(
    fs.readFileSync(
      filename,
      "utf8"
    )
  );
}

function enumKeys(values) {
  return values.map(
    row =>
      typeof row === "string"
        ? row
        : row.key
  );
}

function evidenceRefs(fields) {
  return Object.entries(fields)
    .filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
    )
    .map(
      ([key]) =>
        key
    );
}

function tupleSchema(items) {
  return {
    type: "array",
    prefixItems: items,
    minItems: items.length,
    maxItems: items.length,
  };
}

function buildSchema(
  allowed,
  refs
) {
  const needKeys =
    enumKeys(
      allowed.needs
    );

  return {
    type: "object",

    required: [
      "relevance",
      "needs",
      "populations",
      "functions",
      "activities",
      "organization_type",
      "service_modes",
      "suggested",
      "flags",
    ],

    additionalProperties:
      false,

    properties: {
      relevance:
        tupleSchema([
          {
            type: "string",
            enum:
              RELEVANCE_CODES,
          },
          {
            type: "string",
            enum:
              CONFIDENCE_CODES,
          },
          {
            type: "array",
            items: {
              type: "string",
              enum: refs,
            },
            uniqueItems: true,
            maxItems: 4,
          },
        ]),

      needs:
        needKeys.length === 0
          ? {
              const: [],
            }
          : {
              type: "array",
              maxItems:
                Math.min(
                  8,
                  needKeys.length
                ),
              items:
                tupleSchema([
                  {
                    type: "string",
                    enum: needKeys,
                  },
                  {
                    type: "string",
                    enum:
                      ROLE_CODES,
                  },
                  {
                    type: "string",
                    enum:
                      CONFIDENCE_CODES,
                  },
                  {
                    type: "array",
                    items: {
                      type: "string",
                      enum: refs,
                    },
                    uniqueItems: true,
                    maxItems: 4,
                  },
                ]),
            },

      populations: {
        type: "array",
        maxItems: 8,
        items:
          tupleSchema([
            {
              type: "string",
              enum:
                allowed.populations,
            },
            {
              type: "string",
              enum:
                CONFIDENCE_CODES,
            },
            {
              type: "array",
              items: {
                type: "string",
                enum: refs,
              },
              uniqueItems: true,
              maxItems: 4,
            },
          ]),
      },

      functions: {
        type: "array",
        maxItems: 10,
        items:
          tupleSchema([
            {
              type: "string",
              enum:
                allowed.functions,
            },
            {
              type: "string",
              enum:
                CONFIDENCE_CODES,
            },
            {
              type: "array",
              items: {
                type: "string",
                enum: refs,
              },
              uniqueItems: true,
              maxItems: 4,
            },
          ]),
      },

      activities: {
        type: "array",
        maxItems: 10,
        items:
          tupleSchema([
            {
              type: "string",
              enum:
                allowed.activities,
            },
            {
              type: "string",
              enum:
                CONFIDENCE_CODES,
            },
            {
              type: "array",
              items: {
                type: "string",
                enum: refs,
              },
              uniqueItems: true,
              maxItems: 4,
            },
          ]),
      },

      organization_type:
        tupleSchema([
          {
            type: "string",
            enum:
              allowed
                .organization_types,
          },
          {
            type: "string",
            enum:
              CONFIDENCE_CODES,
          },
        ]),

      service_modes: {
        type: "array",
        uniqueItems: true,
        maxItems: 6,
        items: {
          type: "string",
          enum:
            allowed
              .service_modes,
        },
      },

      suggested: {
        type: "array",
        maxItems: 8,
        items:
          tupleSchema([
            {
              type: "string",
              enum: [
                "need",
                "population",
                "function",
                "activity",
              ],
            },
            {
              type: "string",
              minLength: 2,
              maxLength: 80,
            },
            {
              type: "string",
              enum:
                CONFIDENCE_CODES,
            },
            {
              type: "array",
              items: {
                type: "string",
                enum: refs,
              },
              uniqueItems: true,
              maxItems: 4,
            },
          ]),
      },

      flags: {
        type: "array",
        maxItems: 8,
        items: {
          type: "string",
          maxLength: 80,
        },
      },
    },
  };
}

function validateResult(
  result,
  allowed,
  refs
) {
  if (
    !Array.isArray(
      result.relevance
    ) ||
    result.relevance.length !== 3
  ) {
    throw new Error(
      "INVALID_RELEVANCE_SHAPE"
    );
  }

  if (
    !RELEVANCE_CODES.includes(
      result.relevance[0]
    )
  ) {
    throw new Error(
      `INVALID_RELEVANCE:${result.relevance[0]}`
    );
  }

  if (
    !CONFIDENCE_CODES.includes(
      result.relevance[1]
    )
  ) {
    throw new Error(
      `INVALID_CONFIDENCE:${result.relevance[1]}`
    );
  }

  const refSet =
    new Set(refs);

  const checkRefs = (
    evidence,
    label
  ) => {
    for (
      const ref
      of evidence ?? []
    ) {
      if (
        !refSet.has(ref)
      ) {
        throw new Error(
          `INVALID_EVIDENCE_REF:${label}:${ref}`
        );
      }
    }
  };

  checkRefs(
    result.relevance[2],
    "relevance"
  );

  const needs =
    new Set(
      enumKeys(
        allowed.needs
      )
    );

  for (
    const row
    of result.needs ?? []
  ) {
    if (
      !needs.has(row[0])
    ) {
      throw new Error(
        `NONCANONICAL_NEED:${row[0]}`
      );
    }

    if (
      !ROLE_CODES.includes(
        row[1]
      )
    ) {
      throw new Error(
        `INVALID_NEED_ROLE:${row[1]}`
      );
    }

    checkRefs(
      row[3],
      `need:${row[0]}`
    );
  }

  for (
    const [
      key,
      ,
      evidence,
    ]
    of result.populations ?? []
  ) {
    if (
      !allowed
        .populations
        .includes(key)
    ) {
      throw new Error(
        `NONCANONICAL_POPULATION:${key}`
      );
    }

    checkRefs(
      evidence,
      `population:${key}`
    );
  }

  for (
    const [
      key,
      ,
      evidence,
    ]
    of result.functions ?? []
  ) {
    if (
      !allowed
        .functions
        .includes(key)
    ) {
      throw new Error(
        `NONCANONICAL_FUNCTION:${key}`
      );
    }

    checkRefs(
      evidence,
      `function:${key}`
    );
  }

  for (
    const [
      key,
      ,
      evidence,
    ]
    of result.activities ?? []
  ) {
    if (
      !allowed
        .activities
        .includes(key)
    ) {
      throw new Error(
        `NONCANONICAL_ACTIVITY:${key}`
      );
    }

    checkRefs(
      evidence,
      `activity:${key}`
    );
  }

  if (
    !allowed
      .organization_types
      .includes(
        result
          .organization_type?.[0]
      )
  ) {
    throw new Error(
      `INVALID_ORGANIZATION_TYPE:${result.organization_type?.[0]}`
    );
  }

  for (
    const mode
    of result.service_modes ?? []
  ) {
    if (
      !allowed
        .service_modes
        .includes(mode)
    ) {
      throw new Error(
        `INVALID_SERVICE_MODE:${mode}`
      );
    }
  }

  for (
    const row
    of result.suggested ?? []
  ) {
    checkRefs(
      row[3],
      `suggested:${row[1]}`
    );
  }
}

async function getModelInfo(
  worker
) {
  const response =
    await fetch(
      `${worker.url}/api/tags`
    );

  if (!response.ok) {
    throw new Error(
      `${worker.id}:TAGS_HTTP_${response.status}`
    );
  }

  const data =
    await response.json();

  const model =
    data.models?.find(
      row =>
        row.name === MODEL
    );

  if (!model) {
    throw new Error(
      `${worker.id}:MODEL_NOT_FOUND`
    );
  }

  return model;
}

async function runOne({
  worker,
  job,
  prompt,
  allowed,
  modelInfo,
}) {
  const record =
    job.record;

  const refs =
    evidenceRefs(
      record.fields
    );

  const categoryText =
    [
      record.fields.C1,
      record.fields.C2,
      record.fields.C3,
    ]
      .filter(Boolean)
      .join(" | ");

  const gate =
    buildAssociationSemanticCandidateGateV1({
      name:
        record.fields.N1,

      description:
        record.fields.D1,

      originalCategory:
        categoryText,
    });

  const candidateNeedKeys =
    new Set(
      gate
        .needs
        .candidates
        .map(
          row => row.key
        )
    );

  const gatedAllowed = {
    ...allowed,

    needs:
      allowed
        .needs
        .filter(
          row =>
            candidateNeedKeys.has(
              row.key
            )
        ),
  };

  const schema =
    buildSchema(
      gatedAllowed,
      refs
    );

  const needInstruction =
    gatedAllowed.needs.length === 0
      ? [
          "RESTRICCION CRITICA PARA ESTE REGISTRO:",
          "No existe ninguna necesidad canonica candidata.",
          "El campo needs DEBE ser exactamente [].",
          "No coloques funciones como TERAPIA, ASESORAMIENTO,",
          "SENSIBILIZACION, INVESTIGACION o FORMACION dentro de needs.",
          "Si existe una necesidad real no cubierta por allowed.needs,",
          "usa suggested con tipo need.",
        ].join("\n")
      : [
          "RESTRICCION CRITICA PARA ESTE REGISTRO:",
          "needs solo puede contener las claves incluidas en",
          "allowed.needs para este registro.",
          "No introduzcas ninguna otra clave canonica.",
          "Los conceptos no representados deben ir a suggested.",
        ].join("\n");

  const requestInput = {
    allowed:
      gatedAllowed,

    candidate_gate:
      gate,

    record:
      record.fields,
  };

  const started =
    Date.now();

  const body = {
    model:
      MODEL,

    stream:
      false,

    think:
      job.think,

    keep_alive:
      "30m",

    options: {
      temperature:
        0,

      num_ctx:
        NUM_CTX,

      num_predict:
        NUM_PREDICT,
    },

    format:
      schema,

    prompt: [
      prompt,
      "",
      "ALLOWED:",
      JSON.stringify(
        gatedAllowed
      ),
      "",
      needInstruction,
      "",
      "REGISTRO:",
      JSON.stringify(
        record.fields
      ),
    ].join("\n"),
  };

  const response =
    await fetch(
      `${worker.url}/api/generate`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
        },
        body:
          JSON.stringify(body),
      }
    );

  const elapsedMs =
    Date.now() -
    started;

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `${job.run_id}:HTTP_${response.status}:${text.slice(0, 300)}`
    );
  }

  const api =
    await response.json();

  fs.mkdirSync(
    OUTPUT_DIR,
    {
      recursive: true,
    }
  );

  const rawPath =
    path.join(
      OUTPUT_DIR,
      `${job.run_id}.raw.json`
    );

  /*
   * Diagnostic invariant:
   * persist raw model output before parsing
   * or semantic validation.
   */
  fs.writeFileSync(
    rawPath,
    JSON.stringify(
      {
        candidate_id:
          record.candidate_id,

        worker:
          worker.id,

        think:
          job.think,

        model:
          {
            name:
              modelInfo.name,
            digest:
              modelInfo.digest,
          },

        evidence_refs:
          refs,

        request_input:
          requestInput,

        candidate_gate:
          gate,

        need_instruction:
          needInstruction,

        response:
          api.response,

        thinking:
          api.thinking ?? null,

        done:
          api.done,

        done_reason:
          api.done_reason,

        total_duration:
          api.total_duration,

        load_duration:
          api.load_duration,

        prompt_eval_count:
          api.prompt_eval_count,

        prompt_eval_duration:
          api.prompt_eval_duration,

        eval_count:
          api.eval_count,

        eval_duration:
          api.eval_duration,

        elapsed_ms:
          elapsedMs,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  let parsed;

  try {
    parsed =
      JSON.parse(
        api.response
      );
  } catch (error) {
    throw new Error(
      `${job.run_id}:INVALID_JSON:${error.message}`
    );
  }

  validateResult(
    parsed,
    gatedAllowed,
    refs
  );

  const final = {
    candidate_id:
      record.candidate_id,

    think:
      job.think,

    worker:
      worker.id,

    result:
      parsed,
  };

  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
      `${job.run_id}.result.json`
    ),
    JSON.stringify(
      final,
      null,
      2
    ) + "\n",
    "utf8"
  );

  return {
    status:
      "valid",

    run_id:
      job.run_id,

    candidate_id:
      record.candidate_id,

    think:
      job.think,

    worker:
      worker.id,

    elapsed_ms:
      elapsedMs,

    prompt_tokens:
      api.prompt_eval_count
      ?? null,

    output_tokens:
      api.eval_count
      ?? null,

    thinking_chars:
      typeof api.thinking ===
      "string"
        ? api.thinking.length
        : 0,

    response_chars:
      typeof api.response ===
      "string"
        ? api.response.length
        : 0,

    done_reason:
      api.done_reason ?? null,

    result:
      parsed,
  };
}

async function runQueue({
  jobs,
  prompt,
  allowed,
  modelInfos,
}) {
  const queue =
    [...jobs];

  const completed =
    [];

  async function loop(
    worker,
    modelInfo
  ) {
    while (
      queue.length > 0
    ) {
      const job =
        queue.shift();

      if (!job) {
        break;
      }

      console.log(
        `START worker=${worker.id} think=${job.think} candidate=${job.record.candidate_id}`
      );

      try {
        const result =
          await runOne({
            worker,
            job,
            prompt,
            allowed,
            modelInfo,
          });

        completed.push(
          result
        );

        console.log(
          `DONE worker=${worker.id} think=${job.think} candidate=${job.record.candidate_id} elapsed_ms=${result.elapsed_ms} output_tokens=${result.output_tokens}`
        );
      } catch (error) {
        const failed = {
          run_id:
            job.run_id,

          candidate_id:
            job.record.candidate_id,

          think:
            job.think,

          worker:
            worker.id,

          status:
            "failed",

          error:
            error?.message
            ?? String(error),
        };

        completed.push(
          failed
        );

        fs.mkdirSync(
          OUTPUT_DIR,
          {
            recursive: true,
          }
        );

        fs.writeFileSync(
          path.join(
            OUTPUT_DIR,
            `${job.run_id}.error.json`
          ),
          JSON.stringify(
            failed,
            null,
            2
          ) + "\n",
          "utf8"
        );

        console.error(
          `FAILED worker=${worker.id} candidate=${job.record.candidate_id} error=${failed.error}`
        );
      }
    }
  }

  await Promise.all(
    WORKERS.map(
      (worker, index) =>
        loop(
          worker,
          modelInfos[index]
        )
    )
  );

  return completed;
}

async function main() {
  const prompt =
    fs.readFileSync(
      PROMPT_PATH,
      "utf8"
    );

  const input =
    loadJson(
      INPUT_PATH
    );

  if (
    input.records.length !== 6
  ) {
    throw new Error(
      `EXPECTED_6_RECORDS_GOT_${input.records.length}`
    );
  }

  const modelInfos =
    await Promise.all(
      WORKERS.map(
        getModelInfo
      )
    );

  const digests =
    new Set(
      modelInfos.map(
        row =>
          row.digest
      )
    );

  if (
    digests.size !== 1
  ) {
    throw new Error(
      "MODEL_DIGEST_MISMATCH"
    );
  }

  /*
   * Two separate rounds avoid one mode
   * monopolising the queue.
   *
   * Both GPUs participate in each mode.
   */
  const jobs =
    input.records.map(
      (record, index) => ({
        record,
        think: false,
        run_id:
          `r${index + 1}-gated-false`,
      })
    );

  const benchmarkStarted =
    Date.now();

  console.log(
    "ROUND_GATED_FALSE=START"
  );

  const results =
    await runQueue({
      jobs,
      prompt,
      allowed:
        input.allowed,
      modelInfos,
    });

  console.log(
    "ROUND_GATED_FALSE=DONE"
  );

  const benchmarkFinished =
    Date.now();

  const report = {
    format_version:
      2,

    benchmark_version:
      "5.0",

    model:
      MODEL,

    model_digest:
      modelInfos[0].digest,

    num_ctx:
      NUM_CTX,

    num_predict:
      NUM_PREDICT,

    records:
      input.records.length,

    inferences:
      results.length,

    valid_inferences:
      results.filter(
        row =>
          row.status === "valid"
      ).length,

    failed_inferences:
      results.filter(
        row =>
          row.status === "failed"
      ).length,

    prompt_sha256:
      sha256(prompt),

    input_sha256:
      sha256(
        fs.readFileSync(
          INPUT_PATH,
          "utf8"
        )
      ),

    elapsed_ms:
      benchmarkFinished -
      benchmarkStarted,

    results,
  };

  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
      "report.json"
    ),
    JSON.stringify(
      report,
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(
    "BENCHMARK_V5=PASS"
  );

  console.log(
    `INFERENCES=${results.length}`
  );

  console.log(
    `ELAPSED_MS=${report.elapsed_ms}`
  );
}

main().catch(
  error => {
    console.error(
      error.stack ||
      error.message
    );

    process.exitCode = 1;
  }
);
