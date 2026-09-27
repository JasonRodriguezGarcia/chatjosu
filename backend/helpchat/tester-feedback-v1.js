const FEEDBACK_CATEGORIES =
  Object.freeze([
    "not_understood",
    "repeated_question",
    "incorrect_response",
    "wrong_person",
    "wrong_resources",
    "incorrect_inference",
    "conversation_context",
    "other",
  ]);

const REASON_SOURCES =
  Object.freeze([
    "text",
    "speech",
  ]);

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

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(
    0,
    maxLength,
  );
}

function cleanId(value) {
  return cleanText(
    value,
    200,
  );
}

function cleanAnchorTurnIds(
  value,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(cleanId)
        .filter(Boolean),
    ),
  ).slice(0, 20);
}

export function buildTesterFeedbackV1({
  sessionId,
  snapshotThroughTurnId,
  anchorTurnIds = [],
  category = "other",
  reasonText,
  expectedText = null,
  reasonSource = "text",
} = {}) {
  const normalizedSessionId =
    cleanId(sessionId);

  const normalizedSnapshotTurnId =
    cleanId(
      snapshotThroughTurnId,
    );

  const normalizedReason =
    cleanText(reasonText);

  if (!normalizedSessionId) {
    throw new Error(
      "sessionId es obligatorio."
    );
  }

  if (!normalizedSnapshotTurnId) {
    throw new Error(
      "snapshotThroughTurnId es obligatorio."
    );
  }

  if (!normalizedReason) {
    throw new Error(
      "reasonText es obligatorio."
    );
  }

  const normalizedCategory =
    FEEDBACK_CATEGORIES.includes(
      category,
    )
      ? category
      : "other";

  const normalizedReasonSource =
    REASON_SOURCES.includes(
      reasonSource,
    )
      ? reasonSource
      : "text";

  return {
    version: 1,
    sessionId:
      normalizedSessionId,
    snapshotThroughTurnId:
      normalizedSnapshotTurnId,
    anchorTurnIds:
      cleanAnchorTurnIds(
        anchorTurnIds,
      ),
    category:
      normalizedCategory,
    reasonText:
      normalizedReason,
    expectedText:
      cleanText(expectedText),
    reasonSource:
      normalizedReasonSource,
    reviewStatus:
      "pending",
  };
}

export const TESTER_FEEDBACK_CATEGORIES_V1 =
  FEEDBACK_CATEGORIES;

export const TESTER_FEEDBACK_REASON_SOURCES_V1 =
  REASON_SOURCES;
