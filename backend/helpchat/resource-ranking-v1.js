function cleanString(value) {
  const text =
    String(value ?? "").trim();

  return text || null;
}

function scopePriority(
  association
) {
  switch (
    cleanString(
      association?.resultScope
    )
  ) {
    case "local":
      return 0;

    case "neighbor_province":
      return 1;

    case "national":
      return 2;

    default:
      return 3;
  }
}

function directContactCount(
  association
) {
  return [
    association?.phone,
    association?.email,
    association?.website,
  ].filter(
    value =>
      cleanString(value)
  ).length;
}

function hasAddress(
  association
) {
  return Boolean(
    cleanString(
      association?.address
    )
  );
}

function stableIdentity(
  association
) {
  const id =
    cleanString(
      association?.id
    );

  if (id) {
    return `0:${id.padStart(
      20,
      "0"
    )}`;
  }

  return (
    "1:" +
    String(
      association?.name ?? ""
    )
      .trim()
      .toLocaleUpperCase(
        "es-ES"
      )
  );
}

/*
 * Ranking V1 deliberadamente conservador.
 *
 * No intenta volver a decidir la necesidad:
 * los candidatos ya han sido recuperados
 * para un tag concreto.
 *
 * Prioridades:
 * 1. territorio:
 *    local > limítrofe > nacional;
 * 2. facilidad de contacto:
 *    algún canal directo > ninguno;
 * 3. entre recursos contactables,
 *    más canales directos primero;
 * 4. una dirección aporta utilidad
 *    cuando no hay otros desempates;
 * 5. identidad estable para que
 *    el orden sea determinista.
 *
 * Un recurso sin teléfono/email/web
 * NUNCA se excluye por ese motivo.
 */
export function compareHelpchatResourcesV1(
  left,
  right
) {
  const scopeDifference =
    scopePriority(left) -
    scopePriority(right);

  if (scopeDifference !== 0) {
    return scopeDifference;
  }

  const leftContacts =
    directContactCount(left);

  const rightContacts =
    directContactCount(right);

  const contactabilityDifference =
    Number(
      rightContacts > 0
    ) -
    Number(
      leftContacts > 0
    );

  if (
    contactabilityDifference !== 0
  ) {
    return contactabilityDifference;
  }

  if (
    leftContacts !==
    rightContacts
  ) {
    return (
      rightContacts -
      leftContacts
    );
  }

  const addressDifference =
    Number(
      hasAddress(right)
    ) -
    Number(
      hasAddress(left)
    );

  if (addressDifference !== 0) {
    return addressDifference;
  }

  return stableIdentity(left)
    .localeCompare(
      stableIdentity(right),
      "es"
    );
}

export function rankHelpchatResourcesV1(
  associations = []
) {
  if (!Array.isArray(associations)) {
    return [];
  }

  return [
    ...associations,
  ].sort(
    compareHelpchatResourcesV1
  );
}
