# 2026-03-13 GameClaw `uv` Workspace Migration Plan

## Goal

Move the `gameclaw` monorepo to a first-pass `uv`-managed Python workflow so that:

- the repo has one canonical Python dependency management entrypoint
- workspace locking happens at the monorepo root
- per-game package boundaries stay under `games/<game-id>/`
- maintainer build / test / release workflows become more reproducible
- the player-facing product boundary remains unchanged: players still primarily download GitHub Releases binaries

## Why This Migration Exists

Current Python environment management is split across ad-hoc virtualenv creation and per-invocation `pip install` calls inside shell scripts.

That works, but it creates avoidable drift:

- dependency resolution is not locked at the repo level
- repeated local / CI builds have more room for mismatch
- root scripts express packaging setup differently from the game package metadata they rely on
- maintainers do not have one obvious workflow for syncing build / test environments across the whole monorepo

`uv` is a good fit here because it can provide:

- a root workspace for the whole Python monorepo slice
- a lockfile committed at the repo root
- consistent `run` / `sync` behavior for root scripts and CI
- minimal disruption to each game's own `pyproject.toml`

## Scope

This migration covers:

- adding a root `pyproject.toml` for workspace-level Python tooling management
- adding a committed `uv.lock`
- registering shipped Python game packages as workspace members
- updating root test / build entrypoints to run through `uv`
- updating release workflow steps that should now use `uv`
- updating maintainer-facing docs that describe Python dependency setup, testing, building, and release validation

## Explicit Non-Goals

This migration does **not** aim to:

- change the player download path away from GitHub Releases binaries
- require players to install Python before they can play
- collapse all games into one Python package
- move game implementation files out of `games/<game-id>/`
- redesign game runtime dependencies beyond what is required for correct packaging metadata
- force every future script to use `uv` if that would damage a working release boundary

## Current Constraints

- This is a broad repo-level change, so the repo rule requires `plan -> code -> docs -> validate -> commit`.
- The monorepo contains multiple games, but repo-level entrypoints must stay stable.
- GitHub Releases binary distribution remains the product-facing path.
- Packaging claims must stay honest: binaries reduce casual source visibility but do not guarantee perfect anti-reversing.

## Proposed Migration Shape

### 1. Root workspace ownership

Add a root `pyproject.toml` that:

- defines the monorepo's Python workspace
- lists current Python game packages as workspace members
- acts as the canonical home for repo-level dependency locking
- keeps root-level dev tooling lightweight and focused on maintainers

### 2. Preserve per-game package ownership

Keep each game's `pyproject.toml` as the source of truth for:

- package metadata
- entrypoints
- game-specific optional build dependencies

The workspace should unify how those packages are resolved and executed, not erase their boundaries.

### 3. Move root scripts to `uv` first

Update the stable repo entrypoints so maintainers can continue using:

- `./scripts/test-game.sh <game-id>`
- `./scripts/build-game.sh <game-id>`

but have those scripts execute via locked `uv` workspace environments instead of ad-hoc venv + `pip install` setup.

### 4. Update release automation carefully

Where CI currently sets up Python and then calls root build scripts, switch the dependency bootstrapping path to `uv` only if it keeps the release artifact path intact.

The release contract must stay:

- checkout monorepo
- build selected game
- upload `games/<game-id>/dist/*.tar.gz`
- publish those archives as release assets

## Risks

### Risk 1: workspace migration blurs package boundaries

Mitigation:

- keep game package metadata in each game folder
- avoid turning the repo root into the runtime package for shipped games
- keep root scripts addressing one game at a time

### Risk 2: CI release flow regresses while chasing tooling purity

Mitigation:

- preserve existing build artifact paths
- change the dependency bootstrap path, not the archive contract
- validate local build output for at least two games after migration

### Risk 3: `uv` adoption leaks into the player path

Mitigation:

- update docs to distinguish maintainer tooling from player downloads
- explicitly restate that players should use release binaries

### Risk 4: partial migration leaves confusing mixed instructions

Mitigation:

- update root docs and per-game maintainer instructions in the same change set
- document any intentional stop points honestly

## Phases

### Phase 1 — Plan and inspect

- [x] Review current repo structure, scripts, workflow, and Python package boundaries
- [x] Write this migration plan before code changes

### Phase 2 — Workspace migration

- [x] Add root `pyproject.toml` with `uv` workspace configuration
- [x] Generate and commit root `uv.lock`
- [x] Adjust root scripts to execute tests / builds through `uv`
- [x] Keep per-game `pyproject.toml` changes minimal and justified

### Phase 3 — Docs sync

- [x] Update repo-level docs that describe Python setup and release flow
- [x] Update per-game maintainer build instructions where `pip` / venv guidance becomes stale
- [x] Re-state that player-facing binary releases remain unchanged

### Phase 4 — Validation

- [x] Run repo-level test entrypoints for shipped games
- [x] Build at least the two shipped games through the new `uv` path
- [x] Validate release-flow-critical local steps or scripts still match the documented artifact contract
- [x] Summarize any remaining non-migrated edges

## Acceptance Criteria

This migration is acceptable for this round when all of the following are true:

- a root workspace definition exists and is committed
- a root `uv.lock` exists and is committed
- the stable repo entrypoints for test / build work through `uv`
- both shipped games can still be built into release archives through repo-level scripts
- maintainer docs describe the new dependency-management reality accurately
- player-facing docs still point players to GitHub Releases binaries rather than source setup
- any scripts or CI edges intentionally left on the old approach are explicitly called out

## Validation Target

Planned validation for this round:

- `./scripts/test-game.sh lobster-cli-roguelike`
- `./scripts/test-game.sh lobster-cli-tower-defense`
- `./scripts/build-game.sh lobster-cli-roguelike`
- `./scripts/build-game.sh lobster-cli-tower-defense`
- review of `.github/workflows/release.yml` and local release-path assumptions against produced artifacts

## Notes for Review

- The preferred outcome is not “maximum `uv` everywhere”; it is “one honest, stable, reviewable dependency-management path for maintainers”.
- If some CI or release helper detail turns out not to be worth forcing into `uv` in this round, that should be documented as an intentional stop point rather than hidden.


## Validation Notes

- Passed: `UV_BIN=/tmp/gameclaw-uv/bin/uv ./scripts/test-game.sh lobster-cli-roguelike`
- Passed: `UV_BIN=/tmp/gameclaw-uv/bin/uv ./scripts/test-game.sh lobster-cli-tower-defense`
- Passed: `UV_BIN=/tmp/gameclaw-uv/bin/uv ./scripts/build-game.sh lobster-cli-roguelike`
- Passed: `UV_BIN=/tmp/gameclaw-uv/bin/uv ./scripts/build-game.sh lobster-cli-tower-defense`
- Passed: smoke-run of the compiled Linux binaries under each game's staged `dist/<asset-name>/` directory
- Passed: archive content checks for both generated `*.tar.gz` release assets

## Intentional Stop Points

- The migration keeps game-specific `build` extras inside each game's own `pyproject.toml` instead of duplicating them at the repo root.
- The root workspace currently focuses on locked maintainership for test / build / packaging flows; it does not introduce extra shared dev-tool abstraction that the repo does not need yet.
- The release workflow was updated to install and use `uv`, but the player-facing release contract and archive naming were intentionally left unchanged.
- This round validates the Linux local packaging path. macOS arm64 remains covered by the unchanged GitHub Actions matrix rather than local cross-build emulation in this environment.
