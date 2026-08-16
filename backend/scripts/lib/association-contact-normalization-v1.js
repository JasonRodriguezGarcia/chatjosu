function cleanText(value) {
  const text =
    String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  return text || null;
}

function looksPlaceholder(value) {
  const text =
    String(value ?? "")
      .trim()
      .toLocaleUpperCase("es-ES");

  return [
    "",
    "-",
    "--",
    "NO",
    "NO HAY",
    "NO TIENE",
    "NO APLICA",
    "N/A",
    "N/C",
    "NC",
    "NINGUNO",
    "NINGUNA",
  ].includes(text);
}

function unwrapMarkdownLink(value) {
  const text =
    cleanText(value);

  if (!text) {
    return null;
  }

  const match =
    text.match(
      /^\[[^\]]*]\((https?:\/\/[^)]+)\)$/i
    );

  return cleanText(
    match ? match[1] : text
  );
}

export function normalizeEmailV1(value) {
  const text =
    cleanText(value);

  if (
    !text ||
    looksPlaceholder(text)
  ) {
    return null;
  }

  const match =
    text.match(
      /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/
    );

  return match
    ? match[0].toLowerCase()
    : null;
}

export function normalizePhoneV1(value) {
  const text =
    cleanText(value);

  if (
    !text ||
    looksPlaceholder(text)
  ) {
    return null;
  }

  const match =
    text.match(
      /(?<!\d)(?:\+34[\s.-]*)?(?:[6789]\d{2})(?:[\s.-]*\d{3})(?:[\s.-]*\d{3})(?!\d)/
    );

  if (!match) {
    return null;
  }

  const digits =
    match[0]
      .replace(/[^\d+]/g, "");

  const local =
    digits.replace(/^\+34/, "");

  if (local.length !== 9) {
    return null;
  }

  if (
    digits.startsWith("+34")
  ) {
    return (
      "+34 " +
      local.slice(0, 3) +
      " " +
      local.slice(3, 6) +
      " " +
      local.slice(6)
    );
  }

  return (
    local.slice(0, 3) +
    " " +
    local.slice(3, 6) +
    " " +
    local.slice(6)
  );
}

export function normalizeWebsiteV1(value) {
  let text =
    unwrapMarkdownLink(value);

  if (
    !text ||
    looksPlaceholder(text)
  ) {
    return null;
  }

  /*
   * Si realmente es email o teléfono,
   * nunca debe convertirse en website.
   */
  if (
    normalizeEmailV1(text) ||
    normalizePhoneV1(text)
  ) {
    return null;
  }

  text =
    text
      .replace(/^web\s*:\s*/i, "")
      .trim();

  /*
   * Dominios registrales sin esquema:
   * downaraba.org, agaer.org, etc.
   */
  if (
    !/^https?:\/\//i.test(text)
  ) {
    if (
      /^(?:www\.)?[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}(?:\/[^\s]*)?$/i.test(
        text
      )
    ) {
      text =
        `https://${text}`;
    } else {
      return null;
    }
  }

  try {
    const url =
      new URL(text);

    if (
      !url.hostname ||
      !url.hostname.includes(".")
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeContactFieldsV1({
  phone,
  email,
  website,
  fallbackText,
} = {}) {
  let normalizedPhone =
    normalizePhoneV1(phone);

  let normalizedEmail =
    normalizeEmailV1(email);

  let normalizedWebsite =
    normalizeWebsiteV1(website);

  const provenance = {};

  if (normalizedPhone) {
    provenance.phone = {
      method: "structured",
      source_field: "phone",
    };
  }

  if (normalizedEmail) {
    provenance.email = {
      method: "structured",
      source_field: "email",
    };
  }

  if (normalizedWebsite) {
    provenance.website = {
      method: "structured",
      source_field: "website",
    };
  }

  /*
   * Detectar datos desplazados:
   * email/teléfono alojado en la columna web.
   */
  if (
    !normalizedEmail &&
    website
  ) {
    const misplaced =
      normalizeEmailV1(website);

    if (misplaced) {
      normalizedEmail =
        misplaced;

      provenance.email = {
        method: "misplaced",
        source_field: "website",
      };
    }
  }

  if (
    !normalizedPhone &&
    website
  ) {
    const misplaced =
      normalizePhoneV1(website);

    if (misplaced) {
      normalizedPhone =
        misplaced;

      provenance.phone = {
        method: "misplaced",
        source_field: "website",
      };
    }
  }

  /*
   * Recuperación conservadora desde texto
   * solo cuando falta el campo estructurado.
   */
  if (
    !normalizedEmail &&
    fallbackText
  ) {
    const recovered =
      normalizeEmailV1(
        fallbackText
      );

    if (recovered) {
      normalizedEmail =
        recovered;

      provenance.email = {
        method: "embedded",
        source_field: "fallback_text",
      };
    }
  }

  if (
    !normalizedPhone &&
    fallbackText
  ) {
    const recovered =
      normalizePhoneV1(
        fallbackText
      );

    if (recovered) {
      normalizedPhone =
        recovered;

      provenance.phone = {
        method: "embedded",
        source_field: "fallback_text",
      };
    }
  }

  return {
    phone:
      normalizedPhone,
    email:
      normalizedEmail,
    website:
      normalizedWebsite,
    provenance,
  };
}
