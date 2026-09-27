function cleanText(
  value,
  maxLength = 4000,
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const cleaned =
    value.trim();

  return cleaned
    ? cleaned.slice(
        0,
        maxLength,
      )
    : null;
}

function cleanId(value) {
  return cleanText(
    value,
    200,
  );
}

function cleanObject(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return structuredClone(value);
}

export function buildTesterSessionV1({
  sessionId,
  startedAt = null,
  buildRevision = null,
  environment =
    "development",
} = {}) {
  const normalizedSessionId =
    cleanId(sessionId);

  if (!normalizedSessionId) {
    throw new Error(
      "sessionId es obligatorio."
    );
  }

  return {
    version: 1,
    sessionId:
      normalizedSessionId,
    startedAt:
      cleanText(
        startedAt,
        100,
      ),
    buildRevision:
      cleanText(
        buildRevision,
        200,
      ),
    environment:
      cleanText(
        environment,
        100,
      ) ||
      "development",
  };
}

export function buildTesterTurnV1({
  sessionId,
  turnId,
  sequence,
  inputMessage,
  assistantMessage,
  controlledReply = null,
  contextBefore = null,
  contextAfter = null,
  runtimeMetadata = null,
} = {}) {
  const normalizedSessionId =
    cleanId(sessionId);

  const normalizedTurnId =
    cleanId(turnId);

  const normalizedInput =
    cleanText(inputMessage);

  const normalizedAssistant =
    cleanText(
      assistantMessage,
      12000,
    );

  if (!normalizedSessionId) {
    throw new Error(
      "sessionId es obligatorio."
    );
  }

  if (!normalizedTurnId) {
    throw new Error(
      "turnId es obligatorio."
    );
  }

  if (
    !Number.isInteger(sequence) ||
    sequence < 1
  ) {
    throw new Error(
      "sequence debe ser un entero positivo."
    );
  }

  if (!normalizedInput) {
    throw new Error(
      "inputMessage es obligatorio."
    );
  }

  if (!normalizedAssistant) {
    throw new Error(
      "assistantMessage es obligatorio."
    );
  }

  return {
    version: 1,
    sessionId:
      normalizedSessionId,
    turnId:
      normalizedTurnId,
    sequence,
    inputMessage:
      normalizedInput,
    assistantMessage:
      normalizedAssistant,
    controlledReply:
      cleanObject(
        controlledReply,
      ),
    contextBefore:
      cleanObject(
        contextBefore,
      ),
    contextAfter:
      cleanObject(
        contextAfter,
      ),
    runtimeMetadata:
      cleanObject(
        runtimeMetadata,
      ),
  };
}
