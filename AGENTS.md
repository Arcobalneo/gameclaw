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

Before designing any new game, changing a game's core loop, adding encounters, adjusting progression, rewriting feedback text, changing memory guidance or safety boundaries, or altering agent-facing interaction structure, you must read:

- `docs/references/ai-native-game-design-rules.md`

This is the **only design-rules reference document** in this repository.

Use it as the primary authority for:
- agent-facing interaction design
- action-space shaping
- feedback density and token tradeoffs
- failure/retry/memory design
- gameplay-first decisions
- recovery / readability / safety boundaries

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
- which games are officially shipped
- where a game's gameplay / operator documentation is supposed to live

### 3.1 Keep documentation layers distinct

- Root `README.md` / `README.zh-CN.md` are stable, human-facing prompts: they should mainly teach a person how to prompt their own agent to discover and launch GameClaw games.
- Root `SKILL.md` is the stable distribution skill: keep the game list, supported platforms, release assets, and short launch instructions there.
- Each game directory should keep only its own English `README.md` for game-specific mechanics, operator advice, observer / settlement behavior, and gameplay detail.
- Do not repeatedly push single-game gameplay churn back into the root README prompt layer.

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

### 6. New GameClaw games should expose a live local observer page by default

For newly designed / newly implemented GameClaw games, treat this as a default cross-game requirement unless the user explicitly overrides it:

- when a run starts, the game should auto-detect the first free localhost port starting from `8000`
- the game should start a local HTML observer page on that port for humans to watch the agent player's progress in real time
- the CLI remains the canonical control surface; the HTML page is for observation, not a browser-only replacement UI
- when the run ends, the observer server should stop so the port is no longer occupied
- the final page should be preserved as a static settlement / recap HTML artifact, continuing the existing report tradition
- the runtime should print the local observer URL clearly so a human can open it during play
- if the observer page cannot start, fail honestly or degrade explicitly; do not silently pretend the live observer exists

### 7. If the coding agent is unavailable, use a strict single-agent fallback loop

If Codex / ACP is clearly unavailable but the user still wants the GameClaw task completed, do not pretend the delegation happened. Fall back honestly and keep the process tight:

- still follow the same order: `plan -> implement -> docs -> validate -> commit`
- prefer repo-level validation first: `./scripts/test-game.sh <game-id>` and `./scripts/build-game.sh <game-id>`
- when packaging or observer behavior changed, validate both the source run and the built binary / archive, not just one of them
- for observer checks, verify all three things explicitly: the live localhost page really responds, the runtime server really stops at run end, and a static HTML settlement page is really written
- if local HTTP proxy settings can interfere with localhost checks, bypass them explicitly instead of treating proxy-caused 502 / connection issues as game bugs
- "real playtest" means at least one genuine CLI run through the actual game entrypoint; helper search / simulation / scripted reasoning may help derive a stable route, but final acceptance must still be replayed through the real CLI or built binary
- only after that should you commit, tag, push, and confirm the GitHub release / workflow result

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
