import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
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

const createMessage = (role, content) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  role,
  content,
});

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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, requestError]);

  const handleInput = (event) => {
    setInput(event.target.value);

    if (errorInput && event.target.value.trim()) {
      setErrorInput(false);
    }
  };

  const requestHelp = async ({ inputMessage, selectedProvincia: provincia }) => {
    if (isSending) {
      return;
    }

    setIsSending(true);
    setRequestError(null);

    try {
      const response = await fetch("/api/v1/helpchat/iacall", {
        method: "POST",
        headers: {
          "Content-type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          inputMessage,
          selectedProvincia: provincia,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (typeof data?.message !== "string" || !data.message.trim()) {
        throw new Error("Respuesta sin mensaje utilizable");
      }

      setMessages((previous) => [
        ...previous,
        createMessage("assistant", data.message.trim()),
      ]);

      setLastFailedRequest(null);
    } catch (err) {
      console.error("Error al llamar a /api/v1/helpchat/iacall:", err);

      setRequestError(
        "No he podido completar la búsqueda. Puedes intentarlo de nuevo.",
      );

      setLastFailedRequest({
        inputMessage,
        selectedProvincia: provincia,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = () => {
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      setErrorInput(true);
      return;
    }

    if (isSending) {
      return;
    }

    setErrorInput(false);
    setRequestError(null);

    setMessages((previous) => [
      ...previous,
      createMessage("user", trimmedInput),
    ]);

    setInput("");

    requestHelp({
      inputMessage: trimmedInput,
      selectedProvincia,
    });
  };

  const handleRetry = () => {
    if (!lastFailedRequest || isSending) {
      return;
    }

    requestHelp(lastFailedRequest);
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
        bgcolor: "background.default",
        overflow: "hidden",
      }}
    >
      <Toolbar
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          gap: 1.5,
          px: { xs: 1.5, sm: 2 },
          minHeight: { xs: 64, sm: 68 },
        }}
      >
        <Typography
          variant="h6"
          component="div"
          sx={{
            flexGrow: 1,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          Copilot ONG
        </Typography>

        <FormControl size="small" sx={{ minWidth: { xs: 118, sm: 160 } }}>
          <InputLabel id="provincia-label">Provincia</InputLabel>

          <Select
            labelId="provincia-label"
            id="provincia-select"
            name="provincia"
            label="Provincia"
            value={selectedProvincia}
            onChange={handleSetSelectedProvincia}
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
                my: "auto",
                py: 4,
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
                  Cuéntame qué está pasando con tus propias palabras.
                  Intentaré encontrar recursos que puedan orientarte.
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
                    sx={{ textTransform: "none" }}
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
                      justifyContent: isUser ? "flex-end" : "flex-start",
                    }}
                  >
                    <Box
                      sx={{
                        maxWidth: { xs: "88%", sm: "82%" },
                        px: 2,
                        py: 1.25,
                        borderRadius: 2.5,
                        bgcolor: isUser
                          ? "primary.main"
                          : "background.paper",
                        color: isUser
                          ? "primary.contrastText"
                          : "text.primary",
                        border: isUser ? 0 : 1,
                        borderColor: "divider",
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
                      borderRadius: 2.5,
                      bgcolor: "background.paper",
                      border: 1,
                      borderColor: "divider",
                      color: "text.secondary",
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
                      borderRadius: 2.5,
                      bgcolor: "background.paper",
                      border: 1,
                      borderColor: "error.light",
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
          borderColor: "divider",
          bgcolor: "background.paper",
          px: { xs: 1.5, sm: 2 },
          py: 1.5,
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="flex-start"
          sx={{
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
            onChange={handleInput}
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
            disabled={!input.trim() || isSending}
            sx={{
              minHeight: 56,
              px: { xs: 2, sm: 3 },
            }}
          >
            {isSending ? "Buscando…" : "Enviar"}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};

export default HelpChat;
