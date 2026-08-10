function pointInRing(
  longitude,
  latitude,
  ring
) {
  let inside = false;

  for (
    let i = 0, j = ring.length - 1;
    i < ring.length;
    j = i++
  ) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const intersects =
      yi > latitude !== yj > latitude &&
      longitude <
        ((xj - xi) *
          (latitude - yi)) /
          (yj - yi) +
          xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function pointInPolygon(
  longitude,
  latitude,
  polygon
) {
  if (
    !Array.isArray(polygon) ||
    polygon.length === 0
  ) {
    return false;
  }

  if (
    !pointInRing(
      longitude,
      latitude,
      polygon[0]
    )
  ) {
    return false;
  }

  for (
    let i = 1;
    i < polygon.length;
    i += 1
  ) {
    if (
      pointInRing(
        longitude,
        latitude,
        polygon[i]
      )
    ) {
      return false;
    }
  }

  return true;
}

function pointInGeometry(
  longitude,
  latitude,
  geometry
) {
  if (
    !geometry ||
    typeof geometry !== "object"
  ) {
    return false;
  }

  if (
    geometry.type === "Polygon"
  ) {
    return pointInPolygon(
      longitude,
      latitude,
      geometry.coordinates
    );
  }

  if (
    geometry.type === "MultiPolygon"
  ) {
    return geometry.coordinates.some(
      (polygon) =>
        pointInPolygon(
          longitude,
          latitude,
          polygon
        )
    );
  }

  return false;
}

export function resolveProvinceKeyFromPoint({
  latitude,
  longitude,
  features,
} = {}) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Array.isArray(features)
  ) {
    return null;
  }

  for (const feature of features) {
    const provinceKey =
      feature?.properties
        ?.provinceKey;

    if (
      typeof provinceKey !==
        "string" ||
      !provinceKey.trim()
    ) {
      continue;
    }

    if (
      pointInGeometry(
        longitude,
        latitude,
        feature.geometry
      )
    ) {
      return provinceKey.trim();
    }
  }

  return null;
}
