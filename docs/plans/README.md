# Plans

This directory keeps design history for GameClaw.

- **Active plan**: `2026-11-14-v4-web-only-and-leaderboards.md` — web + Web MCP only, leaderboards, v4.0.0.
- **Previous platform change**: `2026-11-14-web-portal-v3.0.0.md` — browser portal + WebMCP (v3.0.0). The CLI it still mentions is retired in v4.
- **Latest game onboarding**: `2026-11-09-shrimp-burger-v2.8.0.md` — 虾堡 / Shrimp Burger (v2.8.0). Previous: `2026-11-04-shrimp-leap-v2.7.0.md` — 虾跃 / Shrimp Leap.
  Shrimp Leap, the tenth game, with deterministic lamp-post physics, growth and
  offline rescue, shipping with catalog version 2.8.0.
- **Archive**: `archive/` contains plans from the v0.x Python era. They are kept
  for traceability only. **They do not describe the current implementation.**
  When a historical plan and the code disagree, the code and `docs/` win.

Rules for new plans:

1. One file per large change, named `YYYY-MM-DD-short-title.md`.
2. State goal, scope, assumptions, risks and a concrete checklist.
3. Write it before the code, and update it if the scope changes.
4. When the change ships and docs are current, move the plan to `archive/`.

Small changes do not need a plan.
