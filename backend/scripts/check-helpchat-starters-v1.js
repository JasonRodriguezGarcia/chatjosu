const baseUrl =
  process.env.HELPCHAT_BASE_URL ||
  "http://127.0.0.1:5000";

const province =
  process.env.HELPCHAT_TEST_PROVINCE ||
  "Gipuzkoa";

const starters = [
  "Necesito ayuda para un familiar",
  "Busco orientación social",
  "Necesito apoyo relacionado con una enfermedad",
];

function classifyOutcome(data) {
  const associations =
    Array.isArray(data?.associations)
      ? data.associations
      : [];

  if (associations.length > 0) {
    return "RESOURCES";
  }

  if (
    data?.needsClarification === true ||
    (
      typeof data?.clarificationQuestion === "string" &&
      data.clarificationQuestion.trim()
    )
  ) {
    return "CLARIFICATION";
  }

  if (
    data?.status === "needs_location" ||
    data?.needsLocation === true
  ) {
    return "NEEDS_LOCATION";
  }

  return "DEAD_END";
}

function compact(data) {
  return {
    status:
      data?.status ?? null,

    needsClarification:
      Boolean(
        data?.needsClarification,
      ),

    clarificationQuestion:
      data?.clarificationQuestion ??
      null,

    tag:
      typeof data?.tag === "object"
        ? (
            data.tag?.descripcion ??
            data.tag?.tag ??
            null
          )
        : (
            data?.tag ??
            null
          ),

    associations:
      Array.isArray(
        data?.associations,
      )
        ? data.associations.length
        : 0,

    requestedProvince:
      data?.requestedProvince ??
      null,

    resolvedProvince:
      data?.resolvedProvince ??
      null,

    effectiveProvince:
      data?.effectiveProvince ??
      null,

    fallbackUsed:
      Boolean(
        data?.fallbackUsed,
      ),

    fallbackType:
      data?.fallbackType ??
      null,

    provider:
      data?.provider ??
      null,

    model:
      data?.model ??
      null,

    durationMs:
      Number.isFinite(
        Number(data?.durationMs),
      )
        ? Number(data.durationMs)
        : null,
  };
}

async function runStarter(
  inputMessage,
) {
  const startedAt =
    performance.now();

  let response;

  try {
    response =
      await fetch(
        `${baseUrl}/api/v1/helpchat/iacall`,
        {
          method: "POST",

          headers: {
            "content-type":
              "application/json",
          },

          body:
            JSON.stringify({
              inputMessage,
              selectedProvincia:
                province,
              conversationContext:
                null,
            }),

          signal:
            AbortSignal.timeout(
              15000,
            ),
        },
      );
  } catch (error) {
    return {
      inputMessage,
      outcome: "ERROR",
      httpStatus: null,
      roundTripMs:
        Math.round(
          (
            performance.now() -
            startedAt
          ) * 10,
        ) / 10,
      error:
        error?.message ||
        String(error),
    };
  }

  let data;

  try {
    data =
      await response.json();
  } catch {
    return {
      inputMessage,
      outcome: "ERROR",
      httpStatus:
        response.status,
      roundTripMs:
        Math.round(
          (
            performance.now() -
            startedAt
          ) * 10,
        ) / 10,
      error:
        "Respuesta no JSON",
    };
  }

  const roundTripMs =
    Math.round(
      (
        performance.now() -
        startedAt
      ) * 10,
    ) / 10;

  if (!response.ok) {
    return {
      inputMessage,
      outcome: "ERROR",
      httpStatus:
        response.status,
      roundTripMs,
      response:
        compact(data),
      error:
        data?.error ||
        data?.message ||
        `HTTP ${response.status}`,
    };
  }

  return {
    inputMessage,
    outcome:
      classifyOutcome(data),
    httpStatus:
      response.status,
    roundTripMs,
    response:
      compact(data),
  };
}

async function main() {
  console.log(
    "===== HELPCHAT STARTER CHECK V1 =====",
  );
  console.log(
    `baseUrl=${baseUrl}`,
  );
  console.log(
    `province=${province}`,
  );
  console.log();

  const results = [];

  for (
    const inputMessage
    of starters
  ) {
    const result =
      await runStarter(
        inputMessage,
      );

    results.push(result);

    console.log(
      `===== ${inputMessage} =====`,
    );

    console.log(
      JSON.stringify(
        result,
        null,
        2,
      ),
    );

    console.log();
  }

  console.log(
    "===== SUMMARY =====",
  );

  for (
    const result
    of results
  ) {
    const provider =
      result.response?.provider ??
      "-";

    const model =
      result.response?.model ??
      "-";

    const serverMs =
      result.response?.durationMs ??
      "-";

    console.log(
      [
        result.outcome.padEnd(15),
        `${result.roundTripMs}ms`.padEnd(12),
        `server=${serverMs}`,
        `provider=${provider}`,
        `model=${model}`,
        result.inputMessage,
      ].join(" | "),
    );
  }

  const invalid =
    results.filter(
      (result) =>
        result.outcome ===
          "DEAD_END" ||
        result.outcome ===
          "ERROR",
    );

  console.log();

  if (invalid.length > 0) {
    console.error(
      `STARTER_CHECK=FAIL invalid=${invalid.length}`,
    );

    process.exitCode = 1;
    return;
  }

  console.log(
    "STARTER_CHECK=PASS",
  );
}

await main();
