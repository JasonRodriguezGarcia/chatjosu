#!/usr/bin/env python3

import argparse
import json
import struct
from pathlib import Path
from zipfile import ZipFile

EXPECTED_CODES = {
    f"{value:02d}"
    for value in range(1, 53)
}

EXPECTED_ISOLATED = {
    "07",
    "35",
    "38",
    "51",
    "52",
}

CNIG_SPECIAL_CODES = {
    "54",
}


def decode_dbf(raw):
    for encoding in (
        "utf-8",
        "cp1252",
        "latin1",
    ):
        try:
            return (
                raw.decode(encoding)
                .rstrip("\x00 ")
                .strip()
            )
        except UnicodeDecodeError:
            pass

    return raw.hex()


def dbf_rows(data):
    if len(data) < 32:
        raise ValueError("DBF demasiado pequeño")

    count = struct.unpack(
        "<I",
        data[4:8],
    )[0]

    header_len = struct.unpack(
        "<H",
        data[8:10],
    )[0]

    record_len = struct.unpack(
        "<H",
        data[10:12],
    )[0]

    fields = []
    pos = 32

    while pos + 32 <= header_len:
        descriptor = data[
            pos:pos + 32
        ]

        if descriptor[0] == 0x0D:
            break

        fields.append(
            (
                decode_dbf(
                    descriptor[0:11]
                ),
                descriptor[16],
            )
        )

        pos += 32

    offset = header_len

    for _ in range(count):
        record = data[
            offset:offset + record_len
        ]

        offset += record_len

        if (
            not record
            or record[0:1] == b"*"
        ):
            continue

        row = {}
        cursor = 1

        for name, length in fields:
            row[name] = decode_dbf(
                record[
                    cursor:cursor + length
                ]
            )

            cursor += length

        yield row


def cnig_code_from_natcode(natcode):
    value = str(natcode or "").strip()

    if len(value) < 6:
        return None

    code = value[4:6]

    if not code.isdigit():
        return None

    return code


def load_catalog(path):
    payload = json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )

    rows = payload.get(
        "territories",
        [],
    )

    by_code = {}

    for row in rows:
        code = str(
            row.get("ine_code", "")
        ).strip()

        key = str(
            row.get(
                "province_key",
                "",
            )
        ).strip()

        if code in by_code:
            raise ValueError(
                f"Código INE duplicado: {code}"
            )

        if (
            code not in EXPECTED_CODES
            or not key
        ):
            raise ValueError(
                f"Territorio inválido: {row}"
            )

        by_code[code] = row

    if set(by_code) != EXPECTED_CODES:
        raise ValueError(
            "El catálogo no contiene "
            "exactamente los códigos 01-52"
        )

    return by_code


def derive_neighbors(zip_path):
    with ZipFile(zip_path) as archive:
        filenames = archive.namelist()

        recinto_dbfs = [
            name
            for name in filenames
            if name.lower().endswith(
                ".dbf"
            )
            and (
                "recintos_provinciales_inspire"
                in name.lower()
            )
        ]

        line_dbfs = [
            name
            for name in filenames
            if name.lower().endswith(
                ".dbf"
            )
            and (
                "/ll_provinciales_inspire_"
                in name.lower()
            )
        ]

        if len(recinto_dbfs) != 2:
            raise ValueError(
                "Se esperaban 2 DBF "
                "de recintos provinciales"
            )

        if len(line_dbfs) != 2:
            raise ValueError(
                "Se esperaban 2 DBF "
                "de límites provinciales"
            )

        name_to_code = {}
        observed_codes = set()

        for filename in recinto_dbfs:
            for row in dbf_rows(
                archive.read(filename)
            ):
                name = row.get(
                    "NAMEUNIT",
                    "",
                ).strip()

                code = (
                    cnig_code_from_natcode(
                        row.get(
                            "NATCODE"
                        )
                    )
                )

                if not name or not code:
                    continue

                observed_codes.add(code)

                if code in CNIG_SPECIAL_CODES:
                    continue

                if code not in EXPECTED_CODES:
                    continue

                previous = name_to_code.get(
                    name
                )

                if (
                    previous is not None
                    and previous != code
                ):
                    raise ValueError(
                        "Nombre CNIG ambiguo: "
                        f"{name}"
                    )

                name_to_code[name] = code

        missing = (
            EXPECTED_CODES
            - observed_codes
        )

        if missing:
            raise ValueError(
                "Faltan códigos CNIG: "
                + ", ".join(
                    sorted(missing)
                )
            )

        edges = set()
        malformed = set()

        for filename in line_dbfs:
            for row in dbf_rows(
                archive.read(filename)
            ):
                boundary = row.get(
                    "NAME_BOUND",
                    "",
                ).strip()

                if not boundary:
                    continue

                parts = [
                    part.strip()
                    for part in boundary.split(
                        "#"
                    )
                ]

                if len(parts) != 2:
                    malformed.add(
                        boundary
                    )
                    continue

                left, right = parts

                left_code = (
                    name_to_code.get(left)
                )

                right_code = (
                    name_to_code.get(right)
                )

                if (
                    not left_code
                    or not right_code
                ):
                    continue

                if left_code == right_code:
                    continue

                edges.add(
                    tuple(
                        sorted(
                            (
                                left_code,
                                right_code,
                            )
                        )
                    )
                )

        if malformed:
            raise ValueError(
                "NAME_BOUND malformados: "
                + repr(
                    sorted(malformed)
                )
            )

        connected = {
            code
            for edge in edges
            for code in edge
        }

        isolated = (
            EXPECTED_CODES
            - connected
        )

        if isolated != EXPECTED_ISOLATED:
            raise ValueError(
                "Territorios aislados "
                "inesperados: "
                + repr(
                    sorted(isolated)
                )
            )

        return edges, observed_codes


