function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function validTag(tag) {
  return Boolean(
    tag &&
    Number.isFinite(Number(tag.tag_id)) &&
    typeof tag.descripcion === "string" &&
    tag.descripcion.trim()
  );
}

function tagKey(tag) {
  return String(
    tag?.tag_id ?? ""
  );
}

export function splitCompoundNeedClauses(
  inputMessage
) {
  const text =
    cleanText(inputMessage);

  if (!text) {
    return [];
  }

  /*
   * Solo abrimos análisis compuesto cuando existe una
   * separación lingüística suficientemente clara.
   *
   * No pretendemos hacer parsing sintáctico aquí.
   * El router sigue siendo dueño de la semántica.
   */
  if (
    !/[.;]|\b(?:y|además|también|pero)\b/i.test(
      text
    )
  ) {
    return [];
  }

  const clauses =
    text
      .split(
        /\s*(?:[.;]+|\b(?:además|también|pero)\b|\by\b)\s*/i
      )
      .map(
        (part) =>
          part.trim()
      )
      .filter(
        (part) =>
          part.length >= 4
      )
      .slice(0, 5);

  return clauses.length >= 2
    ? clauses
    : [];
}

export async function resolveMultipleNeeds({
  inputMessage,
  conversationContext,
  primaryUnderstanding,
  understand,
}) {
  const resolved = [];

  function addNeed(
    tag,
    source = null
  ) {
    if (!validTag(tag)) {
      return;
    }

    if (
      resolved.some(
        (candidate) =>
          tagKey(candidate) ===
          tagKey(tag)
      )
    ) {
      return;
    }

    resolved.push({
      tag_id:
        Number(tag.tag_id),
      descripcion:
        tag.descripcion.trim(),
      source:
        source || null,
    });
  }

  if (
    primaryUnderstanding?.status ===
      "resolved"
  ) {
    const primaryNeeds =
      Array.isArray(
        primaryUnderstanding.resolvedNeeds
      )
        ? primaryUnderstanding.resolvedNeeds
        : [];

    if (
      primaryNeeds.length > 0
    ) {
      for (
        const need
        of primaryNeeds
      ) {
        addNeed(
          need,
          need.source ||
            primaryUnderstanding.provider
        );
      }
    } else {
      addNeed(
        primaryUnderstanding.tag,
        primaryUnderstanding.provider
      );
    }
  }

  /*
   * Si el router ya encontró varias necesidades explícitas,
   * no volvemos a trocear ni reclasificar el mensaje.
   */
  if (resolved.length > 1) {
    return resolved;
  }

  const clauses =
    splitCompoundNeedClauses(
      inputMessage
    );

  if (
    clauses.length < 2 ||
    typeof understand !== "function"
  ) {
    return resolved;
  }

  const settled =
    await Promise.allSettled(
      clauses.map(
        (clause) =>
          understand({
            inputMessage:
              clause,
            conversationContext,
          })
      )
    );

  for (
    const result
    of settled
  ) {
    if (
      result.status !== "fulfilled"
    ) {
      continue;
    }

    const understanding =
      result.value;

    if (
      understanding?.status !==
        "resolved" ||
      understanding.needsClarification ===
        true
    ) {
      continue;
    }

    addNeed(
      understanding.tag,
      understanding.provider
    );
  }

  return resolved;
}

function contactKey(
  association
) {
  const phone =
    String(
      association?.phone ?? ""
    ).trim();

  const website =
    String(
      association?.website ?? ""
    ).trim();

  const province =
    String(
      association?.province_key ?? ""
    ).trim();

  if (
    !province ||
    (!phone && !website)
  ) {
    return null;
  }

  return [
    province,
    String(
      association?.address ?? ""
    ).trim(),
    phone,
    website,
  ].join("|");
}

export function mergeMultiNeedSearchResults({
  resolvedNeeds = [],
  searchResults = [],
  limit = 5,
}) {
  const needByIndex =
    resolvedNeeds;

  const seenIds =
    new Set();

  const seenContacts =
    new Set();

  const associations = [];

  let localCount = 0;
  let neighborCount = 0;
  let nationalCount = 0;

  for (
    let index = 0;
    index < searchResults.length;
    index += 1
  ) {
    const searchResult =
      searchResults[index];

    const need =
      needByIndex[index];

    localCount +=
      Number(
        searchResult?.localCount
      ) || 0;

    neighborCount +=
      Number(
        searchResult?.neighborCount
      ) || 0;

    nationalCount +=
      Number(
        searchResult?.nationalCount
      ) || 0;

    for (
      const association
      of searchResult?.associations ?? []
    ) {
      const id =
        String(
          association.id
        );

      const key =
        contactKey(
          association
        );

      if (
        seenIds.has(id) ||
        (
          key &&
          seenContacts.has(key)
        )
      ) {
        continue;
      }

      seenIds.add(id);

      if (key) {
        seenContacts.add(key);
      }

      associations.push({
        ...association,
        matchedNeed:
          need?.descripcion ??
          null,
        matchedTagId:
          need?.tag_id ??
          null,
      });

      if (
        associations.length >=
        limit
      ) {
        break;
      }
    }

    if (
      associations.length >=
      limit
    ) {
      break;
    }
  }

  let fallbackType =
    null;

  if (
    associations.length > 0 &&
    localCount === 0
  ) {
    if (
      neighborCount > 0
    ) {
      fallbackType =
        "neighbor_province";
    } else if (
      nationalCount > 0
    ) {
      fallbackType =
        "national";
    }
  }

  return {
    associations,
    localCount,
    neighborCount,
    nationalCount,
    fallbackUsed:
      fallbackType !== null,
    fallbackType,
  };
}
