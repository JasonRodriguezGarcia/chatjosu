function cleanString(value) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const cleaned =
    value.trim();

  return cleaned || null;
}

export function resolveHelpchatLocationRequirement({
  effectiveProvince,
  understanding,
} = {}) {
  const province =
    cleanString(
      effectiveProvince
    );

  if (province) {
    return {
      needsLocation: false,
      locationReason: null,
    };
  }

  if (
    !understanding ||
    understanding.status ===
      "needs_clarification" ||
    understanding.needsClarification ===
      true
  ) {
    return {
      needsLocation: false,
      locationReason: null,
    };
  }

  const tag =
    understanding.tag;

  if (
    !tag ||
    !tag.tag_id ||
    !tag.descripcion
  ) {
    return {
      needsLocation: false,
      locationReason: null,
    };
  }

  return {
    needsLocation: true,
    locationReason:
      "province_required",
  };
}
