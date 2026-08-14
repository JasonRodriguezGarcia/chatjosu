import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import AssociationCard from "./AssociationCard";
import HelpChatComposer from "./HelpChatComposer";
import TesterFeedbackComposer from "./TesterFeedbackComposer";
import { HELPCHAT_BRAND as BRAND } from "./helpChatBrand";
import { normalizeConversationContext } from "../helpchat/conversationContext";
import {
  useHelpChatSpeech,
} from "../helpchat/useHelpChatSpeech";
import {
  useTesterFeedback,
} from "../helpchat/useTesterFeedback";
import {
  findDetectedProvince,
  normalizeDetectedLocation,
} from "../helpchat/location";
import {
  cloneTesterSnapshot,
  createHelpchatTesterCaptureClient,
  createTesterId,
  isHelpchatTesterModeEnabled,
  projectTesterRuntimeMetadata,
} from "../helpchat/testerCapture";
import {
  Box,
  Button,
  IconButton,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";

const STARTER_SUGGESTIONS = [
  "Necesito ayuda para un familiar",
  "Busco orientación social",
  "Necesito apoyo relacionado con una enfermedad",
];

const createMessage = (role, content, extra = {}) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  role,
  content,
  ...extra,
});

const buildAssistantContent = (data) => {
  const resources = Array.isArray(data?.associations)
    ? data.associations
    : [];

  const count = resources.length;
  const requestedProvince = data?.requestedProvince || "tu provincia";
  const resolvedProvince = data?.resolvedProvince || requestedProvince;

  if (count === 0) {
    const recognizedNeed =
      typeof data?.tag === "string" ? data.tag.trim() : "";

    const publicNeedLabel =
      typeof data?.needLabel === "string"
        ? data.needLabel.trim()
        : "";

    if (recognizedNeed) {
      if (publicNeedLabel) {
        return `He entendido que buscas orientación relacionada con ${publicNeedLabel}, pero todavía no tengo recursos registrados para ${requestedProvince} ni alternativas disponibles en el catálogo actual. Puedes contarme si hay algo más que también te esté afectando y seguiré buscando contigo.`;
      }

      return `He entendido una de las necesidades que mencionas, pero todavía no tengo recursos registrados para ${requestedProvince} ni alternativas disponibles en el catálogo actual. Puedes contarme si hay algo más que también te esté afectando y seguiré buscando contigo.`;
    }

    return `No he encontrado recursos registrados para ${requestedProvince} con la información disponible. Si quieres, puedes contarme algún detalle más para intentar otra vía de orientación.`;
  }

  const resourceText =
    count === 1 ? "un recurso" : `${count} recursos`;

  if (Number(data?.localCount) > 0) {
    return `He encontrado ${resourceText} en ${resolvedProvince} que podría${count === 1 ? "" : "n"} orientarte.`;
  }

  if (data?.fallbackType === "neighbor_province") {
    return `No he encontrado opciones registradas en ${requestedProvince}, pero sí ${resourceText} en provincias cercanas que podría${count === 1 ? "" : "n"} orientarte.`;
  }

  if (data?.fallbackType === "national") {
    return `No he encontrado opciones registradas en ${requestedProvince}, pero sí ${resourceText} de ámbito nacional que podría${count === 1 ? "" : "n"} orientarte.`;
  }

  return `He encontrado ${resourceText} que podría${count === 1 ? "" : "n"} orientarte.`;
};

const getResourcesTitle = (context) => {
  if (context?.fallbackType === "neighbor_province") {
    return "Recursos cercanos que pueden orientarte";
  }

  if (context?.fallbackType === "national") {
    return "Recursos de ámbito nacional";
  }

  return "Recursos que pueden orientarte";
};

