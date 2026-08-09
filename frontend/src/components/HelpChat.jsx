import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import AssociationCard from "./AssociationCard";
import { normalizeConversationContext } from "../helpchat/conversationContext";
import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Select,
  Stack,
  TextField,
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

const BRAND = {
  background: "#FFF9F3",
  surface: "#FFFFFF",
  header: "#FFFDF9",
  plum: "#765366",
  plumDark: "#624456",
  coral: "#D96F62",
  yellow: "#EAC354",
  mint: "#9ACDA8",
  green: "#5F806B",
  text: "#332D31",
  textSecondary: "#71676C",
  border: "#E8DDD7",
  plumSoft: "#F4EAF0",
};

const buildAssistantContent = (data) => {
  const resources = Array.isArray(data?.associations)
    ? data.associations
    : [];

  const count = resources.length;
  const requestedProvince = data?.requestedProvince || "tu provincia";
  const resolvedProvince = data?.resolvedProvince || requestedProvince;

  if (count === 0) {
    return `No he encontrado recursos registrados para ${requestedProvince} con esta búsqueda. Puedes escribir de nuevo contando un poco más sobre el tipo de ayuda que necesitas.`;
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

  const bottomRef = useRef(null);
  const requestQueueRef = useRef([]);
  const processingQueueRef = useRef(false);
  const conversationContextRef = useRef(null);

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
        setSelectedProvincia(datosProvincias[0]?.label ?? "");
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

  const handleInput = (event) => {
    setInput(event.target.value);

    if (errorInput && event.target.value.trim()) {
      setErrorInput(false);
    }
  };

  const requestHelp = async ({ inputMessage, selectedProvincia: provincia }) => {
    setRequestError(null);

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
          context: {
            tag: data?.tag || null,
            requestedProvince: data?.requestedProvince || provincia,
            resolvedProvince: data?.resolvedProvince || provincia,
            fallbackUsed: Boolean(data?.fallbackUsed),
            fallbackType: data?.fallbackType || null,
            localCount: Number(data?.localCount) || 0,
            neighborCount: Number(data?.neighborCount) || 0,
            nationalCount: Number(data?.nationalCount) || 0,
            serverDurationMs: Number(data?.durationMs) || null,
            roundTripMs,
          },
        }),
      ]);

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

  const handleSend = () => {
    const trimmedInput = input.trim();

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

    requestQueueRef.current.push({
      inputMessage: trimmedInput,
      selectedProvincia,
    });

    if (!lastFailedRequest) {
      void processRequestQueue();
    }
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
    setSelectedProvincia(event.target.value);
  };

  const handleSuggestion = (suggestion) => {
    setInput(suggestion);
    setErrorInput(false);
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
        handleSend();
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
              {messages.map((message) => {
                const isUser = message.role === "user";

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
                            {getResourcesTitle(message.context)}
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
          borderColor: BRAND.border,
          bgcolor: BRAND.header,
          px: { xs: 1, sm: 2 },
          py: { xs: 1, sm: 1.5 },
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}

          sx={{
            alignItems: "flex-start",
              width: "100%",
            maxWidth: 800,
            mx: "auto",
          }}
        >
          <TextField
            fullWidth
            id="mensaje"
            name="mensaje"
            label="Escribe qué necesitas"
            value={input}
            required
            minRows={1}
            maxRows={5}
            multiline
            error={errorInput}
            helperText={
              errorInput ? "El mensaje no puede estar vacío" : ""
            }
            placeholder="Cuéntanos qué necesitas…"
            onChange={handleInput}
            sx={{
              "& .MuiOutlinedInput-root": {
                bgcolor: BRAND.surface,
                borderRadius: 3,
                "& fieldset": {
                  borderColor: BRAND.border,
                },
                "&:hover fieldset": {
                  borderColor: BRAND.plum,
                },
                "&.Mui-focused fieldset": {
                  borderColor: BRAND.plum,
                },
              },
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
          />

          <Button
            type="submit"
            variant="contained"
            disabled={!input.trim()}
            sx={{
              minHeight: 56,
              minWidth: { xs: 76, sm: 96 },
              px: { xs: 1.5, sm: 2.5 },
              borderRadius: 3,
              textTransform: "none",
              fontWeight: 700,
              bgcolor: BRAND.plum,
              "&:hover": {
                bgcolor: BRAND.plumDark,
              },
              "&:focus-visible": {
                outline: `3px solid ${BRAND.yellow}`,
                outlineOffset: 2,
              },
            }}
          >
            Enviar
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};

export default HelpChat;
