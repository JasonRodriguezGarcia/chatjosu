import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  DEFAULT_GEOLOCATION_OPTIONS,
  requestBrowserProvince,
} from "./browserProvinceLocation";

function grantedGeolocation({
  latitude = 43.263,
  longitude = -2.935,
} = {}) {
  return {
    getCurrentPosition(
      success,
      _error,
      options
    ) {
      expect(options).toEqual(
        DEFAULT_GEOLOCATION_OPTIONS
      );

      success({
        coords: {
          latitude,
          longitude,
          accuracy: 100,
        },
      });
    },
  };
}

describe(
  "requestBrowserProvince",
  () => {
    it(
      "resuelve provincia sin devolver coordenadas",
      async () => {
        const loadProvinceFeatures =
          vi.fn(
            async () => [
              {
                mock: true,
              },
            ]
          );

        const resolveProvinceKey =
          vi.fn(
            ({
              latitude,
              longitude,
              features,
            }) => {
              expect(latitude)
                .toBe(43.263);

              expect(longitude)
                .toBe(-2.935);

              expect(features)
                .toHaveLength(1);

              return "VIZCAYA";
            }
          );

        const result =
          await requestBrowserProvince({
            geolocation:
              grantedGeolocation(),
            loadProvinceFeatures,
            resolveProvinceKey,
          });

        expect(result).toEqual({
          status: "resolved",
          provinceKey:
            "VIZCAYA",
        });

        expect(
          Object.hasOwn(
            result,
            "latitude"
          )
        ).toBe(false);

        expect(
          Object.hasOwn(
            result,
            "longitude"
          )
        ).toBe(false);

        expect(
          loadProvinceFeatures
        ).toHaveBeenCalledTimes(1);
      }
    );

    it(
      "distingue permiso denegado",
      async () => {
        const geolocation = {
          getCurrentPosition(
            _success,
            error
          ) {
            error({
              code: 1,
            });
          },
        };

        const loadProvinceFeatures =
          vi.fn();

        const result =
          await requestBrowserProvince({
            geolocation,
            loadProvinceFeatures,
            resolveProvinceKey:
              () => "VIZCAYA",
          });

        expect(result).toEqual({
          status: "denied",
        });

        expect(
          loadProvinceFeatures
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "degrada cuando geolocation no existe",
      async () => {
        expect(
          await requestBrowserProvince({
            geolocation: null,
            loadProvinceFeatures:
              async () => [],
            resolveProvinceKey:
              () => null,
          })
        ).toEqual({
          status: "unsupported",
        });
      }
    );

    it(
      "degrada ante error de posicionamiento",
      async () => {
        const geolocation = {
          getCurrentPosition(
            _success,
            error
          ) {
            error({
              code: 2,
            });
          },
        };

        expect(
          await requestBrowserProvince({
            geolocation,
            loadProvinceFeatures:
              async () => [],
            resolveProvinceKey:
              () => null,
          })
        ).toEqual({
          status: "unavailable",
        });
      }
    );

    it(
      "degrada si el punto no pertenece a una provincia",
      async () => {
        const result =
          await requestBrowserProvince({
            geolocation:
              grantedGeolocation(),
            loadProvinceFeatures:
              async () => [],
            resolveProvinceKey:
              () => null,
          });

        expect(result).toEqual({
          status: "unavailable",
        });
      }
    );

    it(
      "degrada si falla la carga de geometrías",
      async () => {
        const result =
          await requestBrowserProvince({
            geolocation:
              grantedGeolocation(),
            loadProvinceFeatures:
              async () => {
                throw new Error(
                  "LOAD_FAILED"
                );
              },
            resolveProvinceKey:
              () => "VIZCAYA",
          });

        expect(result).toEqual({
          status: "unavailable",
        });
      }
    );
  }
);
