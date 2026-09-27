import test from "node:test";
import assert from "node:assert/strict";

import {
    canonicalizeHelpchatLocation,
    createProvinceResolver,
    projectProvinceCatalog,
    publicProvinceLabel,
} from "../helpchat/territory-contract-v1.js";

const provinces = [
    {
        province_key: "A CORUNA",
        name: "Coruña, A",
    },
    {
        province_key: "VIZCAYA",
        name: "Bizkaia",
    },
    {
        province_key: "GUIPUZCOA",
        name: "Gipuzkoa",
    },
    {
        province_key: "LA RIOJA",
        name: "Rioja, La",
    },
    {
        province_key: "LAS PALMAS",
        name: "Palmas, Las",
    },
];

test(
    "public labels invert only required INE names",
    () => {
        assert.equal(
            publicProvinceLabel(
                "Coruña, A"
            ),
            "A Coruña"
        );

        assert.equal(
            publicProvinceLabel(
                "Rioja, La"
            ),
            "La Rioja"
        );

        assert.equal(
            publicProvinceLabel(
                "Palmas, Las"
            ),
            "Las Palmas"
        );

        assert.equal(
            publicProvinceLabel(
                "Bizkaia"
            ),
            "Bizkaia"
        );
    }
);

test(
    "resolver keeps canonical province identity",
    () => {
        const resolve =
            createProvinceResolver(
                provinces
            );

        for (
            const input of [
                "Bizkaia",
                "Vizcaya",
            ]
        ) {
            assert.deepEqual(
                resolve(input),
                {
                    provinceKey:
                        "VIZCAYA",
                    name:
                        "Bizkaia",
                    label:
                        "Bizkaia",
                }
            );
        }

        for (
            const input of [
                "A Coruña",
                "La Coruña",
                "Coruña, A",
            ]
        ) {
            assert.deepEqual(
                resolve(input),
                {
                    provinceKey:
                        "A CORUNA",
                    name:
                        "Coruña, A",
                    label:
                        "A Coruña",
                }
            );
        }
    }
);

test(
    "province catalog exposes only canonical identity and public label",
    () => {
        assert.deepEqual(
            projectProvinceCatalog(
                provinces
            ),
            [
                {
                    provinceKey:
                        "A CORUNA",
                    label:
                        "A Coruña",
                },
                {
                    provinceKey:
                        "VIZCAYA",
                    label:
                        "Bizkaia",
                },
                {
                    provinceKey:
                        "GUIPUZCOA",
                    label:
                        "Gipuzkoa",
                },
                {
                    provinceKey:
                        "LA RIOJA",
                    label:
                        "La Rioja",
                },
                {
                    provinceKey:
                        "LAS PALMAS",
                    label:
                        "Las Palmas",
                },
            ]
        );
    }
);

test(
    "location contract canonicalizes CF province aliases",
    () => {
        const resolve =
            createProvinceResolver(
                provinces
            );

        for (
            const province of [
                "Vizcaya",
                "Bizkaia",
            ]
        ) {
            const vizcaya =
                canonicalizeHelpchatLocation({
                    location: {
                        country: "ES",
                        province,
                        municipality:
                            "Bilbao",
                        source: "ip",
                        confidence:
                            "coarse",
                    },
                    provinceResolver:
                        resolve,
                });

            assert.deepEqual(
                vizcaya,
                {
                    country: "ES",
                    provinceKey:
                        "VIZCAYA",
                    province:
                        "Bizkaia",
                    municipality:
                        "Bilbao",
                    source: "ip",
                    confidence:
                        "coarse",
                }
            );
        }

        for (
            const province of [
                "A Coruña",
                "La Coruña",
                "Coruña, A",
            ]
        ) {
            const result =
                canonicalizeHelpchatLocation({
                    location: {
                        country: "ES",
                        province,
                        municipality:
                            "A Coruña",
                        source: "ip",
                        confidence:
                            "coarse",
                    },
                    provinceResolver:
                        resolve,
                });

            assert.equal(
                result.provinceKey,
                "A CORUNA"
            );

            assert.equal(
                result.province,
                "A Coruña"
            );
        }

        const coruna =
            canonicalizeHelpchatLocation({
                location: {
                    country: "ES",
                    province:
                        "La Coruña",
                    municipality:
                        "A Coruña",
                    source: "ip",
                    confidence:
                        "coarse",
                },
                provinceResolver:
                    resolve,
            });

        assert.equal(
            coruna.provinceKey,
            "A CORUNA"
        );

        assert.equal(
            coruna.province,
            "A Coruña"
        );
    }
);
