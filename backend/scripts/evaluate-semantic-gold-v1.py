#!/usr/bin/env python3

from pathlib import Path
import argparse
import json
import unicodedata


def norm(value):
    value = str(value or "")
    value = unicodedata.normalize(
        "NFD",
        value
    )
    value = "".join(
        ch
        for ch in value
        if unicodedata.category(ch)
        != "Mn"
    )
    return " ".join(
        value.lower().split()
    )


def keys(rows):
    return {
        row[0]
        for row in rows or []
    }


def check_dimension(
    case_id,
    dimension,
    expected,
    actual,
    failures,
):
    actual_keys = keys(actual)

    if expected.get(
        "must_be_empty"
    ):
        if actual_keys:
            failures.append(
                (
                    case_id,
                    dimension,
                    "must_be_empty",
                    sorted(actual_keys),
                )
            )

    for key in expected.get(
        "must_include",
        []
    ):
        if key not in actual_keys:
            failures.append(
                (
                    case_id,
                    dimension,
                    f"missing:{key}",
                    sorted(actual_keys),
                )
            )

    any_keys = expected.get(
        "must_include_any",
        []
    )

    if (
        any_keys
        and not (
            actual_keys
            & set(any_keys)
        )
    ):
        failures.append(
            (
                case_id,
                dimension,
                "missing_any",
                sorted(actual_keys),
            )
        )

    for key in expected.get(
        "must_not_include",
        []
    ):
        if key in actual_keys:
            failures.append(
                (
                    case_id,
                    dimension,
                    f"forbidden:{key}",
                    sorted(actual_keys),
                )
            )


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--gold",
        default=(
            "data/curation/semantic/gold/"
            "euskadi-semantic-gold-v1.json"
        ),
    )

    parser.add_argument(
        "--report",
        required=True,
    )

    args = parser.parse_args()

    gold = json.loads(
        Path(args.gold).read_text(
            encoding="utf-8"
        )
    )

    report = json.loads(
        Path(args.report).read_text(
            encoding="utf-8"
        )
    )

    results = {
        row["candidate_id"]:
            row
        for row in report["results"]
        if row.get("status") == "valid"
    }

    failures = []
    discovery_failures = []

    assertions = 0
    discovery_assertions = 0

    for case in gold["cases"]:
        case_id = case[
            "candidate_id"
        ]

        row = results.get(
            case_id
        )

        if not row:
            failures.append(
                (
                    case_id,
                    "record",
                    "missing_valid_result",
                    None,
                )
            )
            continue

        result = row["result"]
        expected = case[
            "assertions"
        ]

        relevance = expected.get(
            "relevance"
        )

        if relevance:
            assertions += 1

            allowed = set(
                relevance.get(
                    "one_of",
                    []
                )
            )

            actual = (
                result
                .get(
                    "relevance",
                    [None]
                )[0]
            )

            if (
                allowed
                and actual
                not in allowed
            ):
                failures.append(
                    (
                        case_id,
                        "relevance",
                        f"expected_one_of:{sorted(allowed)}",
                        actual,
                    )
                )

        for dimension in (
            "needs",
            "populations",
            "functions",
            "activities",
        ):
            rules = expected.get(
                dimension
            )

            if not rules:
                continue

            assertions += (
                bool(
                    rules.get(
                        "must_be_empty"
                    )
                )
                + len(
                    rules.get(
                        "must_include",
                        []
                    )
                )
                + bool(
                    rules.get(
                        "must_include_any"
                    )
                )
                + len(
                    rules.get(
                        "must_not_include",
                        []
                    )
                )
            )

            check_dimension(
                case_id,
                dimension,
                rules,
                result.get(
                    dimension,
                    []
                ),
                failures,
            )

        suggested_rules = (
            expected.get(
                "suggested"
            )
        )

        if suggested_rules:
            suggestions = (
                result.get(
                    "suggested",
                    []
                )
            )

            labels = [
                norm(row[1])
                for row in suggestions
                if len(row) > 1
            ]

            for fragment in (
                suggested_rules.get(
                    "must_include_label_contains",
                    []
                )
            ):
                discovery_assertions += 1

                target = norm(
                    fragment
                )

                if not any(
                    target in label
                    for label in labels
                ):
                    discovery_failures.append(
                        (
                            case_id,
                            "suggested",
                            f"missing_label:{fragment}",
                            labels,
                        )
                    )

            if suggested_rules.get(
                "must_not_duplicate_canonical_need"
            ):
                assertions += 1

                canonical_need_keys = keys(
                    result.get(
                        "needs",
                        []
                    )
                )

                duplicate = False

                for suggestion in suggestions:
                    if (
                        len(suggestion) < 2
                        or suggestion[0]
                        != "need"
                    ):
                        continue

                    label = norm(
                        suggestion[1]
                    )

                    if (
                        "ALZHEIMER"
                        in canonical_need_keys
                        and "alzheimer"
                        in label
                    ):
                        duplicate = True

                if duplicate:
                    failures.append(
                        (
                            case_id,
                            "suggested",
                            "duplicates_canonical_need",
                            labels,
                        )
                    )

    passed = (
        assertions
        - len(failures)
    )

    discovery_passed = (
        discovery_assertions
        - len(discovery_failures)
    )

    print(
        "GOLD_VERSION=",
        gold["gold_version"]
    )

    print(
        "CASES=",
        len(gold["cases"])
    )

    print()

    print(
        "HARD_ASSERTIONS=",
        assertions
    )

    print(
        "HARD_PASS=",
        passed
    )

    print(
        "HARD_FAIL=",
        len(failures)
    )

    print()

    for failure in failures:
        print(
            "HARD_FAIL",
            "|",
            failure[0],
            "|",
            failure[1],
            "|",
            failure[2],
            "|",
            failure[3],
        )

    print()

    print(
        "DISCOVERY_ASSERTIONS=",
        discovery_assertions
    )

    print(
        "DISCOVERY_PASS=",
        discovery_passed
    )

    print(
        "DISCOVERY_FAIL=",
        len(discovery_failures)
    )

    print()

    for failure in discovery_failures:
        print(
            "DISCOVERY_FAIL",
            "|",
            failure[0],
            "|",
            failure[1],
            "|",
            failure[2],
            "|",
            failure[3],
        )

    print()

    if failures:
        print(
            "GOLD_HARD_RESULT=FAIL"
        )
    else:
        print(
            "GOLD_HARD_RESULT=PASS"
        )

    if discovery_failures:
        print(
            "GOLD_DISCOVERY_RESULT=PARTIAL"
        )
    else:
        print(
            "GOLD_DISCOVERY_RESULT=PASS"
        )


if __name__ == "__main__":
    main()
