const TESTER_TRUE_VALUES =
  new Set([
    "1",
    "true",
    "yes",
    "on",
  ]);

const cloneSnapshot = (value) => {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof structuredClone ===
    "function"
  ) {
    return structuredClone(value);
  }

  return JSON.parse(
    JSON.stringify(value),
  );
};

export const isHelpchatTesterModeEnabled = (
  search =
    globalThis?.location?.search ||
    "",
) => {
  const params =
    new URLSearchParams(
      String(search || ""),
    );

  return TESTER_TRUE_VALUES.has(
    String(
      params.get("tester") || "",
    ).toLowerCase(),
  );
};

export const createTesterId = (
  prefix,
  target = globalThis,
) => {
  const normalizedPrefix =
    String(prefix || "tester")
      .trim() ||
    "tester";

  const uuid =
    target?.crypto
      ?.randomUUID?.();

  if (uuid) {
    return (
      `${normalizedPrefix}-` +
      uuid
    );
  }

  return (
    `${normalizedPrefix}-` +
    `${Date.now()}-` +
    Math.random()
      .toString(36)
      .slice(2)
  );
};

export const cloneTesterSnapshot =
  cloneSnapshot;

export const projectTesterRuntimeMetadata = (
  data,
  {
    roundTripMs = null,
    selectedProvincia = null,
  } = {},
) => ({
  status:
    data?.status || null,

  tag:
    data?.tag || null,

  resolvedNeeds:
    cloneSnapshot(
      Array.isArray(
        data?.resolvedNeeds,
      )
        ? data.resolvedNeeds
        : [],
    ),

  needsClarification:
    data?.needsClarification ===
    true,

  clarificationQuestion:
    typeof data?.clarificationQuestion ===
    "string"
      ? data.clarificationQuestion
      : null,

  quickReplyIds:
    Array.isArray(
      data?.quickReplies,
    )
      ? data.quickReplies
          .map(
            (reply) =>
              reply?.id,
          )
          .filter(
            (id) =>
              typeof id ===
              "string",
          )
      : [],

  provider:
    data?.provider || null,

  model:
    data?.model || null,

  durationMs:
    Number.isFinite(
      Number(
        data?.durationMs,
      ),
    )
      ? Number(
          data.durationMs,
        )
      : null,

  roundTripMs:
    Number.isFinite(
      Number(roundTripMs),
    )
      ? Number(
          roundTripMs,
        )
      : null,

  timings:
    cloneSnapshot(
      data?.timings &&
      typeof data.timings ===
        "object"
        ? data.timings
        : null,
    ),

  fallbackUsed:
    Boolean(
      data?.fallbackUsed,
    ),

  fallbackType:
    data?.fallbackType ||
    null,

  selectedProvincia:
    selectedProvincia ||
    null,

  effectiveProvince:
    data?.effectiveProvince ||
    null,

  resolvedProvince:
    data?.resolvedProvince ||
    null,
});

async function postJson(
  url,
  payload,
  {
    fetchImpl = fetch,
  } = {},
) {
  const response =
    await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-type":
          "application/json; charset=UTF-8",
      },
      body:
        JSON.stringify(
          payload,
        ),
    });

  if (!response.ok) {
    const error =
      new Error(
        `HTTP ${response.status}`,
      );

    error.status =
      response.status;

    throw error;
  }

  return response.json();
}

export const createHelpchatTesterCaptureClient = ({
  fetchImpl = fetch,
  retries = 1,
} = {}) => {
  const execute = async (
    url,
    payload,
  ) => {
    let lastError = null;

    for (
      let attempt = 0;
      attempt <= retries;
      attempt += 1
    ) {
      try {
        return await postJson(
          url,
          payload,
          {
            fetchImpl,
          },
        );
      } catch (error) {
        lastError =
          error;

        if (
          error?.status &&
          error.status < 500
        ) {
          break;
        }
      }
    }

    throw lastError;
  };

  return {
    createSession:
      (payload) =>
        execute(
          "/api/v1/helpchat/tester/sessions",
          payload,
        ),

    appendTurn:
      (payload) =>
        execute(
          "/api/v1/helpchat/tester/turns",
          payload,
        ),

    createFeedback:
      (payload) =>
        execute(
          "/api/v1/helpchat/tester/feedback",
          payload,
        ),
  };
};
