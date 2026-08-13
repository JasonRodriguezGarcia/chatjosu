import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { Box, Button, Stack, Typography } from "@mui/material";
import { buildAssociationMapUrl } from "../helpchat/mapLocation";

const unwrapLink = (value) => {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  const markdown = text.match(/^\[([^\]]+)\]\((.+)\)$/);

  if (!markdown) {
    return text;
  }

  return markdown[2] || markdown[1] || null;
};

const normalizeWebsite = (value) => {
  const website = unwrapLink(value);

  if (!website) {
    return null;
  }

  if (/^https?:\/\//i.test(website)) {
    return website;
  }

  return `https://${website}`;
};

const formatScope = (value) => {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();

  const labels = {
    local: "Ámbito local",
    municipal: "Ámbito municipal",
    provincial: "Ámbito provincial",
    regional: "Ámbito regional",
    autonomico: "Ámbito autonómico",
    "autonómico": "Ámbito autonómico",
    nacional: "Ámbito nacional",
    national: "Ámbito nacional",
  };

  return labels[normalized] || `Ámbito ${value}`;
};

const AssociationCard = ({ association }) => {
  const website = normalizeWebsite(association?.website);
  const email = unwrapLink(association?.email);
  const phone = association?.phone?.trim() || null;
  const scope = formatScope(association?.scope);
  const mapUrl = buildAssociationMapUrl(association);

  const primaryAction =
    phone
      ? "phone"
      : website
        ? "website"
        : email
          ? "email"
          : mapUrl
            ? "map"
            : null;

  const actionStyle = (action) =>
    primaryAction === action
      ? {
          bgcolor: "#765366",
          color: "#FFFFFF",
          borderColor: "#765366",
          boxShadow: "none",
          "&:hover": {
            bgcolor: "#624456",
            borderColor: "#624456",
            boxShadow: "none",
          },
        }
      : {
          color: "#765366",
          borderColor: "#E8DDD7",
          bgcolor: "transparent",
          "&:hover": {
            borderColor: "#765366",
            bgcolor: "#F4EAF0",
          },
        };

  const location = [
    association?.municipality,
    association?.province,
  ]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" · ");

  return (
    <Box
      component="article"
      sx={{
        p: { xs: 2, sm: 2.25 },
        bgcolor: "#FFFFFF",
        border: "1px solid #E8DDD7",
        borderRadius: 3,
        boxShadow: "0 5px 20px rgba(51, 45, 49, 0.06)",
      }}
    >
      <Stack spacing={1.25}>
        <Box>
          <Typography
            component="h3"
            variant="subtitle1"
            sx={{
              color: "#332D31",
              fontWeight: 700,
              lineHeight: 1.35,
            }}
          >
            {association?.name || "Recurso"}
          </Typography>

          {location && (
            <Typography
              variant="body2"
              sx={{
                mt: 0.35,
                color: "#71676C",
              }}
            >
              {location}
            </Typography>
          )}

          {scope && (
            <Typography
              variant="caption"
              sx={{
                display: "inline-block",
                mt: 0.75,
                px: 1,
                py: 0.35,
                color: "#5F806B",
                bgcolor: "#EEF6F0",
                borderRadius: 999,
                fontWeight: 700,
              }}
            >
              {scope}
            </Typography>
          )}
        </Box>

        {association?.description && (
          <Box>
            <Typography
              variant="caption"
              component="h4"
              sx={{
                mb: 0.35,
                color: "#765366",
                fontWeight: 700,
                lineHeight: 1.4,
              }}
            >
              Cómo puede orientarte
            </Typography>

            <Typography
              variant="body2"
              sx={{
                color: "#332D31",
                lineHeight: 1.6,
              }}
            >
              {association.description}
            </Typography>
          </Box>
        )}

        {(association?.address || association?.postal_code) && (
          <Typography
            variant="body2"
            sx={{ color: "#71676C" }}
          >
            {[association.address, association.postal_code]
              .filter(Boolean)
              .join(" · ")}
          </Typography>
        )}

        {(phone || email) && (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 0.35, sm: 1.5 }}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            {phone && (
              <Typography
                component="span"
                variant="body2"
                sx={{ color: "#71676C" }}
              >
                {phone}
              </Typography>
            )}

            {email && (
              <Typography
                component="span"
                variant="body2"
                sx={{
                  color: "#71676C",
                  overflowWrap: "anywhere",
                }}
              >
                {email}
              </Typography>
            )}
          </Stack>
        )}

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{
            flexWrap: "wrap",
            pt: 0.25,
            "& .MuiButton-root": {
              minHeight: 36,
              px: 1.5,
              textTransform: "none",
              borderRadius: 999,
            },
          }}
        >
          {phone && (
            <Button
              component="a"
              href={`tel:${phone.replace(/\s+/g, "")}`}
              variant={
                primaryAction === "phone"
                  ? "contained"
                  : "outlined"
              }
              size="small"
              startIcon={<LocalPhoneOutlinedIcon />}
              aria-label={`Llamar a ${
                association?.name || "recurso"
              }`}
              sx={actionStyle("phone")}
            >
              Llamar
            </Button>
          )}

          {email && (
            <Button
              component="a"
              href={`mailto:${email}`}
              variant={
                primaryAction === "email"
                  ? "contained"
                  : "outlined"
              }
              size="small"
              startIcon={<EmailOutlinedIcon />}
              aria-label={`Enviar un email a ${
                association?.name || "recurso"
              }`}
              sx={actionStyle("email")}
            >
              Email
            </Button>
          )}

          {website && (
            <Button
              component="a"
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              variant={
                primaryAction === "website"
                  ? "contained"
                  : "outlined"
              }
              size="small"
              startIcon={<LanguageOutlinedIcon />}
              aria-label={`Abrir el sitio web de ${
                association?.name || "recurso"
              }`}
              sx={actionStyle("website")}
            >
              Sitio web
            </Button>
          )}

          {mapUrl && (
            <Button
              component="a"
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant={
                primaryAction === "map"
                  ? "contained"
                  : "outlined"
              }
              size="small"
              startIcon={<PlaceOutlinedIcon />}
              aria-label={`Ver ${
                association?.name || "recurso"
              } en el mapa`}
              sx={actionStyle("map")}
            >
              Ver en mapa
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};

export default AssociationCard;
