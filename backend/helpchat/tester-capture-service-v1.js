import {
  buildTesterSessionV1,
  buildTesterTurnV1,
} from "./tester-session-v1.js";

import {
  buildTesterFeedbackV1,
} from "./tester-feedback-v1.js";

export function createTesterCaptureServiceV1({
  repository,
} = {}) {
  if (
    !repository ||
    typeof repository.createSession !== "function" ||
    typeof repository.appendTurn !== "function" ||
    typeof repository.createFeedback !== "function"
  ) {
    throw new Error(
      "repository de Tester Capture no válido."
    );
  }

  async function createSession(payload) {
    const session =
      buildTesterSessionV1(
        payload
      );

    const persisted =
      await repository.createSession({
        sessionId:
          session.sessionId,
        environment:
          session.environment,
        buildRevision:
          session.buildRevision,
      });

    return {
      version: 1,
      status: "ok",
      sessionId:
        persisted?.session_id ||
        session.sessionId,
      environment:
        persisted?.environment ||
        session.environment,
      buildRevision:
        persisted?.build_revision ??
        session.buildRevision,
    };
  }

  async function appendTurn(payload) {
    const turn =
      buildTesterTurnV1(
        payload
      );

    const persisted =
      await repository.appendTurn({
        sessionId:
          turn.sessionId,
        turnId:
          turn.turnId,
        sequence:
          turn.sequence,
        inputMessage:
          turn.inputMessage,
        assistantMessage:
          turn.assistantMessage,
        controlledReply:
          turn.controlledReply,
        contextBefore:
          turn.contextBefore,
        contextAfter:
          turn.contextAfter,
        runtimeMetadata:
          turn.runtimeMetadata,
      });

    return {
      version: 1,
      status:
        persisted.status,
      sessionId:
        turn.sessionId,
      turnId:
        turn.turnId,
      sequence:
        turn.sequence,
    };
  }

  async function createFeedback(payload) {
    const feedback =
      buildTesterFeedbackV1(
        payload
      );

    const persisted =
      await repository.createFeedback({
        sessionId:
          feedback.sessionId,
        snapshotThroughTurnId:
          feedback.snapshotThroughTurnId,
        anchorTurnIds:
          feedback.anchorTurnIds,
        category:
          feedback.category,
        reasonText:
          feedback.reasonText,
        expectedText:
          feedback.expectedText,
        reasonSource:
          feedback.reasonSource,
      });

    return {
      version: 1,
      status: "ok",
      feedbackId:
        persisted.feedback_id,
      sessionId:
        feedback.sessionId,
      snapshotThroughTurnId:
        feedback.snapshotThroughTurnId,
      reviewStatus:
        persisted.review_status ||
        "pending",
    };
  }

  return {
    createSession,
    appendTurn,
    createFeedback,
  };
}