def sql_quote(value):
    return (
        "'"
        + str(value).replace(
            "'",
            "''",
        )
        + "'"
    )


def build_sql(
    catalog,
    edges,
    source,
):
    directed = []

    for left, right in sorted(edges):
        directed.append(
            (
                catalog[left][
                    "province_key"
                ],
                catalog[right][
                    "province_key"
                ],
            )
        )

        directed.append(
            (
                catalog[right][
                    "province_key"
                ],
                catalog[left][
                    "province_key"
                ],
            )
        )

    directed.sort()

    values = ",\n".join(
        "    ({}, {}, NULL, {})".format(
            sql_quote(left),
            sql_quote(right),
            sql_quote(source),
        )
        for left, right in directed
    )

    return f"""-- Vecindad provincial terrestre de España.
-- Generado automáticamente a partir de las capas
-- ll_provinciales del producto CNIG/IGN BDDAE.
--
-- No se generan vecinos por proximidad marítima.
-- Por ello quedan sin vecinos terrestres:
-- Illes Balears, Las Palmas, Santa Cruz de Tenerife,
-- Ceuta y Melilla.
--
-- distance_km permanece NULL: la relación expresa
-- frontera administrativa compartida, no distancia.

DELETE FROM copilot_ong.province_neighbors
WHERE source = 'manual_border_v1'
   OR source LIKE 'cnig_bddae_%';

INSERT INTO copilot_ong.province_neighbors (
    province_key,
    neighbor_key,
    distance_km,
    source
)
VALUES
{values}
ON CONFLICT (
    province_key,
    neighbor_key
)
DO UPDATE SET
    distance_km = EXCLUDED.distance_km,
    source = EXCLUDED.source;
"""


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--zip",
        required=True,
        type=Path,
    )

    parser.add_argument(
        "--catalog",
        type=Path,
        default=Path(
            "backend/data/"
            "spain-provinces-ine.json"
        ),
    )

    parser.add_argument(
        "--output",
        type=Path,
        default=Path(
            "db/local/init/"
            "006_province_neighbors_seed.sql"
        ),
    )

    parser.add_argument(
        "--source",
        default=(
            "cnig_bddae_package_"
            "2026-07-28"
        ),
    )

    args = parser.parse_args()

    catalog = load_catalog(
        args.catalog
    )

    edges, observed_codes = (
        derive_neighbors(args.zip)
    )

    sql = build_sql(
        catalog,
        edges,
        args.source,
    )

    args.output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    args.output.write_text(
        sql,
        encoding="utf-8",
    )

    print(
        "CATALOG_CODES="
        + str(len(catalog))
    )

    print(
        "CNIG_CODES_OBSERVED="
        + str(len(observed_codes))
    )

    print(
        "UNDIRECTED_PAIRS="
        + str(len(edges))
    )

    print(
        "DIRECTED_ROWS="
        + str(len(edges) * 2)
    )

    print(
        "ISOLATED_CODES="
        + ",".join(
            sorted(
                EXPECTED_ISOLATED
            )
        )
    )

    print(
        "OUTPUT="
        + str(args.output)
    )

    print(
        "CNIG_NEIGHBOR_BUILD=PASS"
    )


if __name__ == "__main__":
    main()
