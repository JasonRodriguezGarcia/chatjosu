import {
  useRef,
  useState,
} from "react";

export const useTesterFeedback = ({
  capturedTurnsRef,
  captureClientRef,
  sessionIdRef,
}) => {
  const [mode, setMode] =
    useState(false);

  const [reason, setReason] =
    useState("");

  const [sending, setSending] =
    useState(false);

  const [status, setStatus] =
    useState(null);

  const snapshotTurnIdRef =
    useRef(null);

  const reasonSourceRef =
    useRef("text");

  const start = () => {
    const capturedTurns =
      capturedTurnsRef.current;

    const latestTurn =
      capturedTurns[
        capturedTurns.length - 1
      ];

    if (!latestTurn) {
      return false;
    }

    snapshotTurnIdRef.current =
      latestTurn.turnId;

    reasonSourceRef.current =
      "text";

    setReason("");
    setStatus(null);
    setMode(true);

    return true;
  };

  const cancel = () => {
    setReason("");
    setMode(false);

    snapshotTurnIdRef.current =
      null;

    reasonSourceRef.current =
      "text";
  };

  const markReasonAsSpeech = () => {
    reasonSourceRef.current =
      "speech";
  };

  const submit = async () => {
    const normalizedReason =
      reason.trim();

    if (
      !normalizedReason ||
      !captureClientRef.current ||
      !sessionIdRef.current
    ) {
      return false;
    }

    const snapshotThroughTurnId =
      snapshotTurnIdRef.current;

    if (!snapshotThroughTurnId) {
      return false;
    }

    setSending(true);
    setStatus(null);

    try {
      await captureClientRef.current
        .createFeedback({
          sessionId:
            sessionIdRef.current,
          snapshotThroughTurnId,
          anchorTurnIds: [],
          category: "other",
          reasonText:
            normalizedReason,
          expectedText: null,
          reasonSource:
            reasonSourceRef.current,
        });

      setReason("");
      setMode(false);

      snapshotTurnIdRef.current =
        null;

      reasonSourceRef.current =
        "text";

      setStatus(
        "Gracias. He guardado el problema para revisarlo.",
      );

      return true;
    } catch (error) {
      console.warn(
        "Tester Capture feedback failed:",
        error,
      );

      setStatus(
        "No he podido guardar el problema. Puedes intentarlo de nuevo.",
      );

      return false;
    } finally {
      setSending(false);
    }
  };

  return {
    mode,
    reason,
    sending,
    status,
    setReason,
    start,
    cancel,
    submit,
    markReasonAsSpeech,
  };
};
