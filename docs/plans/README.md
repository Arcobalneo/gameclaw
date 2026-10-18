# Plans

This directory keeps design history for GameClaw.

- **Active plan**: `2026-10-18-v2-cross-platform-normalization.md` — the
  TypeScript/gamekit rewrite that this repository now implements.
- **Archive**: `archive/` contains plans from the v0.x Python era. They are kept
  for traceability only. **They do not describe the current implementation.**
  When a historical plan and the code disagree, the code and `docs/` win.

Rules for new plans:

1. One file per large change, named `YYYY-MM-DD-short-title.md`.
2. State goal, scope, assumptions, risks and a concrete checklist.
3. Write it before the code, and update it if the scope changes.
4. When the change ships and docs are current, move the plan to `archive/`.

Small changes do not need a plan.
