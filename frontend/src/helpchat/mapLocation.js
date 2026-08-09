const cleanText = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  return text || null;
};

const cleanCoordinate = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const coordinate = Number(value);

  return Number.isFinite(coordinate) ? coordinate : null;
};

export const buildAssociationMapUrl = (association) => {
  if (!association || typeof association !== "object") {
    return null;
  }

  const latitude = cleanCoordinate(association.latitude);
  const longitude = cleanCoordinate(association.longitude);

  let query = null;

  if (latitude !== null && longitude !== null) {
    query = `${latitude},${longitude}`;
  } else {
    const locationParts = [
      cleanText(association.address),
      cleanText(association.postal_code),
      cleanText(association.municipality),
      cleanText(association.province),
    ].filter(Boolean);

    if (locationParts.length === 0) {
      return null;
    }

    query = locationParts.join(", ");
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};
