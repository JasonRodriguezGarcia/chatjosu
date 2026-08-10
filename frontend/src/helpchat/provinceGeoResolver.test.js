import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolveProvinceKeyFromPoint,
} from "./provinceGeoResolver";

describe(
  "resolveProvinceKeyFromPoint",
  () => {
    it(
      "resuelve un punto dentro de un polígono",
      () => {
        const features = [
          {
            type: "Feature",
            properties: {
              provinceKey:
                "VIZCAYA",
            },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-3.5, 42.8],
                  [-2.3, 42.8],
                  [-2.3, 43.6],
                  [-3.5, 43.6],
                  [-3.5, 42.8],
                ],
              ],
            },
          },
        ];

        expect(
          resolveProvinceKeyFromPoint({
            latitude:
              43.263,
            longitude:
              -2.935,
            features,
          })
        ).toBe(
          "VIZCAYA"
        );
      }
    );

    it(
      "devuelve null fuera de las geometrías",
      () => {
        const features = [
          {
            type: "Feature",
            properties: {
              provinceKey:
                "MADRID",
            },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-4, 40],
                  [-3, 40],
                  [-3, 41],
                  [-4, 41],
                  [-4, 40],
                ],
              ],
            },
          },
        ];

        expect(
          resolveProvinceKeyFromPoint({
            latitude: 43.26,
            longitude: -2.93,
            features,
          })
        ).toBeNull();
      }
    );

    it(
      "soporta MultiPolygon",
      () => {
        const features = [
          {
            type: "Feature",
            properties: {
              provinceKey:
                "LAS PALMAS",
            },
            geometry: {
              type:
                "MultiPolygon",
              coordinates: [
                [
                  [
                    [-15.8, 27.8],
                    [-15.2, 27.8],
                    [-15.2, 28.3],
                    [-15.8, 28.3],
                    [-15.8, 27.8],
                  ],
                ],
                [
                  [
                    [-13.9, 28.8],
                    [-13.3, 28.8],
                    [-13.3, 29.3],
                    [-13.9, 29.3],
                    [-13.9, 28.8],
                  ],
                ],
              ],
            },
          },
        ];

        expect(
          resolveProvinceKeyFromPoint({
            latitude: 28.1,
            longitude: -15.5,
            features,
          })
        ).toBe(
          "LAS PALMAS"
        );
      }
    );

    it(
      "respeta huecos interiores",
      () => {
        const features = [
          {
            type: "Feature",
            properties: {
              provinceKey:
                "TEST",
            },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [10, 0],
                  [10, 10],
                  [0, 10],
                  [0, 0],
                ],
                [
                  [4, 4],
                  [6, 4],
                  [6, 6],
                  [4, 6],
                  [4, 4],
                ],
              ],
            },
          },
        ];

        expect(
          resolveProvinceKeyFromPoint({
            latitude: 5,
            longitude: 5,
            features,
          })
        ).toBeNull();

        expect(
          resolveProvinceKeyFromPoint({
            latitude: 2,
            longitude: 2,
            features,
          })
        ).toBe(
          "TEST"
        );
      }
    );
  }
);
