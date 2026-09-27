# Conventions

Change-scope discipline (hard boundaries):

- The Task Contract's approved file list is a hard boundary; do not modify
  unrelated files.
- Do not expand scope because another approach appears easier.
- Do not refactor unrelated code; do not change architecture unless explicitly
  required.
- Do not add dependencies or install packages unless explicitly approved.
- Do not start/stop services unless explicitly required.
- Preserve unrelated modified or untracked files; never overwrite or revert
  pre-existing unrelated changes.
- Make the smallest change satisfying the specification.
- Before editing: confirm the target path, read the relevant section, and
  confirm it matches the approved OpenSpec plan.

Product invariants (details in `mem:core`): the LLM never invents categories,
transitions, or resources; resources come from the authorized Postgres catalog
and render as structured UI components, not AI-generated Markdown.
