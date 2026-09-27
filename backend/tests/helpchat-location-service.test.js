import assert from "node:assert/strict";
import test from "node:test";

import {
  createHelpchatLocationResolver,
  helpchatClientIp,
  isPrivateIp,
  isTrustedHelpchatProxyIp,
  normalizeIpLocation,
} from "../services/helpchat-location-service.js";

test(
  "normaliza IPv4 mapeada desde IPv6",
  () => {
    assert.equal(
      helpchatClientIp({
        remoteAddress:
          "::ffff:203.0.113.8",
      }),
      "203.0.113.8"
    );
  }
);

test(
  "solo confía en CF-Connecting-IP desde loopback autorizado",
  () => {
    assert.equal(
      helpchatClientIp({
        remoteAddress:
          "127.0.0.1",
        cloudflareConnectingIp:
          "8.8.8.8",
        trustCloudflare: true,
      }),
      "8.8.8.8"
    );

    assert.equal(
      helpchatClientIp({
        remoteAddress:
          "203.0.113.5",
        cloudflareConnectingIp:
          "8.8.8.8",
        trustCloudflare: true,
      }),
      "203.0.113.5"
    );
  }
);

test(
  "clasifica solo peers locales o privados como proxies confiables",
  () => {
    assert.equal(
      isTrustedHelpchatProxyIp(
        "127.0.0.1"
      ),
      true
    );

    assert.equal(
      isTrustedHelpchatProxyIp(
        "172.18.0.1"
      ),
      true
    );

    assert.equal(
      isTrustedHelpchatProxyIp(
        "8.8.8.8"
      ),
      false
    );
  }
);

test(
  "confía en CF-Connecting-IP desde un proxy privado autorizado",
  () => {
    assert.equal(
      helpchatClientIp({
        remoteAddress:
          "172.18.0.1",
        cloudflareConnectingIp:
          "8.8.8.8",
        trustCloudflare:
          true,
      }),
      "8.8.8.8"
    );
  }
);

test(
  "detecta direcciones privadas y loopback",
  () => {
    assert.equal(
      isPrivateIp(
        "127.0.0.1"
      ),
      true
    );

    assert.equal(
      isPrivateIp(
        "192.168.1.20"
      ),
      true
    );

    assert.equal(
      isPrivateIp(
        "10.2.3.4"
      ),
      true
    );

    assert.equal(
      isPrivateIp(
        "8.8.8.8"
      ),
      false
    );
  }
);

test(
  "normaliza contrato GeoIP",
  () => {
    assert.deepEqual(
      normalizeIpLocation({
        country: " ES ",
        province: " Gipuzkoa ",
        municipality:
          " Donostia / San Sebastián ",
      }),
      {
        country: "ES",
        province: "Gipuzkoa",
        municipality:
          "Donostia / San Sebastián",
        source: "ip",
        confidence: "coarse",
      }
    );
  }
);

test(
  "resolver degrada silenciosamente sin motor GeoIP",
  async () => {
    const resolveLocation =
      createHelpchatLocationResolver();

    assert.deepEqual(
      await resolveLocation({
        ip: "8.8.8.8",
      }),
      {
        country: null,
        province: null,
        municipality: null,
        source: "unavailable",
        confidence: "none",
      }
    );
  }
);

test(
  "resolver usa motor GeoIP inyectado",
  async () => {
    const resolveLocation =
      createHelpchatLocationResolver({
        lookupIp:
          async () => ({
            country: "ES",
            province:
              "Gipuzkoa",
            municipality:
              "Donostia / San Sebastián",
          }),
      });

    assert.deepEqual(
      await resolveLocation({
        ip: "8.8.8.8",
      }),
      {
        country: "ES",
        province:
          "Gipuzkoa",
        municipality:
          "Donostia / San Sebastián",
        source: "ip",
        confidence: "coarse",
      }
    );
  }
);

test(
  "normaliza ubicación recibida de Cloudflare",
  async () => {
    const {
      normalizeCloudflareLocation,
    } = await import(
      "../services/helpchat-location-service.js"
    );

    assert.deepEqual(
      normalizeCloudflareLocation({
        country: " ES ",
        province:
          " Gipuzkoa ",
        municipality:
          " Donostia / San Sebastián ",
      }),
      {
        country: "ES",
        province:
          "Gipuzkoa",
        municipality:
          "Donostia / San Sebastián",
        source: "ip",
        confidence: "coarse",
      }
    );
  }
);

test(
  "Cloudflare sin provincia degrada a unavailable",
  async () => {
    const {
      normalizeCloudflareLocation,
    } = await import(
      "../services/helpchat-location-service.js"
    );

    assert.deepEqual(
      normalizeCloudflareLocation({
        country: "ES",
        municipality:
          "Donostia / San Sebastián",
      }),
      {
        country: null,
        province: null,
        municipality: null,
        source: "unavailable",
        confidence: "none",
      }
    );
  }
);

test(
  "repara mojibake común en headers GeoIP",
  async () => {
    const {
      normalizeCloudflareLocation,
    } = await import(
      "../services/helpchat-location-service.js"
    );

    assert.deepEqual(
      normalizeCloudflareLocation({
        country: "ES",
        province: "Gipuzkoa",
        municipality:
          "Donostia / San SebastiÃ¡n",
      }),
      {
        country: "ES",
        province: "Gipuzkoa",
        municipality:
          "Donostia / San Sebastián",
        source: "ip",
        confidence: "coarse",
      }
    );
  }
);
