const getRecognitionConstructor = (target = globalThis) =>
  target?.SpeechRecognition || target?.webkitSpeechRecognition || null;

export const isSpeechRecognitionSupported = (target = globalThis) =>
  Boolean(getRecognitionConstructor(target));

export const createSpeechRecognition = ({
  target = globalThis,
  language = "es-ES",
  onStart,
  onResult,
  onError,
  onEnd,
} = {}) => {
  const Recognition = getRecognitionConstructor(target);

  if (!Recognition) {
    return null;
  }

  const recognition = new Recognition();

  recognition.lang = language;
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onstart = () => {
    onStart?.();
  };

  recognition.onresult = (event) => {
    let interimTranscript = "";
    let finalTranscript = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result?.[0]?.transcript || "";

      if (result?.isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    onResult?.({
      interimTranscript: interimTranscript.trim(),
      finalTranscript: finalTranscript.trim(),
    });
  };

  recognition.onerror = (event) => {
    onError?.(event?.error || "unknown");
  };

  recognition.onend = () => {
    onEnd?.();
  };

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
    recognition,
  };
};
