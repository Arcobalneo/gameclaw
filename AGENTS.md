# AGENTS.md - gameclaw repo rules

This repository is a GameClaw **distribution monorepo**.

It contains:
- the `gameclaw` skill
- a multi-game catalog
- game source folders under `games/`
- release automation for shipping binary CLI builds

## Mandatory change protocol for broad modifications

For any **large-scope change** (new game onboarding, catalog redesign, release workflow changes, installer flow changes, repo restructuring, shared tooling changes, docs restructuring, or anything that touches multiple files / subsystems), follow this order:

1. **Write a checklist-style plan document first**
   - Put it under `docs/plans/`
   - State goal, scope, assumptions, risks, and a concrete checklist
2. **Then make the code / catalog / workflow changes**
3. **Then update documentation immediately**
   - Keep user-facing and maintainer-facing docs in sync with reality
4. **Then review diff / test / validate**
5. **Only then create the git commit**

Do not skip this order unless the user explicitly asks you to, and if that happens, note the exception in the plan or commit message.

## Why this rule exists

This preserves:
- pre-change context
- traceability of agent operations
- clearer post-hoc review
- cleaner handoff between different agents / maintainers

## Design authority document (mandatory)

Before designing any new game, changing a game's core loop, adding encounters, adjusting progression, rewriting feedback text, changing evaluation/debugging output, or altering agent-facing interaction structure, you must read:

- `docs/references/ai-native-game-design-rules.md`

This is the **only design-rules reference document** in this repository.

Use it as the primary authority for:
- agent-facing interaction design
- action-space shaping
- feedback density and token tradeoffs
- failure/retry/memory design
- benchmark vs. story mode decisions
- observability / evaluation / recovery / safety boundaries

Do not treat deleted or older parallel reference docs as still authoritative.
If future design principles need refinement, update that single document instead of creating a competing design canon.

## Coding and repo conventions

### 1. Keep the monorepo layered

- Root level = skill, catalog, docs, workflows, shared scripts
- `games/<game-id>/` = one game's code, tests, docs, packaging

Do not scatter one game's implementation across multiple unrelated root folders.

### 2. Prefer stable repo-level entrypoints

- build via `scripts/build-game.sh <game-id>`
- test via `scripts/test-game.sh <game-id>`
- player discovery via `catalog/games.json`

A game can have internal scripts, but repo automation should still have stable top-level entrypoints.

### 3. Update docs in the same change set

If you change any of these, update docs before commit:
- repo layout
- build flow
- release asset names
- catalog schema
- skill behavior
- game onboarding process

### 4. Be honest about binary security posture

Say:
- binaries reduce casual source visibility
- binaries do not guarantee perfect anti-reversing

Do **not** claim impossible-to-reverse binaries unless that is actually true and documented.

### 5. Validate real artifacts when packaging changes

If you change packaging or release flow:
- run tests
- build the real binary/archive when possible
- prefer validating the compiled artifact, not only source execution

## Minimum expectations before commit

For large changes, do not skip:
- a written plan
- doc updates
- a validation summary
- a clean explanation of what changed

## Suggested layout

- `docs/plans/` — checklist plans for non-trivial changes
- `catalog/` — player-facing game inventory metadata
- `games/` — source trees for individual games
- `scripts/` — repo-level build/test helpers
- `SKILL.md` — user-facing skill behavior

Keep process docs lightweight, but keep them current.
