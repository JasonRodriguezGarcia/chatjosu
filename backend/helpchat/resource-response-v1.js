function cleanText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned =
    value.trim();

  return cleaned || null;
}

function resolvedNeedNames(
  resolvedNeeds,
) {
  const output = [];
  const seen = new Set();

  for (
    const need of
    Array.isArray(resolvedNeeds)
      ? resolvedNeeds
      : []
  ) {
    const name =
      cleanText(
        need?.descripcion
      );

    if (
      !name ||
      seen.has(name)
    ) {
      continue;
    }

    seen.add(name);
    output.push(name);
  }

  return output;
}

function associationNeedNames(
  association,
) {
  const output = [];
  const seen = new Set();

  const candidates =
    Array.isArray(
      association?.matchedNeeds
    )
      ? association.matchedNeeds
      : (
          association?.matchedNeed
            ? [
                association.matchedNeed,
              ]
            : []
        );

  for (const candidate of candidates) {
    const name =
      cleanText(candidate);

    if (
      !name ||
      seen.has(name)
    ) {
      continue;
    }

    seen.add(name);
    output.push(name);
  }

  return output;
}

function associationDetails(
  association,
) {
  const details = [];

  const municipality =
    cleanText(
      association?.municipality
    );

  const phone =
    cleanText(
      association?.phone
    );

  const email =
    cleanText(
      association?.email
    );

  const website =
    cleanText(
      association?.website
    );

  if (municipality) {
    details.push(
      municipality
    );
  }

  if (phone) {
    details.push(
      `Tel.: ${phone}`
    );
  }

  if (email) {
    details.push(
      `Email: ${email}`
    );
  }

  if (website) {
    details.push(
      `Web: ${website}`
    );
  }

  return details;
}

function buildResourceLine({
  association,
  index,
  showNeedMatches,
}) {
  const details =
    associationDetails(
      association
    );

  const name =
    cleanText(
      association?.name
    ) ||
    "Recurso";

  let line =
    `${index + 1}. **${name}**`;

  if (details.length > 0) {
    line +=
      ` — ${details.join(" · ")}`;
  }

  const matches =
    associationNeedNames(
      association
    );

  if (
    showNeedMatches &&
    matches.length > 0
  ) {
    line +=
      `\n   Puede orientarte con: ${matches.join(" · ")}`;
  }

  return line;
}

export function buildHelpchatResourceResponseV1({
  associations = [],
  resolvedNeeds = [],
  effectiveProvince = null,
  resolvedProvince = null,
  localCount = 0,
  fallbackType = null,
} = {}) {
  const resources =
    Array.isArray(associations)
      ? associations
      : [];

  const needNames =
    resolvedNeedNames(
      resolvedNeeds
    );

  const resolvedNeedText =
    needNames.length > 0
      ? needNames.join(", ")
      : "la situación que nos has contado";

  if (resources.length === 0) {
    return (
      `He identificado tu consulta como **${resolvedNeedText}**, ` +
      `pero no he encontrado asociaciones en el catálogo disponible ` +
      `para **${effectiveProvince || "la provincia indicada"}** ` +
      `ni recursos nacionales registrados con esta categoría.`
    );
  }

  let introduction;

  if (Number(localCount) > 0) {
    const visibleCount =
      resources.length;

    const optionWord =
      visibleCount === 1
        ? "opción"
        : "opciones";

    const relatedWord =
      visibleCount === 1
        ? "relacionada"
        : "relacionadas";

    introduction =
      `He encontrado ${visibleCount} ${optionWord} ` +
      `${relatedWord} ` +
      `con **${resolvedNeedText}** en ` +
      `**${resolvedProvince || effectiveProvince || "la zona indicada"}**.`;
  } else if (
    fallbackType ===
    "neighbor_province"
  ) {
    introduction =
      `No he encontrado opciones registradas en ` +
      `**${effectiveProvince || "la provincia indicada"}**, ` +
      `pero sí recursos relacionados con **${resolvedNeedText}** ` +
      `en provincias limítrofes disponibles en el catálogo.`;
  } else if (
    fallbackType ===
    "national"
  ) {
    introduction =
      `No he encontrado opciones registradas en ` +
      `**${effectiveProvince || "la provincia indicada"}**, ` +
      `pero sí recursos de ámbito nacional relacionados con ` +
      `**${resolvedNeedText}**.`;
  } else {
    introduction =
      `He encontrado recursos relacionados con ` +
      `**${resolvedNeedText}**.`;
  }

  const hasMultiTagResource =
    resources.some(
      association =>
        associationNeedNames(
          association
        ).length > 1
    );

  const showNeedMatches =
    needNames.length > 1 ||
    hasMultiTagResource;

  const lines =
    resources.map(
      (association, index) =>
        buildResourceLine({
          association,
          index,
          showNeedMatches,
        })
    );

  return (
    `${introduction}\n\n` +
    lines.join("\n")
  );
}
