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
  "data/curation/semantic/discovery/runs/thinking-benchmark-v1"
);

const MODEL = "qwen3:8b";
const NUM_CTX = 8192;

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

function schema() {
  return {
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
  };
}

function parseModelJson(text) {
  const trimmed =
    String(text ?? "").trim();

  try {
    return JSON.parse(trimmed);
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

function validateParity(
  expected,
  actual
) {
  if (
    !actual ||
    !Array.isArray(
      actual.results
    )
  ) {
    throw new Error(
      "RESULTS_ARRAY_MISSING"
    );
  }

  const expectedIds =
    expected.map(
      row =>
        row.candidate_id
    );

  const actualIds =
    actual.results.map(
      row =>
        row.candidate_id
    );

  if (
    actualIds.length !==
    expectedIds.length
  ) {
    throw new Error(
      `COUNT_MISMATCH expected=${expectedIds.length} actual=${actualIds.length}`
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

  for (const id of expectedSet) {
    if (!actualSet.has(id)) {
      throw new Error(
        `MISSING_ID:${id}`
      );
    }
  }

  for (const id of actualSet) {
    if (!expectedSet.has(id)) {
      throw new Error(
        `UNEXPECTED_ID:${id}`
      );
    }
  }
}

async function getModelInfo(worker) {
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
  think,
  records,
  prompt,
  allowed,
  runId,
}) {
  const started =
    Date.now();

  const body = {
    model:
      MODEL,

    stream:
      false,

    think,

    keep_alive:
      "30m",

    options: {
      temperature:
        0,

      num_ctx:
        NUM_CTX,
    },

    format:
      schema(),

    prompt: [
      prompt,
      "",
      "IMPORTANTE:",
      `Debes devolver exactamente ${records.length} resultados.`,
      "Cada candidate_id de entrada debe aparecer exactamente una vez.",
      "",
      "VOCABULARIO PERMITIDO:",
      JSON.stringify(
        allowed
      ),
      "",
      "REGISTROS:",
      JSON.stringify(
        records
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
          JSON.stringify(body),
      }
    );

  const elapsedHttp =
    Date.now() -
    started;

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `${runId}:HTTP_${response.status}:${text.slice(0, 300)}`
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

  /*
   * Raw first: preserve even an invalid
   * semantic generation.
   */
  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
      `${runId}.raw.json`
    ),
    JSON.stringify(
      {
        worker:
          worker.id,
        think,
        request_records:
          records.map(
            row =>
              row.candidate_id
          ),
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
        http_elapsed_ms:
          elapsedHttp,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  const parsed =
    parseModelJson(
      api.response
    );

  validateParity(
    records,
    parsed
  );

  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
      `${runId}.results.json`
    ),
    JSON.stringify(
      parsed,
      null,
      2
    ) + "\n",
    "utf8"
  );

  return {
    run_id:
      runId,

    worker:
      worker.id,

    think,

    records:
      records.length,

    http_elapsed_ms:
      elapsedHttp,

    total_duration_ns:
      api.total_duration ?? null,

    load_duration_ns:
      api.load_duration ?? null,

    prompt_tokens:
      api.prompt_eval_count ?? null,

    output_tokens:
      api.eval_count ?? null,

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

    parity:
      "PASS",
  };
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

  /*
   * Same eight records for every run.
   *
   * We deliberately keep the model blind
   * to deterministic_relevance.
   */
  const records =
    input.records.slice(
      0,
      8
    );

  if (
    records.length !== 8
  ) {
    throw new Error(
      `EXPECTED_8_RECORDS_GOT_${records.length}`
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
        model =>
          model.digest
      )
    );

  if (
    digests.size !== 1
  ) {
    throw new Error(
      "MODEL_DIGEST_MISMATCH"
    );
  }

  fs.mkdirSync(
    OUTPUT_DIR,
    {
      recursive: true,
    }
  );

  const plan = [
    /*
     * Round 1.
     */
    [
      {
        worker:
          WORKERS[0],
        think:
          false,
        runId:
          "gpu0-think-false",
      },
      {
        worker:
          WORKERS[1],
        think:
          true,
        runId:
          "gpu1-think-true",
      },
    ],

    /*
     * Round 2: crossover.
     */
    [
      {
        worker:
          WORKERS[0],
        think:
          true,
        runId:
          "gpu0-think-true",
      },
      {
        worker:
          WORKERS[1],
        think:
          false,
        runId:
          "gpu1-think-false",
      },
    ],
  ];

  const results = [];

  for (
    let round = 0;
    round < plan.length;
    round += 1
  ) {
    console.log(
      `ROUND_${round + 1}=START`
    );

    const completed =
      await Promise.all(
        plan[round].map(
          job =>
            runOne({
              ...job,
              records,
              prompt,
              allowed:
                input.allowed,
            })
        )
      );

    results.push(
      ...completed
    );

    console.log(
      `ROUND_${round + 1}=DONE`
    );
  }

  const report = {
    format_version:
      1,

    benchmark_version:
      "1.0",

    model:
      MODEL,

    model_digest:
      modelInfos[0]
        .digest,

    num_ctx:
      NUM_CTX,

    records:
      records.length,

    prompt_sha256:
      sha256(prompt),

    input_sha256:
      sha256(
        fs.readFileSync(
          INPUT_PATH,
          "utf8"
        )
      ),

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
    "BENCHMARK=PASS"
  );

  for (const row of results) {
    console.log(
      [
        row.run_id,
        `elapsed_ms=${row.http_elapsed_ms}`,
        `prompt=${row.prompt_tokens}`,
        `output=${row.output_tokens}`,
        `thinking_chars=${row.thinking_chars}`,
        `response_chars=${row.response_chars}`,
        `parity=${row.parity}`,
      ].join(" ")
    );
  }
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
