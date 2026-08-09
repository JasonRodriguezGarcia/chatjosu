export const normalizeDetectedLocation = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const province =
    typeof value.province === "string"
      ? value.province.trim()
      : "";

  if (!province) {
    return null;
  }

  const country =
    typeof value.country === "string" && value.country.trim()
      ? value.country.trim()
      : null;

  const municipality =
    typeof value.municipality === "string" &&
    value.municipality.trim()
      ? value.municipality.trim()
      : null;

  return {
    country,
    province,
    municipality,
    source: "ip",
    confidence: "coarse",
  };
};
