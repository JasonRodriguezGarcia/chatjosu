import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";

import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
} from "@mui/material";

import {
  HELPCHAT_BRAND as BRAND,
} from "./helpChatBrand";

export default function HelpChatComposer({
  input,
  errorInput,
  speechError,
  isListening,
  speechRecognitionSupported,
  testerMode,
  testerCapturedTurnCount,
  onInputChange,
  onSend,
  onToggleSpeech,
  onTesterFeedbackStart,
}) {
  return (
    <Stack
      direction="row"
      spacing={{
        xs: 0.75,
        sm: 1.5,
      }}
      sx={{
        alignItems: "flex-start",
        width: "100%",
      }}
    >
      <Box
        sx={{
          position: "relative",
          flex: 1,
          minWidth: 0,
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
            errorInput
              ? "El mensaje no puede estar vacío"
              : speechError ||
                (isListening
                  ? "Escuchando…"
                  : "")
          }
          slotProps={{
            formHelperText: {
              role: "status",
              "aria-live": "polite",
            },
          }}
          placeholder="Cuéntanos qué necesitas…"
          onChange={onInputChange}
          sx={{
            "& .MuiOutlinedInput-root": {
              bgcolor: BRAND.surface,
              borderRadius: 3,
              "& fieldset": {
                borderColor: BRAND.border,
              },
            },
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey
            ) {
              event.preventDefault();
              onSend();
            }
          }}
        />
      </Box>

      {speechRecognitionSupported && (
        <IconButton
          type="button"
          onClick={onToggleSpeech}
          aria-label={
            isListening
              ? "Detener dictado"
              : "Dictar mensaje"
          }
          aria-pressed={isListening}
          sx={{
            mt: 0.25,
            width: {
              xs: 44,
              sm: 52,
            },
            height: {
              xs: 44,
              sm: 52,
            },
            flexShrink: 0,
            color:
              isListening
                ? BRAND.coral
                : BRAND.plum,
            border: 1,
            borderColor:
              isListening
                ? BRAND.coral
                : BRAND.border,
            bgcolor: BRAND.surface,
          }}
        >
          {isListening
            ? <StopIcon />
            : <MicIcon />}
        </IconButton>
      )}

      <Stack
        spacing={0.75}
        sx={{
          flexShrink: 0,
          alignItems: "stretch",
        }}
      >
        <Button
          type="submit"
          variant="contained"
          disabled={!input.trim()}
          sx={{
            minHeight: {
              xs: 44,
              sm: 56,
            },
            minWidth: {
              xs: 68,
              sm: 96,
            },
            px: {
              xs: 1,
              sm: 2.5,
            },
            borderRadius: 3,
            textTransform: "none",
            fontWeight: 700,
            bgcolor: BRAND.plum,
            "&:hover": {
              bgcolor: BRAND.plumDark,
            },
          }}
        >
          Enviar
        </Button>

        {testerMode && (
          <IconButton
            type="button"
            disabled={
              testerCapturedTurnCount === 0
            }
            onClick={
              onTesterFeedbackStart
            }
            aria-label="Reportar un problema en esta conversación"
            aria-pressed={false}
            size="small"
            sx={{
              alignSelf: "center",
              width: 32,
              height: 32,
              color: BRAND.coral,
              bgcolor: BRAND.surface,
              border: 1,
              borderColor: BRAND.border,
              "&:hover": {
                bgcolor: BRAND.plumSoft,
              },
            }}
          >
            ⚑
          </IconButton>
        )}
      </Stack>
    </Stack>
  );
}
