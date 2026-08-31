#!/usr/bin/env python3

from pathlib import Path
from collections import Counter
import argparse
import json


RELEVANCE_NAMES = {
    "D": "direct",
    "S": "supportive",
    "C": "community_activity",
    "I": "incidental",
    "O": "out_of_scope",
    "U": "uncertain",
}


def read_jsonl(path):
    rows = []

    with path.open(
        encoding="utf-8"
    ) as fh:
        for line in fh:
            line = line.strip()

            if line:
                rows.append(
                    json.loads(line)
                )

    return rows


def keys(rows):
    return [
        row[0]
        for row in rows or []
        if row
    ]


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--report",
        required=True,
    )

    parser.add_argument(
        "--sample",
        required=True,
    )

    parser.add_argument(
        "--output",
        required=True,
    )

    args = parser.parse_args()

    report_path = Path(
        args.report
    )

    sample_path = Path(
        args.sample
    )

    output_path = Path(
        args.output
    )

    report = json.loads(
        report_path.read_text(
            encoding="utf-8"
        )
    )

    sample = read_jsonl(
        sample_path
    )

    source_by_id = {
        row["candidate_id"]:
            row
        for row in sample
    }

    valid = [
        row
        for row in report["results"]
        if row.get("status")
        == "valid"
    ]

    failed = [
        row
        for row in report["results"]
        if row.get("status")
        != "valid"
    ]

    relevance = Counter()
    deterministic = Counter()
    cross = Counter()

    needs = Counter()
    populations = Counter()
    functions = Counter()
    activities = Counter()
    organizations = Counter()

    suggestion_dimensions = Counter()
    suggestions = Counter()

    with_needs = 0
    with_populations = 0
    with_functions = 0
    with_activities = 0
    with_suggestions = 0

    strong_disagreements = []
    review_disagreements = []
    suggestion_records = []

    for row in valid:
        candidate_id = row[
            "candidate_id"
        ]

        result = row[
            "result"
        ]

        source = source_by_id.get(
            candidate_id,
            {}
        )

        qwen_code = (
            result.get(
                "relevance",
                [None]
            )[0]
        )

        qwen_name = (
            RELEVANCE_NAMES.get(
                qwen_code,
                qwen_code
            )
        )

        relevance[
            qwen_name
        ] += 1

        det = (
            source.get(
                "deterministic_relevance",
                {}
            )
        )

        det_decision = (
            det.get(
                "decision"
            )
            or "missing"
        )

        deterministic[
            det_decision
        ] += 1

        cross[
            (
                det_decision,
                qwen_name,
            )
        ] += 1

        if (
            det_decision == "drop"
            and qwen_code
            not in {
                "O",
                "I",
            }
        ):
            strong_disagreements.append({
                "candidate_id":
                    candidate_id,

                "name":
                    source.get(
                        "name"
                    ),

                "deterministic":
                    det,

                "qwen_relevance":
                    result.get(
                        "relevance"
                    ),

                "needs":
                    result.get(
                        "needs"
                    ),

                "functions":
                    result.get(
                        "functions"
                    ),

                "suggested":
                    result.get(
                        "suggested"
                    ),
            })

        if (
            det_decision == "review"
            and qwen_code
            in {
                "D",
                "S",
                "O",
            }
        ):
            review_disagreements.append({
                "candidate_id":
                    candidate_id,

                "name":
                    source.get(
                        "name"
                    ),

                "deterministic":
                    det,

                "qwen_relevance":
                    result.get(
                        "relevance"
                    ),

                "needs":
                    result.get(
                        "needs"
                    ),

                "functions":
                    result.get(
                        "functions"
                    ),
            })

        dimension_rows = {
            "needs":
                result.get(
                    "needs",
                    []
                ),

            "populations":
                result.get(
                    "populations",
                    []
                ),

            "functions":
                result.get(
                    "functions",
                    []
                ),

            "activities":
                result.get(
                    "activities",
                    []
                ),
        }

        need_keys = keys(
            dimension_rows[
                "needs"
            ]
        )

        population_keys = keys(
            dimension_rows[
                "populations"
            ]
        )

        function_keys = keys(
            dimension_rows[
                "functions"
            ]
        )

        activity_keys = keys(
            dimension_rows[
                "activities"
            ]
        )

        needs.update(
            need_keys
        )

        populations.update(
            population_keys
        )

        functions.update(
            function_keys
        )

        activities.update(
            activity_keys
        )

        with_needs += bool(
            need_keys
        )

        with_populations += bool(
            population_keys
        )

        with_functions += bool(
            function_keys
        )

        with_activities += bool(
            activity_keys
        )

        org = result.get(
            "organization_type"
        )

        if org:
            organizations[
                org[0]
            ] += 1

        row_suggestions = (
            result.get(
                "suggested",
                []
            )
        )

        if row_suggestions:
            with_suggestions += 1

            suggestion_records.append({
                "candidate_id":
                    candidate_id,

                "name":
                    source.get(
                        "name"
                    ),

                "source_categories":
                    source.get(
                        "source_categories"
                    ),

                "qwen_relevance":
                    result.get(
                        "relevance"
                    ),

                "suggested":
                    row_suggestions,
            })

        for suggestion in (
            row_suggestions
        ):
            if len(
                suggestion
            ) < 2:
                continue

            dimension = (
                suggestion[0]
            )

            label = (
                suggestion[1]
            )

            suggestion_dimensions[
                dimension
            ] += 1

            suggestions[
                (
                    dimension,
                    label,
                )
            ] += 1

    analysis = {
        "format_version": 1,

        "counts": {
            "inferences":
                report.get(
                    "inferences"
                ),

            "valid":
                len(valid),

            "failed":
                len(failed),

            "with_needs":
                with_needs,

            "with_populations":
                with_populations,

            "with_functions":
                with_functions,

            "with_activities":
                with_activities,

            "with_suggestions":
                with_suggestions,

            "strong_relevance_disagreements":
                len(
                    strong_disagreements
                ),

            "review_relevance_disagreements":
                len(
                    review_disagreements
                ),
        },

        "distributions": {
            "qwen_relevance":
                dict(
                    relevance
                ),

            "deterministic_decision":
                dict(
                    deterministic
                ),

            "needs":
                dict(
                    needs
                ),

            "populations":
                dict(
                    populations
                ),

            "functions":
                dict(
                    functions
                ),

            "activities":
                dict(
                    activities
                ),

            "organization_types":
                dict(
                    organizations
                ),

            "suggestion_dimensions":
                dict(
                    suggestion_dimensions
                ),
        },

        "relevance_cross":
            [
                {
                    "deterministic":
                        key[0],

                    "qwen":
                        key[1],

                    "count":
                        value,
                }
                for key, value
                in cross.most_common()
            ],

        "top_suggestions":
            [
                {
                    "dimension":
                        key[0],

                    "label":
                        key[1],

                    "count":
                        value,
                }
                for key, value
                in suggestions.most_common(
                    100
                )
            ],

        "strong_relevance_disagreements":
            strong_disagreements,

        "review_relevance_disagreements":
            review_disagreements,

        "suggested_records":
            suggestion_records,

        "failed_records":
            failed,
    }

    output_path.write_text(
        json.dumps(
            analysis,
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )

    print(
        "VALID=",
        len(valid)
    )

    print(
        "FAILED=",
        len(failed)
    )

    print(
        "WITH_NEEDS=",
        with_needs
    )

    print(
        "WITH_POPULATIONS=",
        with_populations
    )

    print(
        "WITH_FUNCTIONS=",
        with_functions
    )

    print(
        "WITH_ACTIVITIES=",
        with_activities
    )

    print(
        "WITH_SUGGESTIONS=",
        with_suggestions
    )

    print(
        "STRONG_RELEVANCE_DISAGREEMENTS=",
        len(
            strong_disagreements
        )
    )

    print(
        "REVIEW_RELEVANCE_DISAGREEMENTS=",
        len(
            review_disagreements
        )
    )

    print()

    print(
        "===== QWEN RELEVANCE ====="
    )

    for key, value in (
        relevance.most_common()
    ):
        print(
            key,
            value
        )

    print()

    print(
        "===== DETERMINISTIC ====="
    )

    for key, value in (
        deterministic.most_common()
    ):
        print(
            key,
            value
        )

    print()

    print(
        "===== RELEVANCE CROSS ====="
    )

    for (
        det,
        qwen,
    ), value in cross.most_common():
        print(
            det,
            "|",
            qwen,
            "|",
            value
        )

    print()

    for title, counter in (
        (
            "NEEDS",
            needs,
        ),
        (
            "POPULATIONS",
            populations,
        ),
        (
            "FUNCTIONS",
            functions,
        ),
        (
            "ACTIVITIES",
            activities,
        ),
        (
            "ORGANIZATION TYPES",
            organizations,
        ),
    ):
        print(
            f"===== TOP {title} ====="
        )

        for key, value in (
            counter.most_common(
                25
            )
        ):
            print(
                key,
                value
            )

        print()

    print(
        "===== TOP SUGGESTIONS ====="
    )

    for (
        dimension,
        label,
    ), value in suggestions.most_common(
        40
    ):
        print(
            dimension,
            "|",
            label,
            "|",
            value
        )

    print()

    print(
        "ANALYSIS_OUTPUT=",
        output_path
    )

    print(
        "SEMANTIC_DISCOVERY_ANALYSIS=PASS"
    )


if __name__ == "__main__":
    main()
