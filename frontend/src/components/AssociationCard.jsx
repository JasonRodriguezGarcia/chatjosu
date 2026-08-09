import { Box, Button, Stack, Typography } from "@mui/material";

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
          <Typography
            variant="body2"
            sx={{
              color: "#332D31",
              lineHeight: 1.55,
            }}
          >
            {association.description}
          </Typography>
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
          <Stack spacing={0.35}>
            {phone && (
              <Typography variant="body2" sx={{ color: "#332D31" }}>
                Teléfono: {phone}
              </Typography>
            )}

            {email && (
              <Typography
                variant="body2"
                sx={{
                  color: "#332D31",
                  overflowWrap: "anywhere",
                }}
              >
                Email: {email}
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
          }}
        >
          {phone && (
            <Button
              component="a"
              href={`tel:${phone.replace(/\s+/g, "")}`}
              variant="outlined"
              size="small"
              sx={{
                textTransform: "none",
                borderRadius: 999,
                color: "#765366",
                borderColor: "#E8DDD7",
              }}
            >
              Llamar
            </Button>
          )}

          {email && (
            <Button
              component="a"
              href={`mailto:${email}`}
              variant="outlined"
              size="small"
              sx={{
                textTransform: "none",
                borderRadius: 999,
                color: "#765366",
                borderColor: "#E8DDD7",
              }}
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
              variant="outlined"
              size="small"
              sx={{
                textTransform: "none",
                borderRadius: 999,
                color: "#765366",
                borderColor: "#E8DDD7",
              }}
            >
              Sitio web
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};

export default AssociationCard;
