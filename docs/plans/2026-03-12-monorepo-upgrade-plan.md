# 2026-03-12 GameClaw Monorepo Upgrade Plan

## Goal

Upgrade the `gameclaw` repository into a single GitHub-facing monorepo that includes:

- the `gameclaw` skill itself
- one or more games under separate source folders
- a release workflow that builds per-game binaries from source
- agent/maintainer operating rules and documentation

The first integrated game will be `lobster-cli-roguelike`.

## Checklist

- [x] Inspect current `gameclaw` repo contents and source game repo contents
- [x] Define target monorepo layout (`skill`, `games`, `catalog`, `scripts`, `.github`, `docs`)
- [x] Copy/integrate the first game source into the monorepo under a dedicated game folder
- [x] Add root-level README and repo docs describing the distribution model
- [x] Refine `SKILL.md` to match the new monorepo + GitHub Releases flow
- [x] Add shared release/build scripts for per-game binary packaging
- [x] Add GitHub Actions workflow for tagged binary releases
- [x] Add agent/maintainer rules and coding/repo conventions docs
- [x] Validate the integrated game from its new location (tests + local Linux binary build)
- [x] Review diffs and create a git commit in the `gameclaw` repo

## Guardrails

- Keep the source tree open and auditable.
- Prefer binary releases for player downloads.
- Do not claim binaries are impossible to reverse engineer.
- Preserve the plan -> change -> docs -> validate -> commit order.

## Validation notes

- Root test entrypoint passed: `./scripts/test-game.sh lobster-cli-roguelike`
- Root build entrypoint passed: `./scripts/build-game.sh lobster-cli-roguelike`
- Compiled Linux binary smoke test passed from `games/lobster-cli-roguelike/build/nuitka/lobster-cli-roguelike`
