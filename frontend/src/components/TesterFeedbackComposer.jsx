import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";

import {
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  HELPCHAT_BRAND as BRAND,
} from "./helpChatBrand";

export default function TesterFeedbackComposer({
  reason,
  sending,
  speechError,
  isListening,
  speechRecognitionSupported,
  onChange,
  onSend,
  onCancel,
  onToggleSpeech,
}) {
  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: BRAND.plumDark,
            fontWeight: 700,
          }}
        >
          ⚑ Estás reportando un problema
        </Typography>

        <IconButton
          type="button"
          size="small"
          onClick={onCancel}
          aria-label="Cancelar reporte de problema"
          sx={{
            width: 36,
            height: 36,
            flexShrink: 0,
            color: BRAND.coral,
            border: 1,
            borderColor: BRAND.border,
          }}
        >
          ✕
        </IconButton>
      </Stack>

      <Typography
        variant="caption"
        sx={{
          display: "block",
          mb: 1,
          color: BRAND.textSecondary,
        }}
      >
        ¿Qué ha ocurrido? ¿Cuál es el error que has detectado?
      </Typography>

      <TextField
        fullWidth
        id="mensaje"
        name="mensaje"
        value={reason}
        slotProps={{
          htmlInput: {
            "aria-label":
              "¿Qué ha ocurrido? ¿Cuál es el error que has detectado?",
          },
          formHelperText: {
            role: "status",
            "aria-live": "polite",
          },
        }}
        required
        minRows={3}
        maxRows={7}
        multiline
        placeholder="Puedes explicarlo escribiendo o usando el micrófono…"
        onChange={onChange}
        helperText={
          speechError ||
          (isListening
            ? "Escuchando…"
            : "")
        }
        sx={{
          "& .MuiOutlinedInput-root": {
            bgcolor: BRAND.surface,
            borderRadius: 3,
            "& fieldset": {
              borderColor: BRAND.coral,
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

      <Stack
        direction="row"
        spacing={1}
        sx={{
          mt: 1,
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        {speechRecognitionSupported && (
          <IconButton
            type="button"
            onClick={onToggleSpeech}
            aria-label={
              isListening
                ? "Detener dictado"
                : "Dictar reporte de problema"
            }
            aria-pressed={isListening}
            sx={{
              width: 46,
              height: 46,
              flexShrink: 0,
              color: BRAND.coral,
              border: 1,
              borderColor: BRAND.coral,
              bgcolor: BRAND.surface,
            }}
          >
            {isListening
              ? <StopIcon />
              : <MicIcon />}
          </IconButton>
        )}

        <Button
          type="submit"
          variant="contained"
          disabled={
            sending ||
            !reason.trim()
          }
          sx={{
            minHeight: 46,
            px: 2.25,
            borderRadius: 3,
            textTransform: "none",
            fontWeight: 700,
            bgcolor: BRAND.coral,
            "&:hover": {
              bgcolor: BRAND.coral,
            },
          }}
        >
          {sending
            ? "Guardando…"
            : "Enviar error"}
        </Button>
      </Stack>
    </>
  );
}
