# Agent Operating Rules

## Purpose

This repository is developed with AI coding agents managed by an external
agent platform.

Agents may propose and implement changes, but their reasoning or visual
inspection is never final proof that a change is correct.

Executable verification, repository state, and controller gates are the
source of truth.

## General workflow

For any non-trivial change:

1. Inspect the real repository state before planning.
2. Verify every intended target file exists.
3. Use OpenSpec to create and complete the change plan.
4. Do not modify production/code files during planning.
5. Load the OpenSpec apply workflow before editing code.
6. Apply only the approved scope.
7. Run the approved verification commands.
8. Inspect the resulting Git diff.
9. Confirm modified files match the approved scope.
10. Stop before claiming final authority; the external controller owns PASS.

If required verification fails, report BLOCKED unless the approved task
explicitly authorizes the required repair.

## OpenSpec

OpenSpec is supplied by the external agent platform.

Invoke it as:

    openspec

Do not install OpenSpec into this repository merely to satisfy agent tooling.

For non-trivial implementation work, use the repository OpenSpec workflow.

Planning must be complete before implementation begins.

Before editing code, obtain apply instructions with:

    openspec instructions apply --change "<change>" --json

## Scope

Treat the Task Contract approved file list as a hard boundary.

Do not:

- modify unrelated files;
- expand scope because another approach appears easier;
- refactor unrelated code;
- change architecture unless explicitly required;
- add dependencies unless explicitly approved;
- install packages unless explicitly approved;
- start or stop services unless explicitly required;
- overwrite or revert pre-existing unrelated changes.

Preserve unrelated modified or untracked files.

If the requested change cannot be completed within approved scope, report
BLOCKED.

## Repository exploration

Prefer targeted inspection.

Do not perform broad repository exploration when the Task Contract already
identifies exact implementation targets.

Avoid:

    grep -R
    ls -R

Use narrow shell inspection for source and text files.

## Editing

Before editing:

- confirm the target path;
- read the relevant section;
- confirm it matches the approved OpenSpec plan.

Make the smallest change satisfying the specification.

## Verification

Visual inspection is not verification.

Only executed commands with observed results count as verification.

At minimum, when applicable:

- run syntax/type checks;
- run focused tests;
- run `git diff --check`;
- inspect `git diff`;
- inspect `git diff --name-only`.

## Final authority

The coding agent does not own final PASS, Git persistence, or publication.

Those belong to the external controller.
