const DEFAULT_GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 300000,
};

function unavailable() {
  return {
    status: "unavailable",
  };
}

export function requestBrowserProvince({
  geolocation =
    globalThis.navigator?.geolocation,
  resolveProvinceKey,
  loadProvinceFeatures,
  options =
    DEFAULT_GEOLOCATION_OPTIONS,
} = {}) {
  if (
    !geolocation ||
    typeof geolocation
      .getCurrentPosition !==
      "function"
  ) {
    return Promise.resolve({
      status: "unsupported",
    });
  }

  if (
    typeof resolveProvinceKey !==
      "function" ||
    typeof loadProvinceFeatures !==
      "function"
  ) {
    return Promise.resolve(
      unavailable()
    );
  }

  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      async (position) => {
        const latitude =
          position?.coords
            ?.latitude;

        const longitude =
          position?.coords
            ?.longitude;

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          resolve(
            unavailable()
          );
          return;
        }

        try {
          /*
           * Las coordenadas existen
           * únicamente en este ámbito.
           * No se devuelven ni se
           * persisten.
           */
          const features =
            await loadProvinceFeatures();

          const provinceKey =
            resolveProvinceKey({
              latitude,
              longitude,
              features,
            });

          if (!provinceKey) {
            resolve(
              unavailable()
            );
            return;
          }

          resolve({
            status: "resolved",
            provinceKey,
          });
        } catch {
          resolve(
            unavailable()
          );
        }
      },
      (error) => {
        if (
          error?.code === 1
        ) {
          resolve({
            status: "denied",
          });
          return;
        }

        resolve(
          unavailable()
        );
      },
      options
    );
  });
}

export {
  DEFAULT_GEOLOCATION_OPTIONS,
};
