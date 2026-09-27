import {
  isIP,
} from "node:net";

function cleanIp(value) {
  let candidate =
    String(value || "")
      .trim();

  if (!candidate) {
    return null;
  }

  if (
    candidate.startsWith(
      "::ffff:"
    )
  ) {
    candidate =
      candidate.slice(
        "::ffff:".length
      );
  }

  return isIP(candidate)
    ? candidate
    : null;
}

export function isLoopbackIp(
  value
) {
  const ip =
    cleanIp(value);

  return (
    ip === "127.0.0.1" ||
    ip === "::1"
  );
}

export function isPrivateIp(
  value
) {
  const ip =
    cleanIp(value);

  if (!ip) {
    return false;
  }

  if (
    isLoopbackIp(ip)
  ) {
    return true;
  }

  if (isIP(ip) === 4) {
    const parts =
      ip.split(".")
        .map(Number);

    if (
      parts[0] === 10
    ) {
      return true;
    }

    if (
      parts[0] === 172 &&
      parts[1] >= 16 &&
      parts[1] <= 31
    ) {
      return true;
    }

    if (
      parts[0] === 192 &&
      parts[1] === 168
    ) {
      return true;
    }

    if (
      parts[0] === 169 &&
      parts[1] === 254
    ) {
      return true;
    }
  }

  const normalized =
    ip.toLowerCase();

  if (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) {
    return true;
  }

  return false;
}

export function isTrustedHelpchatProxyIp(
  value
) {
  const ip =
    cleanIp(value);

  if (!ip) {
    return false;
  }

  return (
    isLoopbackIp(ip) ||
    isPrivateIp(ip)
  );
}

export function helpchatClientIp({
  remoteAddress,
  cloudflareConnectingIp,
  trustCloudflare = false,
} = {}) {
  const remoteIp =
    cleanIp(remoteAddress);

  /*
   * CF-Connecting-IP solo se acepta
   * cuando expresamente confiamos en
   * Cloudflare y Cloudflare llega al
   * backend por loopback.
   *
   * Así un cliente directo no puede
   * falsificar este header.
   */
  if (
    trustCloudflare &&
    isTrustedHelpchatProxyIp(
      remoteIp
    )
  ) {
    const cloudflareIp =
      cleanIp(
        cloudflareConnectingIp
      );

    if (cloudflareIp) {
      return cloudflareIp;
    }
  }

  return remoteIp;
}

export function unavailableLocation() {
  return {
    country: null,
    province: null,
    municipality: null,
    source: "unavailable",
    confidence: "none",
  };
}

function repairHeaderMojibake(value) {
  if (
    typeof value !== "string" ||
    !/[ÃÂ]/.test(value)
  ) {
    return value;
  }

  try {
    const repaired =
      Buffer.from(
        value,
        "latin1"
      ).toString(
        "utf8"
      );

    if (
      repaired &&
      !repaired.includes(
        "\uFFFD"
      )
    ) {
      return repaired;
    }
  } catch {
    // Mantener original.
  }

  return value;
}

function cleanString(value) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const cleaned =
    repairHeaderMojibake(
      value
    ).trim();

  return cleaned || null;
}

export function normalizeCloudflareLocation(
  value
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return unavailableLocation();
  }

  const country =
    cleanString(
      value.country
    );

  const province =
    cleanString(
      value.province
    );

  const municipality =
    cleanString(
      value.municipality
    );

  if (!province) {
    return unavailableLocation();
  }

  return {
    country,
    province,
    municipality,
    source: "ip",
    confidence: "coarse",
  };
}

export function normalizeIpLocation(
  value
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return unavailableLocation();
  }

  const province =
    cleanString(
      value.province
    );

  if (!province) {
    return unavailableLocation();
  }

  return {
    country:
      cleanString(
        value.country
      ),
    province,
    municipality:
      cleanString(
        value.municipality
      ),
    source: "ip",
    confidence: "coarse",
  };
}

export function createHelpchatLocationResolver({
  lookupIp = null,
} = {}) {
  return async function resolveHelpchatLocation({
    ip,
  } = {}) {
    const clientIp =
      cleanIp(ip);

    if (
      !clientIp ||
      isPrivateIp(clientIp) ||
      typeof lookupIp !== "function"
    ) {
      return unavailableLocation();
    }

    try {
      const location =
        await lookupIp(
          clientIp
        );

      return normalizeIpLocation(
        location
      );
    } catch {
      /*
       * GeoIP es mejora silenciosa.
       * Nunca debe romper HelpChat.
       */
      return unavailableLocation();
    }
  };
}
