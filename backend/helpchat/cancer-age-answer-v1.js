function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .trim();
}

export function interpretCancerAgeAnswerV1(
  inputMessage,
) {
  const text =
    normalizeText(inputMessage);

  if (!text) {
    return {
      status: "unresolved",
      age: null,
      resolvedNeeds: [],
    };
  }

  const match =
    text.match(
      /(?:^|\b)(\d{1,3})(?:\s*anos?)?(?:\b|$)/,
    );

  if (!match) {
    return {
      status: "unresolved",
      age: null,
      resolvedNeeds: [],
    };
  }

  const age =
    Number(match[1]);

  if (
    !Number.isInteger(age) ||
    age < 0 ||
    age > 120
  ) {
    return {
      status: "unresolved",
      age: null,
      resolvedNeeds: [],
    };
  }

  if (age < 18) {
    return {
      status: "resolved",
      age,
      resolvedNeeds: [
        {
          tag_id: 10,
          descripcion:
            "CÁNCER INFANTIL",
        },
      ],
    };
  }

  return {
    status: "resolved",
    age,
    resolvedNeeds: [
      {
        tag_id: 9,
        descripcion:
          "CÁNCER",
      },
    ],
  };
}
