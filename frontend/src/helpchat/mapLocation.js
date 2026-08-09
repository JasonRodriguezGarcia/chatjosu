const cleanText = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  return text || null;
};

const cleanAddress = (value) => {
  const address = cleanText(value);

  if (!address) {
    return null;
  }

  const normalized = address.toLocaleLowerCase("es");

  const placeholderPatterns = [
    "consultar",
    "ver web",
    "en web",
    "sede en",
    "sedes y horarios",
    "contactar",
  ];

  if (placeholderPatterns.some((pattern) => normalized.includes(pattern))) {
    return null;
  }

  return address;
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

  const validLatitude =
    latitude !== null &&
    latitude >= -90 &&
    latitude <= 90;

  const validLongitude =
    longitude !== null &&
    longitude >= -180 &&
    longitude <= 180;

  let query = null;

  if (validLatitude && validLongitude) {
    query = `${latitude},${longitude}`;
  } else {
    const locationParts = [
      cleanAddress(association.address),
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
