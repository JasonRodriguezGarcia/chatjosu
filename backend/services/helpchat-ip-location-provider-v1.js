import {
  provinceKeyFromSpanishPostalCode,
} from "../helpchat/spanish-postal-province-v1.js";

const DEFAULT_TIMEOUT_MS = 1200;

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

export function createIpLocationLookup({
  fetchImpl = globalThis.fetch,
  timeoutMs =
    DEFAULT_TIMEOUT_MS,
} = {}) {
  if (
    typeof fetchImpl !==
    "function"
  ) {
    return async () => null;
  }

  return async function lookupIp(
    ip
  ) {
    if (!ip) {
      return null;
    }

    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () =>
          controller.abort(),
        timeoutMs
      );

    try {
      const response =
        await fetchImpl(
          `https://ipwho.is/${encodeURIComponent(ip)}`,
          {
            method: "GET",
            headers: {
              Accept:
                "application/json",
            },
            signal:
              controller.signal,
          }
        );

      if (!response.ok) {
        return null;
      }

      const data =
        await response.json();

      if (
        !data ||
        typeof data !==
          "object" ||
        data.success === false
      ) {
        return null;
      }

      if (
        cleanString(
          data.country_code
        ) !== "ES"
      ) {
        return null;
      }

      const provinceKey =
        provinceKeyFromSpanishPostalCode(
          data.postal
        );

      if (!provinceKey) {
        return null;
      }

      return {
        country: "ES",
        province:
          provinceKey,
        municipality:
          cleanString(
            data.city
          ),
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
}

export {
  DEFAULT_TIMEOUT_MS,
};