const HelpChat = () => {
  const [provincias, setProvincias] = useState([]);
  const [selectedProvincia, setSelectedProvincia] = useState("");
  const [input, setInput] = useState("");
  const [errorInput, setErrorInput] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const [lastFailedRequest, setLastFailedRequest] = useState(null);
  const [testerCapturedTurnCount, setTesterCapturedTurnCount] = useState(0);

  const speech =
    useHelpChatSpeech();

  const isListening =
    speech.isListening;

  const speechError =
    speech.error;

  const speechRecognitionSupported =
    speech.supported;

  const bottomRef = useRef(null);
  const requestQueueRef = useRef([]);
  const processingQueueRef = useRef(false);
  const conversationContextRef = useRef(null);
  const manualProvinciaRef = useRef(false);
  const pendingLocationRequestRef = useRef(null);

  const testerModeRef =
    useRef(
      isHelpchatTesterModeEnabled(),
    );

  const testerSessionIdRef =
    useRef(
      testerModeRef.current
        ? createTesterId(
            "session",
          )
        : null,
    );

  const testerSequenceRef =
    useRef(0);

  const testerCaptureClientRef =
    useRef(
      testerModeRef.current
        ? createHelpchatTesterCaptureClient({
            retries: 1,
          })
        : null,
    );

  const testerSessionReadyRef =
    useRef(null);

  const testerCapturedTurnsRef =
    useRef([]);

  const testerFeedback =
    useTesterFeedback({
      capturedTurnsRef:
        testerCapturedTurnsRef,
      captureClientRef:
        testerCaptureClientRef,
      sessionIdRef:
        testerSessionIdRef,
    });

  const testerFeedbackMode =
    testerFeedback.mode;

  const testerFeedbackReason =
    testerFeedback.reason;

  const testerFeedbackSending =
    testerFeedback.sending;

  const testerFeedbackStatus =
    testerFeedback.status;

  useEffect(() => {
    if (
      !testerModeRef.current ||
      !testerCaptureClientRef.current ||
      !testerSessionIdRef.current
    ) {
      return;
    }

    const sessionPromise =
      testerCaptureClientRef.current
        .createSession({
          sessionId:
            testerSessionIdRef.current,
          environment:
            import.meta.env.MODE ||
            "development",
          buildRevision:
            import.meta.env
              .VITE_BUILD_REVISION ||
            null,
        })
        .catch((error) => {
          console.warn(
            "Tester Capture session failed:",
            error,
          );

          return null;
        });

    testerSessionReadyRef.current =
      sessionPromise;
  }, []);

  useEffect(() => {
    const fetchingProvincias = async () => {
      try {
        const response = await fetch("/api/v1/helpchat/provincias", {
          method: "GET",
          headers: {
            "Content-type": "application/json; charset=UTF-8",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const datosProvincias = Array.isArray(data) ? data : [];

        setProvincias(datosProvincias);

        try {
          const locationResponse = await fetch("/api/v1/helpchat/location", {
            method: "GET",
            headers: {
              "Content-type": "application/json; charset=UTF-8",
            },
          });

          if (!locationResponse.ok) {
            return;
          }

          const detectedLocation = normalizeDetectedLocation(
            await locationResponse.json(),
          );

          if (!detectedLocation || manualProvinciaRef.current) {
            return;
          }

          const matchedProvince = findDetectedProvince(
            datosProvincias,
            detectedLocation,
          );

          if (matchedProvince) {
            setSelectedProvincia(matchedProvince.label);
          }
        } catch {
          // GeoIP es una mejora silenciosa: el selector manual sigue disponible.
        }
      } catch (err) {
        console.error("Error al obtener provincias:", err);
      }
    };

    fetchingProvincias();
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    bottomRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [messages, isSending, requestError]);

  const handleConversationInput = (event) => {
    const value =
      event.target.value;

    setInput(value);

    if (errorInput && value.trim()) {
      setErrorInput(false);
    }
  };

  const requestHelp = async ({
    inputMessage,
    selectedProvincia: provincia,
    controlledReply = null,
    testerTurn = null,
  }) => {
    setRequestError(null);

    const contextBefore =
      testerTurn
        ? cloneTesterSnapshot(
            conversationContextRef.current,
          )
        : null;

    const requestStartedAt = performance.now();

    try {
      const response = await fetch("/api/v1/helpchat/iacall", {
        method: "POST",
        headers: {
          "Content-type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          inputMessage,
          selectedProvincia: provincia,
          conversationContext: conversationContextRef.current,
          ...(controlledReply
            ? { controlledReply }
            : {}),
          }),
        });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

        if (
          data?.context &&
          typeof data.context === "object" &&
          !Array.isArray(data.context)
        ) {
          const nextConversationContext =
            normalizeConversationContext(data.context);

          if (nextConversationContext) {
            conversationContextRef.current = nextConversationContext;
          }
        }

      const needsLocation =
        data?.needsLocation === true ||
        data?.status === "needs_location";

      if (needsLocation) {
        pendingLocationRequestRef.current = {
          inputMessage,
          controlledReply,
          testerTurn,
        };

        setMessages((previous) => [
          ...previous,
          createMessage(
            "assistant",
            "Para mostrarte recursos cercanos necesito saber tu provincia. Puedes elegirla en el control de ubicación.",
          ),
        ]);

        setLastFailedRequest(null);
        return false;
      }

      const needsClarification =
        data?.needsClarification === true;

      const clarificationQuestion =
        typeof data?.clarificationQuestion === "string"
          ? data.clarificationQuestion.trim()
          : "";

      const resources = needsClarification
        ? []
        : Array.isArray(data?.associations)
          ? data.associations
          : [];

      const quickReplies =
        needsClarification &&
        Array.isArray(data?.quickReplies)
          ? data.quickReplies
              .filter(
                (reply) =>
                  reply &&
                  typeof reply.id === "string" &&
                  typeof reply.label === "string" &&
                  typeof reply.message === "string",
              )
              .slice(0, 6)
              .map((reply) => {
                const rawControlledReply =
                  reply.controlledReply;

                let controlledReply =
                  null;

                if (
                  rawControlledReply?.type ===
                    "need_domain" &&
                  typeof rawControlledReply.value ===
                    "string"
                ) {
                  controlledReply = {
                    type:
                      "need_domain",
                    value:
                      rawControlledReply.value,
                  };
                } else if (
                  rawControlledReply?.type ===
                    "clarification_choice" &&
                  typeof rawControlledReply.node ===
                    "string" &&
                  typeof rawControlledReply.choice ===
                    "string"
                ) {
                  controlledReply = {
                    type:
                      "clarification_choice",
                    node:
                      rawControlledReply.node,
                    choice:
                      rawControlledReply.choice,
                  };
                }

                return {
                  id:
                    reply.id,
                  label:
                    reply.label,
                  message:
                    reply.message,
                  controlledReply,
                };
              })
          : [];

      const assistantContent =
        needsClarification && clarificationQuestion
          ? clarificationQuestion
          : buildAssistantContent(data);
      const roundTripMs = Math.round(
        performance.now() - requestStartedAt,
      );

      if (import.meta.env.DEV) {
        console.debug("HelpChat timing", {
          serverDurationMs: Number(data?.durationMs) || null,
          roundTripMs,
        });
      }

      setMessages((previous) => [
        ...previous,
        createMessage("assistant", assistantContent, {
          resources,
          quickReplies,
          presentationContext: {
            requestedProvince: data?.requestedProvince || provincia,
            resolvedProvince: data?.resolvedProvince || provincia,
            fallbackUsed: Boolean(data?.fallbackUsed),
            fallbackType: data?.fallbackType || null,
            localCount: Number(data?.localCount) || 0,
            neighborCount: Number(data?.neighborCount) || 0,
            nationalCount: Number(data?.nationalCount) || 0,
          },
          operationalMetadata: {
            tag: data?.tag || null,
            serverDurationMs: Number(data?.durationMs) || null,
            roundTripMs,
          },
        }),
      ]);

      if (
        testerTurn &&
        testerCaptureClientRef.current &&
        testerSessionIdRef.current
      ) {
        const contextAfter =
          cloneTesterSnapshot(
            conversationContextRef.current,
          );

        const captureTurn =
          async () => {
            await testerSessionReadyRef.current;

            return testerCaptureClientRef.current
              .appendTurn({
                sessionId:
                  testerSessionIdRef.current,
                turnId:
                  testerTurn.turnId,
                sequence:
                  testerTurn.sequence,
                inputMessage,
                assistantMessage:
                  assistantContent,
                controlledReply,
                contextBefore,
                contextAfter,
                runtimeMetadata:
                  projectTesterRuntimeMetadata(
                    data,
                    {
                      roundTripMs,
                      selectedProvincia:
                        provincia,
                    },
                  ),
              });
          };

        void captureTurn()
          .then((result) => {
            if (
              result?.status !== "created" &&
              result?.status !== "duplicate"
            ) {
              return;
            }

            const alreadyCaptured =
              testerCapturedTurnsRef.current
                .some(
                  (turn) =>
                    turn.turnId ===
                    testerTurn.turnId,
                );

            if (alreadyCaptured) {
              return;
            }

            testerCapturedTurnsRef.current.push({
              turnId:
                testerTurn.turnId,
              sequence:
                testerTurn.sequence,
              inputMessage,
              assistantMessage:
                assistantContent,
            });

            setTesterCapturedTurnCount(
              testerCapturedTurnsRef.current.length,
            );
          })
          .catch((error) => {
            console.warn(
              "Tester Capture turn failed:",
              error,
            );
          });
      }

      setLastFailedRequest(null);
      return true;
    } catch (err) {
      console.error("Error al llamar a /api/v1/helpchat/iacall:", err);

      setRequestError(
        "No he podido completar la búsqueda. Puedes intentarlo de nuevo.",
      );

      setLastFailedRequest({
        inputMessage,
        selectedProvincia: provincia,
        controlledReply,
        testerTurn,
      });

      return false;
    }
  };

  const processRequestQueue = async () => {
    if (processingQueueRef.current) {
      return;
    }

    processingQueueRef.current = true;
    setIsSending(true);

    try {
      while (requestQueueRef.current.length > 0) {
        const nextRequest = requestQueueRef.current.shift();
        const succeeded = await requestHelp(nextRequest);

        if (!succeeded) {
          break;
        }
      }
    } finally {
      processingQueueRef.current = false;
      setIsSending(false);
    }
  };

  const submitMessage = (
    message,
    {
      controlledReply = null,
    } = {},
  ) => {
    const trimmedInput =
      String(message || "").trim();

    if (!trimmedInput) {
      setErrorInput(true);
      return;
    }

    setErrorInput(false);
    setRequestError(null);

    setMessages((previous) => [
      ...previous,
      createMessage("user", trimmedInput),
    ]);

    setInput("");

    const testerTurn =
      testerModeRef.current
        ? {
            turnId:
              createTesterId(
                "turn",
              ),
            sequence:
              ++testerSequenceRef.current,
          }
        : null;

    requestQueueRef.current.push({
      inputMessage: trimmedInput,
      selectedProvincia,
      controlledReply,
      testerTurn,
    });

    if (!lastFailedRequest) {
      void processRequestQueue();
    }
  };

  const handleConversationSubmit = () => {
    submitMessage(input);
  };

  const handleRetry = () => {
    if (!lastFailedRequest || processingQueueRef.current) {
      return;
    }

    const retryRequest = lastFailedRequest;

    setLastFailedRequest(null);
    setRequestError(null);

    requestQueueRef.current.unshift(retryRequest);
    void processRequestQueue();
  };

  const handleSetSelectedProvincia = (event) => {
    const nextProvince = event.target.value;

    manualProvinciaRef.current = true;
    setSelectedProvincia(nextProvince);

    const pendingRequest =
      pendingLocationRequestRef.current;

    if (pendingRequest && nextProvince) {
      pendingLocationRequestRef.current = null;

      requestQueueRef.current.unshift({
        ...pendingRequest,
        selectedProvincia: nextProvince,
      });

      void processRequestQueue();
    }
  };

  const handleToggleSpeech = () => {
    if (
      !isListening &&
      testerFeedbackMode
    ) {
      testerFeedback.markReasonAsSpeech();
    }

    speech.toggle({
      baseValue:
        testerFeedbackMode
          ? testerFeedbackReason
          : input,

      onValueChange: (value) => {
        if (testerFeedbackMode) {
          testerFeedback.setReason(
            value,
          );
          return;
        }

        setInput(value);
        setErrorInput(false);
      },
    });
  };

  const handleTesterFeedbackStart = () => {
    const started =
      testerFeedback.start();

    if (!started) {
      return;
    }

    setErrorInput(false);
    speech.clearError();
  };

  const handleTesterFeedbackCancel = () => {
    speech.abort();
    testerFeedback.cancel();
  };

  const handleTesterFeedbackInput = (event) => {
    testerFeedback.setReason(
      event.target.value,
    );
  };

  const handleTesterFeedbackSubmit = async () => {
    await testerFeedback.submit();
  };

  const handleSuggestion = (suggestion) => {
    submitMessage(suggestion);
  };

  const showInitialState =
    messages.length === 0 && !isSending && !requestError;

  return (
    <Box
      component="form"
      noValidate
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();

        if (testerFeedbackMode) {
          void handleTesterFeedbackSubmit();
          return;
        }

        handleConversationSubmit();
      }}
      sx={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: BRAND.background,
        overflow: "hidden",
      }}
    >
      <Toolbar
        sx={{
          borderBottom: 1,
          borderColor: BRAND.border,
          bgcolor: BRAND.header,
          gap: { xs: 1, sm: 2 },
          px: { xs: 1.5, sm: 2.5 },
          py: { xs: 1, sm: 0.75 },
          minHeight: { xs: 74, sm: 76 },
          flexWrap: { xs: "wrap", sm: "nowrap" },
        }}
      >
        <Stack
          spacing={0.15}
          sx={{
            flexGrow: 1,
            minWidth: 0,
          }}
        >
          <Typography
            variant="h6"
            component="div"
            sx={{
              fontWeight: 700,
              color: BRAND.plum,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
            }}
          >
            Entre Amigas · Te orienta
          </Typography>

          <Typography
            variant="caption"
            sx={{
              color: BRAND.textSecondary,
              lineHeight: 1.3,
            }}
          >
            Una iniciativa de Entre Amigas Anda la Cosa
          </Typography>
        </Stack>

        <FormControl
          size="small"
          disabled={provincias.length === 0}
          sx={{
            minWidth: { xs: 150, sm: 170 },
            maxWidth: "100%",
          }}
        >
          <Select
            id="provincia-select"
            name="provincia"
            value={selectedProvincia}
            displayEmpty
            onChange={handleSetSelectedProvincia}
            inputProps={{
              "aria-label": `Provincia actual: ${
                selectedProvincia || "sin seleccionar"
              }`,
            }}
            renderValue={(value) =>
              `📍 ${value || "Ubicación"}`
            }
            sx={{
              bgcolor: BRAND.plumSoft,
              color: BRAND.text,
              borderRadius: 999,
              fontWeight: 500,
              "& .MuiSelect-select": {
                py: 0.75,
                pl: 1.5,
                pr: 4,
              },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: BRAND.border,
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: BRAND.plum,
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: BRAND.plum,
              },
              "&.Mui-focused": {
                outline: `3px solid ${BRAND.yellow}`,
                outlineOffset: 2,
              },
            }}
          >
            {provincias.map((provincia) => (
              <MenuItem
                key={provincia.label}
                id={provincia.label}
                value={provincia.label}
              >
                {provincia.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Toolbar>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: { xs: 1.5, sm: 2 },
          py: 2,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 800,
            mx: "auto",
            minHeight: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {showInitialState ? (
            <Stack
              spacing={2}
              sx={{
                mt: { xs: 5, sm: 8 },
                mb: "auto",
                py: { xs: 2, sm: 4 },
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <Box>
                <Typography
                  variant="h5"
                  component="h1"
                  sx={{ fontWeight: 600 }}
                >
                  ¿En qué podemos ayudarte?
                </Typography>

                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ mt: 1, maxWidth: 560 }}
                >
                  Cuéntanos qué está pasando con tus propias palabras.
                  Buscaremos asociaciones y recursos que puedan orientarte.
                </Typography>
              </Box>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  width: "100%",
                  justifyContent: "center",
                }}
              >
                {STARTER_SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outlined"
                    onClick={() => handleSuggestion(suggestion)}
                    sx={{
                      textTransform: "none",
                      color: BRAND.plum,
                      borderColor: BRAND.border,
                      bgcolor: BRAND.surface,
                      borderRadius: 999,
                      px: 2,
                      py: 1,
                      fontWeight: 500,
                      "&:hover": {
                        borderColor: BRAND.plum,
                        bgcolor: BRAND.plumSoft,
                      },
                      "&:focus-visible": {
                        outline: `3px solid ${BRAND.yellow}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              {messages.map((message, index) => {
                const isUser = message.role === "user";

                const isLatestMessage =
                  index === messages.length - 1;

                return (
                  <Box
                    key={message.id}
                    sx={{
                      display: "flex",
                        flexDirection: "column",
                        alignItems: isUser ? "flex-end" : "flex-start",
                        width: "100%",
                      }}
                  >
                    <Box
                      sx={{
                        width: "fit-content",
                        maxWidth: { xs: "92%", sm: isUser ? "76%" : "84%" },
                        px: 2,
                        py: 1.35,
                        borderRadius: isUser
                          ? "18px 18px 5px 18px"
                          : "18px 18px 18px 5px",
                        bgcolor: isUser
                          ? BRAND.plum
                          : BRAND.surface,
                        color: isUser
                          ? "#FFFFFF"
                          : BRAND.text,
                        border: 1,
                        borderColor: isUser
                          ? BRAND.plum
                          : BRAND.border,
                        boxShadow: isUser
                          ? "0 3px 12px rgba(118, 83, 102, 0.12)"
                          : "0 3px 14px rgba(51, 45, 49, 0.05)",
                        lineHeight: 1.55,
                        overflowWrap: "anywhere",
                        "& p": {
                          m: 0,
                        },
                        "& p + p": {
                          mt: 1,
                        },
                      }}
                    >
                      <ReactMarkdown
                        components={{
                          a: (props) => (
                            <a
                              {...props}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </Box>

                    {!isUser &&
                      isLatestMessage &&
                      Array.isArray(message.quickReplies) &&
                      message.quickReplies.length > 0 && (
                        <Stack
                          direction="row"
                          spacing={1}
                          useFlexGap
                          sx={{
                            flexWrap: "wrap",
                            width: "100%",
                            maxWidth: { xs: "100%", sm: "84%" },
                            mt: 1,
                          }}
                        >
                          {message.quickReplies.map((reply) => (
                            <Button
                              key={reply.id}
                              type="button"
                              size="small"
                              variant="outlined"
                              onClick={() =>
                                submitMessage(
                                  reply.message,
                                  {
                                    controlledReply:
                                      reply.controlledReply || null,
                                  },
                                )
                              }
                              disabled={
                                isSending ||
                                !isLatestMessage
                              }
                              sx={{
                                textTransform: "none",
                                borderRadius: 999,
                                color: BRAND.plum,
                                borderColor: BRAND.border,
                                bgcolor: BRAND.surface,
                                "&:hover": {
                                  borderColor: BRAND.plum,
                                  bgcolor: BRAND.plumSoft,
                                },
                                "&:focus-visible": {
                                  outline: `3px solid ${BRAND.yellow}`,
                                  outlineOffset: 2,
                                },
                              }}
                            >
                              {reply.label}
                            </Button>
                          ))}
                        </Stack>
                      )}

                    {!isUser &&
                      Array.isArray(message.resources) &&
                      message.resources.length > 0 && (
                        <Stack
                          spacing={1.25}
                          sx={{
                            width: "100%",
                            maxWidth: { xs: "100%", sm: "84%" },
                            mt: 1.25,
                          }}
                        >
                          <Typography
                            component="h2"
                            variant="subtitle2"
                            sx={{
                              color: BRAND.textSecondary,
                              fontWeight: 700,
                              px: 0.5,
                            }}
                          >
                            {getResourcesTitle(message.presentationContext)}
                          </Typography>

                          {message.resources.map((association) => (
                            <AssociationCard
                              key={association.id}
                              association={association}
                            />
                          ))}
                        </Stack>
                      )}
                  </Box>
                );
              })}

              {isSending && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "flex-start",
                  }}
                >
                  <Box
                    role="status"
                    aria-live="polite"
                    sx={{
                      px: 2,
                      py: 1.25,
                      borderRadius: "18px 18px 18px 5px",
                      bgcolor: BRAND.surface,
                      border: 1,
                      borderColor: BRAND.border,
                      color: BRAND.textSecondary,
                    }}
                  >
                    Buscando opciones…
                  </Box>
                </Box>
              )}

              {requestError && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "flex-start",
                  }}
                >
                  <Stack
                    spacing={1}
                    sx={{
                      px: 2,
                      py: 1.25,
                      borderRadius: "18px 18px 18px 5px",
                      bgcolor: BRAND.surface,
                      border: 1,
                      borderColor: BRAND.coral,
                      maxWidth: { xs: "88%", sm: "82%" },
                    }}
                  >
                    <Typography variant="body2">
                      {requestError}
                    </Typography>

                    <Button
                      type="button"
                      size="small"
                      onClick={handleRetry}
                      disabled={isSending}
                      sx={{
                        alignSelf: "flex-start",
                        textTransform: "none",
                      }}
                    >
                      Reintentar
                    </Button>
                  </Stack>
                </Box>
              )}
            </Stack>
          )}

          <div ref={bottomRef} />
        </Box>
      </Box>

      <Box
        sx={{
          borderTop: 1,
          borderColor:
            testerFeedbackMode
              ? BRAND.coral
              : BRAND.border,
          bgcolor:
            testerFeedbackMode
              ? BRAND.plumSoft
              : BRAND.header,
          px: { xs: 1, sm: 2 },
          py: { xs: 1, sm: 1.5 },
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 800,
            mx: "auto",
            ...(testerFeedbackMode
              ? {
                  border: 1,
                  borderColor: BRAND.coral,
                  borderRadius: 3,
                  p: 1.25,
                  bgcolor: BRAND.surface,
                }
              : {}),
          }}
        >
          {testerFeedbackMode ? (
            <TesterFeedbackComposer
              reason={testerFeedbackReason}
              sending={testerFeedbackSending}
              speechError={speechError}
              isListening={isListening}
              speechRecognitionSupported={
                speechRecognitionSupported
              }
              onChange={
                handleTesterFeedbackInput
              }
              onSend={
                handleTesterFeedbackSubmit
              }
              onCancel={
                handleTesterFeedbackCancel
              }
              onToggleSpeech={
                handleToggleSpeech
              }
            />
          ) : (
            <HelpChatComposer
              input={input}
              errorInput={errorInput}
              speechError={speechError}
              isListening={isListening}
              speechRecognitionSupported={
                speechRecognitionSupported
              }
              testerMode={
                testerModeRef.current
              }
              testerCapturedTurnCount={
                testerCapturedTurnCount
              }
              onInputChange={
                handleConversationInput
              }
              onSend={
                handleConversationSubmit
              }
              onToggleSpeech={
                handleToggleSpeech
              }
              onTesterFeedbackStart={
                handleTesterFeedbackStart
              }
            />
          )}
        </Box>
      </Box>

      {testerModeRef.current &&
        testerFeedbackStatus && (
          <Typography
            role="status"
            aria-live="polite"
            variant="caption"
            sx={{
              position: "fixed",
              right: 16,
              bottom: 90,
              zIndex: 1400,
              px: 2,
              py: 1,
              borderRadius: 2,
              bgcolor: BRAND.surface,
              color: BRAND.text,
              border: 1,
              borderColor: BRAND.border,
              boxShadow: 2,
              maxWidth: 360,
            }}
          >
            {testerFeedbackStatus}
          </Typography>
        )}
    </Box>
  );
};

export default HelpChat;
