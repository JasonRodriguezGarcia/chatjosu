const baseUrl =
  process.env.HELPCHAT_BASE_URL ||
  "http://127.0.0.1:5000";

const province =
  process.env.HELPCHAT_TEST_PROVINCE ||
  "Gipuzkoa";

const starter =
  "Busco orientación social";

async function callHelpchat({
  inputMessage,
  conversationContext = null,
  controlledReply = null,
}) {
  const startedAt =
    performance.now();

  const response =
    await fetch(
      `${baseUrl}/api/v1/helpchat/iacall`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
        },
        body: JSON.stringify({
          inputMessage,
          selectedProvincia:
            province,
          conversationContext,
          ...(controlledReply
            ? { controlledReply }
            : {}),
        }),
        signal:
          AbortSignal.timeout(
            15000,
          ),
      },
    );

  const data =
    await response.json();

  return {
    httpStatus:
      response.status,
    roundTripMs:
      Math.round(
        (
          performance.now() -
          startedAt
        ) * 10,
      ) / 10,
    data,
  };
}

function classify(data) {
  const associations =
    Array.isArray(
      data?.associations,
    )
      ? data.associations
      : [];

  if (
    associations.length > 0
  ) {
    return "RESOURCES";
  }

  if (
    data?.needsClarification ===
      true ||
    data?.status ===
      "needs_clarification"
  ) {
    return "CLARIFICATION";
  }

  if (
    data?.needsLocation === true ||
    data?.status ===
      "needs_location"
  ) {
    return "NEEDS_LOCATION";
  }

  return "DEAD_END";
}

const first =
  await callHelpchat({
    inputMessage:
      starter,
  });

console.log(
  "===== ROUND 1 =====",
);

console.log(
  JSON.stringify(
    {
      status:
        first.data.status,
      provider:
        first.data.provider,
      model:
        first.data.model,
      durationMs:
        first.data.durationMs,
      quickReplies:
        first.data.quickReplies,
    },
    null,
    2,
  ),
);

const replies =
  Array.isArray(
    first.data.quickReplies,
  )
    ? first.data.quickReplies
    : [];

if (
  replies.length === 0
) {
  console.error(
    "CONTROLLED_ROUND2=FAIL no quick replies",
  );
  process.exit(1);
}

const results = [];

for (
  const reply of replies
) {
  const result =
    await callHelpchat({
      inputMessage:
        reply.message,
      conversationContext:
        first.data.context,
      controlledReply:
        reply.controlledReply,
    });

  const data =
    result.data;

  const compact = {
    id:
      reply.id,
    label:
      reply.label,
    message:
      reply.message,
    controlledReply:
      reply.controlledReply,
    outcome:
      classify(data),
    httpStatus:
      result.httpStatus,
    roundTripMs:
      result.roundTripMs,
    status:
      data?.status ?? null,
    tag:
      data?.tag ?? null,
    needsClarification:
      Boolean(
        data?.needsClarification,
      ),
    clarificationQuestion:
      data?.clarificationQuestion ??
      null,
    associations:
      Array.isArray(
        data?.associations,
      )
        ? data.associations.length
        : 0,
    provider:
      data?.provider ?? null,
    model:
      data?.model ?? null,
    durationMs:
      data?.durationMs ?? null,
    classificationMs:
      data?.timings
        ?.classificationMs ??
      null,
    searchMs:
      data?.timings
        ?.searchMs ??
      null,
    fallbackType:
      data?.fallbackType ??
      null,
  };

  results.push(
    compact,
  );

  console.log();
  console.log(
    `===== ${reply.label} =====`,
  );
  console.log(
    JSON.stringify(
      compact,
      null,
      2,
    ),
  );
}

console.log();
console.log(
  "===== SUMMARY =====",
);

for (
  const result of results
) {
  console.log(
    [
      result.label.padEnd(25),
      result.outcome.padEnd(14),
      String(
        result.provider,
      ).padEnd(18),
      `${result.roundTripMs}ms`.padEnd(
        12,
      ),
      `server=${result.durationMs}`,
      `classification=${result.classificationMs}`,
    ].join(" | "),
  );
}

const deadEnds =
  results.filter(
    (result) =>
      result.outcome ===
      "DEAD_END",
  );

const escapedControlledPath =
  results.filter(
    (result) =>
      result.provider !==
      "controlled_reply",
  );

console.log();

console.log(
  `DEAD_END=${deadEnds.length}/${results.length}`,
);

console.log(
  `NON_CONTROLLED_PROVIDER=${escapedControlledPath.length}/${results.length}`,
);

if (
  deadEnds.length > 0 ||
  escapedControlledPath.length >
    0
) {
  console.error(
    "CONTROLLED_ROUND2=FAIL",
  );

  process.exitCode = 1;
} else {
  console.log(
    "CONTROLLED_ROUND2=PASS",
  );
}
