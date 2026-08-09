const cleanString = (value) =>
  typeof value === "string" && value.trim()
    ? value.trim()
    : null;

export const normalizeDetectedLocation = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const province = cleanString(value.province);
  const provinceKey = cleanString(value.provinceKey);

  if (!province && !provinceKey) {
    return null;
  }

  return {
    country: cleanString(value.country),
    provinceKey,
    province,
    municipality: cleanString(value.municipality),
    source: "ip",
    confidence: "coarse",
  };
};

export const normalizeProvinceOption = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const label = cleanString(value.label);
  const provinceKey = cleanString(value.provinceKey);

  if (!label) {
    return null;
  }

  return {
    ...value,
    label,
    provinceKey,
  };
};

export const findDetectedProvince = (
  provinces,
  detectedLocation,
) => {
  if (
    !Array.isArray(provinces) ||
    !detectedLocation
  ) {
    return null;
  }

  const detectedKey = cleanString(
    detectedLocation.provinceKey,
  );

  if (detectedKey) {
    const byKey = provinces.find((province) => {
      const normalized =
        normalizeProvinceOption(province);

      return (
        normalized?.provinceKey &&
        normalized.provinceKey.localeCompare(
          detectedKey,
          "es",
          { sensitivity: "base" },
        ) === 0
      );
    });

    if (byKey) {
      return byKey;
    }
  }

  const detectedProvince = cleanString(
    detectedLocation.province,
  );

  if (!detectedProvince) {
    return null;
  }

  return (
    provinces.find((province) => {
      const normalized =
        normalizeProvinceOption(province);

      return (
        normalized?.label &&
        normalized.label.localeCompare(
          detectedProvince,
          "es",
          { sensitivity: "base" },
        ) === 0
      );
    }) || null
  );
};
