import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
} from "./speechRecognition";

const composeSpeechInput = (
  base,
  finalTranscript,
  interimTranscript,
) => {
  const transcript = [
    finalTranscript,
    interimTranscript,
  ]
    .map((value) =>
      String(value || "").trim(),
    )
    .filter(Boolean)
    .join(" ");

  if (!transcript) {
    return base;
  }

  if (!base) {
    return transcript;
  }

  return `${base}${/\s$/.test(base) ? "" : " "}${transcript}`;
};

export const useHelpChatSpeech = () => {
  const [isListening, setIsListening] =
    useState(false);

  const [error, setError] =
    useState(null);

  const recognitionRef =
    useRef(null);

  const baseInputRef =
    useRef("");

  const finalTranscriptRef =
    useRef("");

  const onValueChangeRef =
    useRef(null);

  const supported =
    isSpeechRecognitionSupported(
      globalThis,
    );

  const abort = () => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setIsListening(false);
  };

  const clearError = () => {
    setError(null);
  };

  const stop = () => {
    recognitionRef.current?.stop();
  };

  const start = ({
    baseValue = "",
    onValueChange,
  } = {}) => {
    setError(null);

    baseInputRef.current =
      String(baseValue || "");

    finalTranscriptRef.current =
      "";

    onValueChangeRef.current =
      typeof onValueChange === "function"
        ? onValueChange
        : null;

    const adapter =
      createSpeechRecognition({
        target: globalThis,
        language: "es-ES",

        onStart: () => {
          setIsListening(true);
        },

        onResult: ({
          interimTranscript,
          finalTranscript,
        }) => {
          if (finalTranscript) {
            finalTranscriptRef.current = [
              finalTranscriptRef.current,
              finalTranscript,
            ]
              .map((value) =>
                value.trim(),
              )
              .filter(Boolean)
              .join(" ");
          }

          const composed =
            composeSpeechInput(
              baseInputRef.current,
              finalTranscriptRef.current,
              interimTranscript,
            );

          onValueChangeRef.current?.(
            composed,
          );
        },

        onError: (speechError) => {
          setIsListening(false);

          if (
            speechError ===
              "not-allowed" ||
            speechError ===
              "service-not-allowed"
          ) {
            setError(
              "No he podido acceder al micrófono. Puedes seguir escribiendo normalmente.",
            );
          } else {
            setError(
              "No he podido completar el dictado. Puedes seguir escribiendo normalmente.",
            );
          }
        },

        onEnd: () => {
          setIsListening(false);
          recognitionRef.current =
            null;
        },
      });

    if (!adapter) {
      return;
    }

    recognitionRef.current =
      adapter;

    try {
      adapter.start();
    } catch {
      recognitionRef.current =
        null;

      setIsListening(false);

      setError(
        "No he podido iniciar el dictado. Puedes seguir escribiendo normalmente.",
      );
    }
  };

  const toggle = (options) => {
    if (isListening) {
      stop();
      return;
    }

    start(options);
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current =
        null;
    };
  }, []);

  return {
    supported,
    isListening,
    error,
    start,
    stop,
    abort,
    clearError,
    toggle,
  };
};
