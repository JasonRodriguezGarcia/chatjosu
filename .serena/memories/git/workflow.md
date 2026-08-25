# Git discipline & operational workflow

- Sources of truth: executable verification, repository state, and controller
  gates. Agent reasoning or visual inspection is never final proof.
- Non-trivial change workflow:
  1. Inspect the real repository state before planning.
  2. Verify every intended target file exists.
  3. Create and complete the change plan with OpenSpec.
  4. No production/code file changes during planning.
  5. Load the OpenSpec apply workflow before editing code.
  6. Apply only the approved scope.
  7. Run the approved verification commands.
  8. Inspect the resulting Git diff.
  9. Confirm modified files match the approved scope.
  10. Stop before claiming final authority.
- If the requested change cannot be completed within the approved scope,
  report BLOCKED.
- Final authority: the coding agent does not own final PASS, Git persistence,
  or publication; the external controller owns PASS.
