# Development & build commands

Commands and tooling rules documented by the project's operating rules.
Only these are recorded here; the actual build/serve toolchain commands
(docker compose, uvicorn, npm, ...) are NOT captured in this memory —
check the repo before assuming them.

- OpenSpec is supplied by the external agent platform; invoke it as `openspec`.
  Never install OpenSpec into the repository.
- Before editing code for a change:
  `openspec instructions apply --change "<change>" --json`.
- Repository exploration: targeted, narrow inspection of source/text files.
  Avoid broad scans: `grep -R`, `ls -R`.
