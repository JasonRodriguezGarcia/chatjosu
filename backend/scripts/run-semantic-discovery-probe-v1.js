import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const PROMPT_PATH = path.join(
  ROOT,
  "data/curation/semantic/prompts/discovery-prompt-v1.txt"
);

const INPUT_PATH = path.join(
  ROOT,
  "data/curation/semantic/discovery/euskadi-probe-24-v1.json"
);

const OUTPUT_DIR = path.join(
  ROOT,
  "data/curation/semantic/discovery/runs/probe-v1"
);

const OUTPUT_PATH = path.join(
  OUTPUT_DIR,
  "results.jsonl"
);

const REPORT_PATH = path.join(
  OUTPUT_DIR,
  "report.json"
);

const RAW_DIR = path.join(
  OUTPUT_DIR,
  "raw"
);

const MODEL =
  "qwen3:8b";

const BATCH_SIZE = 8;

const WORKERS = [
  {
    id: "gpu0-3060ti",
    url:
      "http://127.0.0.1:11436",
  },
  {
    id: "gpu1-3080",
    url:
      "http://127.0.0.1:11437",
  },
];

function sha256(text) {
  return crypto
    .createHash("sha256")
    .update(text)
    .digest("hex");
}

function sleep(ms) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}

function parseJsonResponse(
  text
) {
  const trimmed =
    String(text ?? "")
      .trim();

  try {
    return JSON.parse(
      trimmed
    );
  } catch {
    const first =
      trimmed.indexOf("{");

    const last =
      trimmed.lastIndexOf("}");

    if (
      first >= 0 &&
      last > first
    ) {
      return JSON.parse(
        trimmed.slice(
          first,
          last + 1
        )
      );
    }

    throw new Error(
      "MODEL_RESPONSE_NOT_JSON"
    );
  }
}

function batchesOf(
  rows,
  size
) {
  const out = [];

  for (
    let i = 0;
    i < rows.length;
    i += size
  ) {
    out.push(
      rows.slice(
        i,
        i + size
      )
    );
  }

  return out;
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

  return {
    name:
      model.name,
    digest:
      model.digest,
    size:
      model.size,
    details:
      model.details,
  };
}

function validateResults(
  expectedRecords,
  parsed,
  allowed
) {
  if (
    !parsed ||
    !Array.isArray(
      parsed.results
    )
  ) {
    throw new Error(
      "RESULTS_ARRAY_MISSING"
    );
  }

  const expectedIds =
    expectedRecords.map(
      row =>
        row.candidate_id
    );

  const actualIds =
    parsed.results.map(
      row =>
        row.candidate_id
    );

  if (
    expectedIds.length !==
    actualIds.length
  ) {
    throw new Error(
      `ID_COUNT_MISMATCH expected=${expectedIds.length} actual=${actualIds.length}`
    );
  }

  const expectedSet =
    new Set(expectedIds);

  const actualSet =
    new Set(actualIds);

  if (
    actualSet.size !==
    actualIds.length
  ) {
    throw new Error(
      "DUPLICATE_OUTPUT_IDS"
    );
  }

  for (const id of expectedIds) {
    if (
      !actualSet.has(id)
    ) {
      throw new Error(
        `MISSING_ID:${id}`
      );
    }
  }

  for (const id of actualIds) {
    if (
      !expectedSet.has(id)
    ) {
      throw new Error(
        `UNEXPECTED_ID:${id}`
      );
    }
  }

  const relevance =
    new Set(
      allowed
        .relevance_classes
    );

  const roles =
    new Set(
      allowed
        .relation_roles
    );

  const confidence =
    new Set(
      allowed
        .confidence_levels
    );

  const needs =
    new Set(
      allowed
        .needs
        .map(
          row =>
            row.key
        )
    );

  const functions =
    new Set(
      allowed.functions
    );

  const populations =
    new Set(
      allowed.populations
    );

  const activities =
    new Set(
      allowed.activities
    );

  const orgTypes =
    new Set(
      allowed
        .organization_types
    );

  const serviceModes =
    new Set(
      allowed
        .service_modes
    );

  for (
    const row
    of parsed.results
  ) {
    if (
      !relevance.has(
        row
          ?.relevance
          ?.class
      )
    ) {
      throw new Error(
        `INVALID_RELEVANCE:${row.candidate_id}`
      );
    }

    if (
      !confidence.has(
        row
          ?.relevance
          ?.confidence
      )
    ) {
      throw new Error(
        `INVALID_RELEVANCE_CONFIDENCE:${row.candidate_id}`
      );
    }

    for (
      const item
      of row.needs ?? []
    ) {
      if (
        !needs.has(
          item.key
        )
      ) {
        throw new Error(
          `NONCANONICAL_NEED:${row.candidate_id}:${item.key}`
        );
      }

      if (
        !roles.has(
          item.role
        )
      ) {
        throw new Error(
          `INVALID_NEED_ROLE:${row.candidate_id}:${item.role}`
        );
      }
    }

    for (
      const item
      of row.functions ?? []
    ) {
      if (
        !functions.has(
          item.key
        )
      ) {
        throw new Error(
          `NONCANONICAL_FUNCTION:${row.candidate_id}:${item.key}`
        );
      }
    }

    for (
      const item
      of row.populations ?? []
    ) {
      if (
        !populations.has(
          item.key
        )
      ) {
        throw new Error(
          `NONCANONICAL_POPULATION:${row.candidate_id}:${item.key}`
        );
      }
    }

    for (
      const item
      of row.activities ?? []
    ) {
      if (
        !activities.has(
          item.key
        )
      ) {
        throw new Error(
          `NONCANONICAL_ACTIVITY:${row.candidate_id}:${item.key}`
        );
      }
    }

    if (
      !orgTypes.has(
        row
          ?.organization_type
          ?.key
      )
    ) {
      throw new Error(
        `INVALID_ORGANIZATION_TYPE:${row.candidate_id}`
      );
    }

    for (
      const mode
      of row.service_modes ?? []
    ) {
      if (
        !serviceModes.has(
          mode
        )
      ) {
        throw new Error(
          `INVALID_SERVICE_MODE:${row.candidate_id}:${mode}`
        );
      }
    }
  }

  return true;
}

