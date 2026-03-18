# Agent coding standards

This document complements `AGENTS.md`.

## Primary workflow rule

For large changes, always follow:

1. plan
2. change
3. docs
4. validate
5. commit

Do not skip or reorder this without an explicit reason documented in the plan.

## Repo-wide conventions

### 1. Keep player distribution and source maintenance separate

- Player-facing answers should point to release binaries.
- Maintainer-facing docs should point to source folders and build scripts.
- Do not blur the two in ways that make releases ambiguous.
- When publishing the `gameclaw` skill to a registry / Forge, package **only `SKILL.md`** unless the user explicitly wants a different distribution shape.
- Keep `SKILL.md` self-contained so registry-installed copies do not depend on monorepo-local files like `catalog/games.json`.

### 2. Prefer one stable entrypoint per concern

- build via `scripts/build-game.sh`
- test via `scripts/test-game.sh`
- discover games via `catalog/games.json`

A game may have its own internal scripts, but repo-level automation should stay predictable.

### 3. Keep Python dependency ownership layered

- manage repo-level Python lock / sync behavior through the root `pyproject.toml` and `uv.lock`
- keep game-specific metadata, entrypoints, and extras inside each game's own `pyproject.toml`
- do not collapse multiple games into one Python package just to simplify tooling

### 4. Keep game internals self-contained

A game's code, tests, docs, and build notes should live under its own folder.

### 5. Update docs in the same change set

If you change:
- the repo structure
- release asset naming
- onboarding process
- build flow
- catalog schema
- which games are officially shipped
- where a gameplay / operator explanation is supposed to live

then update the relevant docs before commit.

### 5.1 Keep documentation layers distinct

- Root `README.md` / `README.zh-CN.md` are **stable human-facing prompts**: they should mainly teach a human how to prompt their own agent to discover and launch GameClaw games.
- Root `SKILL.md` is the **stable distribution skill**: it should carry the shipped game list, supported platforms, release assets, and short run instructions.
- Each game directory should keep only its own English `README.md` for game-specific mechanics, operator advice, observer / settlement details, and gameplay notes.
- Do **not** keep rewriting the root README prompt every time one game's mechanics shift.

### 6. Be explicit about security posture

Use language like:
- binary releases reduce casual source visibility
- binaries do not guarantee perfect anti-reversing

Do not overclaim.

### 7. Validate the real artifact when possible

If the change affects packaging or release flow, test the built binary / archive, not just the source entrypoint.

## Suggested validation checklist

- unit tests pass
- root test/build scripts work
- generated asset names match catalog / docs
- README and docs describe the current reality
