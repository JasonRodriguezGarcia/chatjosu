import {
  rankHelpchatResourcesV1,
} from "./resource-ranking-v1.js";

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

function normalizeClauseText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

function isGenericDependentClause(
  value
) {
  const text =
    normalizeClauseText(
      value
    );

  if (!text) {
    return true;
  }

  return [
    /^necesito (?:ayuda|orientacion|apoyo|asesoramiento|seguimiento)$/,
    /^necesitamos (?:ayuda|orientacion|apoyo|asesoramiento|seguimiento)$/,
    /^busco (?:ayuda|orientacion|apoyo|asesoramiento|seguimiento)$/,
    /^buscamos (?:ayuda|orientacion|apoyo|asesoramiento|seguimiento)$/,
    /^quiero (?:ayuda|orientacion|apoyo|asesoramiento|seguimiento)$/,
    /^queremos (?:ayuda|orientacion|apoyo|asesoramiento|seguimiento)$/,
    /^necesito que me orienten$/,
    /^necesitamos que nos orienten$/,
  ].some(
    (pattern) =>
      pattern.test(text)
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

  const independentClauses =
    clauses.filter(
      (clause) =>
        !isGenericDependentClause(
          clause
        )
    );

  if (
    independentClauses.length === 0
  ) {
    return resolved;
  }

  const settled =
    await Promise.allSettled(
      independentClauses.map(
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

function appendUniqueMatch(
  target,
  source,
) {
  const need =
    source?.matchedNeed ??
    null;

  const tagId =
    source?.matchedTagId ??
    null;

  if (
    need &&
    !target.matchedNeeds.includes(
      need
    )
  ) {
    target.matchedNeeds.push(
      need
    );
  }

  if (
    tagId !== null &&
    !target.matchedTagIds.includes(
      tagId
    )
  ) {
    target.matchedTagIds.push(
      tagId
    );
  }
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

  const associationById =
    new Map();

  const associationByContact =
    new Map();

  const associations = [];

  let localCount = 0;
  let neighborCount = 0;
  let nationalCount = 0;

  /*
   * Cada necesidad conserva su propio ranking.
   *
   * Después intercalamos los grupos para impedir
   * que la primera necesidad monopolice el límite.
   *
   * A1 A2 A3...
   * B1 B2 B3...
   *
   * => A1 B1 A2 B2...
   *
   * Si un grupo se agota, los demás utilizan
   * las plazas restantes.
   */
  const rankedGroups =
    searchResults.map(
      (searchResult, index) => {
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

        const enriched =
          (
            searchResult?.associations ??
            []
          ).map(
            association => {
              const matchedNeed =
                need?.descripcion ??
                null;

              const matchedTagId =
                need?.tag_id ??
                null;

              return {
                ...association,
                matchedNeed,
                matchedTagId,
                matchedNeeds:
                  matchedNeed
                    ? [
                        matchedNeed,
                      ]
                    : [],
                matchedTagIds:
                  matchedTagId !==
                    null &&
                  matchedTagId !==
                    undefined
                    ? [
                        matchedTagId,
                      ]
                    : [],
              };
            }
          );

        return (
          rankHelpchatResourcesV1(
            enriched
          )
        );
      }
    );

  const cursors =
    rankedGroups.map(
      () => 0
    );

  while (
    associations.length < limit
  ) {
    let progressed = false;

    for (
      let groupIndex = 0;
      groupIndex <
        rankedGroups.length;
      groupIndex += 1
    ) {
      const group =
        rankedGroups[groupIndex];

      while (
        cursors[groupIndex] <
        group.length
      ) {
        const association =
          group[
            cursors[groupIndex]
          ];

        cursors[groupIndex] += 1;

        const id =
          String(
            association.id
          );

        const key =
          contactKey(
            association
          );

        const existing =
          associationById.get(id) ||
          (
            key
              ? associationByContact.get(
                  key
                )
              : null
          );

        if (existing) {
          appendUniqueMatch(
            existing,
            association
          );

          continue;
        }

        seenIds.add(id);

        associationById.set(
          id,
          association
        );

        if (key) {
          seenContacts.add(key);

          associationByContact.set(
            key,
            association
          );
        }

        associations.push(
          association
        );

        progressed = true;

        break;
      }

      if (
        associations.length >=
        limit
      ) {
        break;
      }
    }

    if (!progressed) {
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
