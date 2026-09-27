import assert from "node:assert/strict";
import test from "node:test";

import {
  createIpLocationLookup,
} from "../services/helpchat-ip-location-provider-v1.js";

test(
  "resuelve Irun a Gipuzkoa mediante postal GeoIP",
  async () => {
    const lookup =
      createIpLocationLookup({
        fetchImpl:
          async (
            url,
            options
          ) => {
            assert.match(
              url,
              /ipwho\.is/
            );

            assert.equal(
              options.method,
              "GET"
            );

            return {
              ok: true,
              async json() {
                return {
                  success: true,
                  city: "Irun",
                  region:
                    "Euskal Autonomia Erkidegoa",
                  country_code:
                    "ES",
                  postal:
                    "20304",
                };
              },
            };
          },
      });

    assert.deepEqual(
      await lookup(
        "8.8.8.8"
      ),
      {
        country: "ES",
        province:
          "GUIPUZCOA",
        municipality:
          "Irun",
      }
    );
  }
);

test(
  "no confía en region para decidir provincia",
  async () => {
    const lookup =
      createIpLocationLookup({
        fetchImpl:
          async () => ({
            ok: true,
            async json() {
              return {
                success: true,
                city: "Bilbao",
                region:
                  "Euskal Autonomia Erkidegoa",
                country_code:
                  "ES",
                postal:
                  "48001",
              };
            },
          }),
      });

    const result =
      await lookup(
        "8.8.8.8"
      );

    assert.equal(
      result.province,
      "VIZCAYA"
    );
  }
);

test(
  "rechaza ubicación fuera de España",
  async () => {
    const lookup =
      createIpLocationLookup({
        fetchImpl:
          async () => ({
            ok: true,
            async json() {
              return {
                success: true,
                country_code:
                  "FR",
                postal:
                  "75001",
                city:
                  "Paris",
              };
            },
          }),
      });

    assert.equal(
      await lookup(
        "8.8.8.8"
      ),
      null
    );
  }
);

test(
  "degrada si falta postal",
  async () => {
    const lookup =
      createIpLocationLookup({
        fetchImpl:
          async () => ({
            ok: true,
            async json() {
              return {
                success: true,
                country_code:
                  "ES",
                city:
                  "Irun",
              };
            },
          }),
      });

    assert.equal(
      await lookup(
        "8.8.8.8"
      ),
      null
    );
  }
);

test(
  "degrada si proveedor informa fallo",
  async () => {
    const lookup =
      createIpLocationLookup({
        fetchImpl:
          async () => ({
            ok: true,
            async json() {
              return {
                success: false,
              };
            },
          }),
      });

    assert.equal(
      await lookup(
        "8.8.8.8"
      ),
      null
    );
  }
);

test(
  "no expone IP ni postal en resultado",
  async () => {
    const lookup =
      createIpLocationLookup({
        fetchImpl:
          async () => ({
            ok: true,
            async json() {
              return {
                success: true,
                ip:
                  "8.8.8.8",
                country_code:
                  "ES",
                postal:
                  "28001",
                city:
                  "Madrid",
              };
            },
          }),
      });

    const result =
      await lookup(
        "8.8.8.8"
      );

    assert.deepEqual(
      result,
      {
        country: "ES",
        province:
          "MADRID",
        municipality:
          "Madrid",
      }
    );

    assert.equal(
      Object.hasOwn(
        result,
        "ip"
      ),
      false
    );

    assert.equal(
      Object.hasOwn(
        result,
        "postal"
      ),
      false
    );
  }
);
