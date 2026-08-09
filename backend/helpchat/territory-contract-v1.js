function normalizeTerritoryText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLocaleLowerCase("es-ES")
        .replace(/[^\p{L}\p{N}/, ]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function publicProvinceLabel(value) {
    const provinceKey =
        value &&
        typeof value === "object"
            ? String(
                value.province_key || ""
            ).trim()
            : "";

    const name =
        value &&
        typeof value === "object"
            ? String(
                value.name || ""
            ).trim()
            : String(
                value || ""
            ).trim();

    const byKey = {
        "A CORUNA": "A Coruña",
        "LA RIOJA": "La Rioja",
        "LAS PALMAS": "Las Palmas",
    };

    if (
        provinceKey &&
        byKey[provinceKey]
    ) {
        return byKey[
            provinceKey
        ];
    }

    const byName = {
        "Coruña, A": "A Coruña",
        "Rioja, La": "La Rioja",
        "Palmas, Las": "Las Palmas",
    };

    return (
        byName[name] ||
        name ||
        null
    );
}

function aliasesForProvince(province) {
    const aliases = new Set();

    const add = (value) => {
        const normalized =
            normalizeTerritoryText(value);

        if (!normalized) {
            return;
        }

        aliases.add(normalized);

        for (const part of normalized.split("/")) {
            if (part.trim()) {
                aliases.add(
                    part.trim()
                );
            }
        }

        if (normalized.includes(",")) {
            const parts =
                normalized
                    .split(",")
                    .map(
                        (part) =>
                            part.trim()
                    )
                    .filter(Boolean);

            if (parts.length === 2) {
                aliases.add(
                    `${parts[1]} ${parts[0]}`
                );
            }
        }
    };

    add(province?.province_key);
    add(province?.name);
    add(
        publicProvinceLabel(
            province?.name
        )
    );

    const legacyAliases = {
        "A CORUNA": [
            "La Coruña",
        ],
        VIZCAYA: [
            "Vizcaya",
            "Bizkaia",
        ],
        GUIPUZCOA: [
            "Guipúzcoa",
            "Gipuzkoa",
        ],
        ALAVA: [
            "Álava",
            "Araba",
        ],
    };

    const provinceKey =
        String(
            province?.province_key || ""
        ).trim();

    for (
        const alias of
        legacyAliases[provinceKey] || []
    ) {
        add(alias);
    }

    return [...aliases];
}

function canonicalProvince(province) {
    if (
        !province ||
        typeof province.province_key !== "string" ||
        typeof province.name !== "string"
    ) {
        return null;
    }

    const provinceKey =
        province.province_key.trim();

    const name =
        province.name.trim();

    if (!provinceKey || !name) {
        return null;
    }

    return {
        provinceKey,
        name,
        label:
            publicProvinceLabel(
                name
            ),
    };
}

export function createProvinceResolver(
    provinces = []
) {
    const aliasMap = new Map();

    for (const province of provinces) {
        const canonical =
            canonicalProvince(
                province
            );

        if (!canonical) {
            continue;
        }

        for (
            const alias of
            aliasesForProvince(
                province
            )
        ) {
            if (!aliasMap.has(alias)) {
                aliasMap.set(
                    alias,
                    canonical
                );
                continue;
            }

            const current =
                aliasMap.get(alias);

            if (
                current &&
                current.provinceKey !==
                    canonical.provinceKey
            ) {
                /*
                 * Alias ambiguo:
                 * nunca adivinar territorio.
                 */
                aliasMap.set(
                    alias,
                    null
                );
            }
        }
    }

    return function resolveProvince(
        value
    ) {
        const normalized =
            normalizeTerritoryText(
                value
            );

        if (!normalized) {
            return null;
        }

        return (
            aliasMap.get(normalized) ||
            null
        );
    };
}

export function projectProvinceCatalog(
    provinces = []
) {
    return provinces
        .map(canonicalProvince)
        .filter(Boolean)
        .map(
            (province) => ({
                provinceKey:
                    province.provinceKey,
                label:
                    province.label,
            })
        );
}

export function canonicalizeHelpchatLocation({
    location,
    provinceResolver,
} = {}) {
    const source =
        location &&
        typeof location === "object" &&
        !Array.isArray(location)
            ? location
            : {};

    const territory =
        typeof provinceResolver === "function"
            ? provinceResolver(
                source.province
            )
            : null;

    if (!territory) {
        return {
            country:
                source.country ||
                null,
            provinceKey:
                null,
            province:
                null,
            municipality:
                source.municipality ||
                null,
            source:
                source.source ||
                "unavailable",
            confidence:
                source.confidence ||
                "none",
        };
    }

    return {
        country: "ES",
        provinceKey:
            territory.provinceKey,
        province:
            territory.label,
        municipality:
            source.municipality ||
            null,
        source:
            source.source ||
            "ip",
        confidence:
            source.confidence ||
            "coarse",
    };
}

export function createTerritoryContractV1(
    provinces = []
) {
    const resolveProvince =
        createProvinceResolver(
            provinces
        );

    const publicProvinces =
        projectProvinceCatalog(
            provinces
        );

    return {
        publicProvinces,
        resolveProvince,
    };
}

