# Testing & smoke verification

- Executed commands with observed results are the only valid verification.
  Visual inspection of code or UI is not verification.
- Minimum verification when applicable:
  - syntax/type checks;
  - focused tests;
  - `git diff --check`.
- After any change, inspect `git diff` and `git diff --name-only`.
- Smoke: exercise the real entrypoint and observe actual output; never assume
  success from reading code or from a completed plan.
- If required verification fails: report BLOCKED unless the approved task
  explicitly authorizes the required repair.
- The agent never claims final PASS; the external controller owns PASS.