async function runBatch(
  worker,
  batch,
  batchIndex,
  prompt,
  allowed,
  modelInfo
) {
  const batchId =
    String(
      batchIndex
    ).padStart(
      3,
      "0"
    );

  const rawPath =
    path.join(
      RAW_DIR,
      `batch-${batchId}.json`
    );

  const started =
    Date.now();

  const requestBody = {
    model:
      MODEL,

    stream:
      false,

    keep_alive:
      "30m",

    options: {
      temperature: 0,
    },

    think:
      false,

    format: {
      type: "object",
      required: [
        "results"
      ],
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            required: [
              "candidate_id",
              "relevance",
              "needs",
              "populations",
              "functions",
              "activities",
              "organization_type",
              "service_modes",
              "suggested_concepts",
              "quality_flags"
            ],
            properties: {
              candidate_id: {
                type: "string"
              },
              relevance: {
                type: "object",
                required: [
                  "class",
                  "confidence",
                  "evidence"
                ],
                properties: {
                  class: {
                    type: "string"
                  },
                  confidence: {
                    type: "string"
                  },
                  evidence: {
                    type: "string"
                  }
                }
              },
              needs: {
                type: "array"
              },
              populations: {
                type: "array"
              },
              functions: {
                type: "array"
              },
              activities: {
                type: "array"
              },
              organization_type: {
                type: "object"
              },
              service_modes: {
                type: "array"
              },
              suggested_concepts: {
                type: "array"
              },
              quality_flags: {
                type: "array"
              }
            }
          }
        }
      }
    },

    prompt:
      [
        prompt,
        "",
        "VOCABULARIO PERMITIDO:",
        JSON.stringify(
          allowed
        ),
        "",
        "REGISTROS:",
        JSON.stringify(
          batch
        ),
      ].join("\n"),
  };

  const response =
    await fetch(
      `${worker.url}/api/generate`,
      {
        method:
          "POST",

        headers: {
          "content-type":
            "application/json",
        },

        body:
          JSON.stringify(
            requestBody
          ),
      }
    );

  if (!response.ok) {
    throw new Error(
      `${worker.id}:GENERATE_HTTP_${response.status}`
    );
  }

  const api =
    await response.json();

  /*
   * Persist the raw Ollama response BEFORE
   * semantic validation. Invalid generations
   * are diagnostic evidence and must survive.
   */
  fs.writeFileSync(
    rawPath,
    JSON.stringify(
      {
        worker:
          worker.id,

        batch_index:
          batchIndex,

        candidate_ids:
          batch.map(
            row =>
              row.candidate_id
          ),

        model:
          modelInfo,

        api_metadata: {
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
        },

        response:
          api.response,

        thinking:
          api.thinking ?? null,

        done_reason:
          api.done_reason ?? null,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  const parsed =
    parseJsonResponse(
      api.response
    );

  validateResults(
    batch,
    parsed,
    allowed
  );

  const finished =
    Date.now();

  fs.writeFileSync(
    rawPath,
    JSON.stringify(
      {
        worker:
          worker.id,

        batch_index:
          batchIndex,

        candidate_ids:
          batch.map(
            row =>
              row.candidate_id
          ),

        model:
          modelInfo,

        api_metadata: {
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
        },

        raw_response:
          api.response,

        parsed,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  return {
    worker:
      worker.id,

    batch_index:
      batchIndex,

    started_at:
      new Date(
        started
      ).toISOString(),

    finished_at:
      new Date(
        finished
      ).toISOString(),

    elapsed_ms:
      finished -
      started,

    prompt_tokens:
      api.prompt_eval_count ??
      null,

    output_tokens:
      api.eval_count ??
      null,

    results:
      parsed.results,
  };
}

async function main() {
  const prompt =
    fs.readFileSync(
      PROMPT_PATH,
      "utf8"
    );

  const input =
    JSON.parse(
      fs.readFileSync(
        INPUT_PATH,
        "utf8"
      )
    );

  fs.mkdirSync(
    RAW_DIR,
    {
      recursive: true,
    }
  );

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
      "WORKER_MODEL_DIGEST_MISMATCH"
    );
  }

  const batches =
    batchesOf(
      input.records,
      BATCH_SIZE
    );

  const queue =
    batches.map(
      (batch, index) => ({
        batch,
        index,
      })
    );

  const completed = [];

  async function workerLoop(
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
        `START worker=${worker.id} batch=${job.index} rows=${job.batch.length}`
      );

      let result = null;
      let lastError = null;

      for (
        let attempt = 1;
        attempt <= 2;
        attempt += 1
      ) {
        try {
          result =
            await runBatch(
              worker,
              job.batch,
              job.index,
              prompt,
              input.allowed,
              modelInfo
            );

          break;
        } catch (error) {
          lastError =
            error;

          console.error(
            `RETRY worker=${worker.id} batch=${job.index} attempt=${attempt} error=${error.message}`
          );

          await sleep(
            1500
          );
        }
      }

      if (!result) {
        throw lastError;
      }

      completed.push(
        result
      );

      console.log(
        `DONE worker=${worker.id} batch=${job.index} elapsed_ms=${result.elapsed_ms}`
      );
    }
  }

  const started =
    Date.now();

  await Promise.all(
    WORKERS.map(
      (worker, index) =>
        workerLoop(
          worker,
          modelInfos[index]
        )
    )
  );

  completed.sort(
    (a, b) =>
      a.batch_index -
      b.batch_index
  );

  const rows =
    completed.flatMap(
      batch =>
        batch.results.map(
          row => ({
            ...row,
            _run: {
              worker:
                batch.worker,
              batch_index:
                batch.batch_index,
            },
          })
        )
    );

  const expected =
    new Set(
      input.records.map(
        row =>
          row.candidate_id
      )
    );

  const actual =
    new Set(
      rows.map(
        row =>
          row.candidate_id
      )
    );

  if (
    rows.length !==
    input.records.length ||
    expected.size !==
    actual.size
  ) {
    throw new Error(
      "FINAL_PARITY_FAILED"
    );
  }

  fs.writeFileSync(
    OUTPUT_PATH,
    rows
      .map(
        row =>
          JSON.stringify(row)
      )
      .join("\n") +
      "\n",
    "utf8"
  );

  const finished =
    Date.now();

  const report = {
    format_version: 1,
    runner_version:
      "1.0",

    model:
      MODEL,

    model_digest:
      modelInfos[0]
        .digest,

    prompt_sha256:
      sha256(prompt),

    input_sha256:
      sha256(
        fs.readFileSync(
          INPUT_PATH,
          "utf8"
        )
      ),

    worker_count:
      WORKERS.length,

    batch_size:
      BATCH_SIZE,

    batches:
      completed.length,

    records:
      rows.length,

    started_at:
      new Date(
        started
      ).toISOString(),

    finished_at:
      new Date(
        finished
      ).toISOString(),

    elapsed_ms:
      finished -
      started,

    workers:
      completed.map(
        batch => ({
          worker:
            batch.worker,
          batch_index:
            batch.batch_index,
          elapsed_ms:
            batch.elapsed_ms,
          prompt_tokens:
            batch.prompt_tokens,
          output_tokens:
            batch.output_tokens,
        })
      ),
  };

  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      report,
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(
    `FINAL_RECORDS=${rows.length}`
  );

  console.log(
    "FINAL_PARITY=PASS"
  );

  console.log(
    `ELAPSED_MS=${report.elapsed_ms}`
  );

  console.log(
    `OUTPUT=${path.relative(ROOT, OUTPUT_PATH)}`
  );

  console.log(
    `REPORT=${path.relative(ROOT, REPORT_PATH)}`
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
