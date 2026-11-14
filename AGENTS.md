# AGENTS.md — GameClaw repo rules

This repository is a **GameClaw distribution monorepo**: fifteen agent-and-human
web games, one shared TypeScript runtime, one static portal, one relay.

## Mandatory change protocol for broad modifications

For any **large-scope change** (new game onboarding, engine/contract changes,
release workflow changes, repo restructuring, shared tooling changes, docs
restructuring, or anything touching multiple files / subsystems), follow this
order:

1. **Write a checklist-style plan first**
   - Put it under `docs/plans/`
   - State goal, scope, assumptions, risks, and a concrete checklist
2. **Then make the code / content changes**
3. **Then update documentation immediately**
   - Keep user-facing and maintainer-facing docs in sync with reality
4. **Then review diff / test / validate**
   - `pnpm lint && pnpm check && pnpm test`
   - build the portal when the bundle or runtime behaviour changed
5. **Only then create the git commit**

Do not skip this order unless the user explicitly asks you to. If that happens,
note the exception in the plan or commit message.

Why: this preserves pre-change context, traceability, post-hoc review and clean
handoff between agents and maintainers.

## Design authority document (mandatory)

Before designing a new game, changing a game's core loop, adding encounters,
adjusting progression, rewriting feedback text, changing memory guidance or
safety boundaries, or altering the agent-facing interaction structure, read:

- `docs/references/ai-native-game-design-rules.md`

This is the **only** design-rules reference document in this repository. Update
that single document instead of creating a competing canon.

## Architecture rules

### 1. Two layers, one dependency direction

- `packages/gamekit/` — shared runtime. Knows nothing about any specific game.
- `games/<game-id>/` — state machine, content, tests, README. Knows nothing
  about argv, process exit, save files, HTTP, or HTML.

`games/* → gamekit` only. Never import a game from gamekit or one game from another.

### 2. The play contract is owned by the portal and the relay

Humans and agents share one page. Agents use Web MCP, in-page or through the
relay:

```
list_games / open_game / new_game / get_state / list_actions / act / recap
get_leaderboard / submit_score / set_language
```

A game must not parse `process.argv`, call `process.exit`, or open sockets.
It implements `GameDefinition<S>` from `@gameclaw/gamekit`:

```ts
create / status / actions / act / recap / abort?
```

`recap.score` is the integer a finished win or loss may publish. Ongoing and
aborted runs score 0.

### 3. One action per `act`, one call per turn

`act` returns the log, the complete new state and the next legal actions. Do not
design loops that require the agent to call `status` and `actions` between every
move.

### 4. Determinism is non-negotiable

- Every run stores the four-word sfc32 state (`rng: number[]`).
- Restore it before resolving an action and serialise it afterwards.
- Never use `Math.random()`, `Date.now()` inside rules, or unordered iteration
  over a `Set`/`Map` to make gameplay decisions.
- Same seed + same action sequence + same game version = same result.

### 5. State must be JSON-serialisable

No functions, class instances, `Map`, `Set`, `Date`, `undefined` holes or
circular references in game state. `structuredClone` and `JSON.stringify` are
used by the runtime.

### 6. Zero third-party runtime dependencies

A game may import `@gameclaw/gamekit` and its own files only. No `node:`
imports, no `process`, no sockets. Dev dependencies belong at the workspace
root. The portal runs in the browser; the engine must stay browser-safe.

### 7. Keep the monorepo layered

- Root: skill, catalog, docs, workflows, shared scripts, workspace config
- `packages/gamekit/`: shared runtime
- `games/<game-id>/`: one game's code, tests, README, content

Do not scatter one game's implementation across unrelated root folders.

## Coding and repo conventions

### 1. Stable repo-level entrypoints

- test one game via `node scripts/test-game.mjs <game-id>`
- discover games via `catalog/games.json` and `games/*/package.json`
- portal via `pnpm --filter @gameclaw/web dev` and `pnpm --filter @gameclaw/web build`
- relay via `pnpm --filter @gameclaw/relay test` (deploy is `wrangler deploy` in `relay/`)

A game can have internal scripts, but repo automation should stay predictable.

### 2. Toolchain

- TypeScript strict, ESM, `moduleResolution: bundler`, extensionless imports
- pnpm workspace, Node ≥ 22
- Vitest for tests, Biome for lint/format
- `pnpm lint`, `pnpm check`, `pnpm test` must pass before commit

### 3. Update docs in the same change set

If you change any of these, update docs before commit:

- repo layout
- build or release flow
- catalog schema
- skill behaviour
- game onboarding process
- which games are officially shipped
- where a game's gameplay documentation lives

### 3.1 Keep documentation layers distinct

- Root `README.md` / `README.zh-CN.md`: stable human-facing prompts that teach a
  person how to ask their agent to discover and launch games.
- Root `SKILL.md`: the distribution skill. It does not list games. It tells the
  agent to discover games from the live site or `catalog/games.json`, then play
  only through Web MCP.
- `catalog/games.json`: the machine-readable manifest used by tooling and docs.
- Each game directory: exactly one `README.md` (Chinese) covering mechanics,
  action ids, state paths and local development.
- `docs/`: maintainer documentation (architecture, release, standards, plans).

Do not push per-game gameplay churn back into the root README.

### 4. Be honest about the client

Scores are computed in the page and submitted to the relay. Say that caps,
run-id dedupe, and rate limits blunt abuse. Do not claim the relay replays the
engine.

### 5. Validate real artifacts when the portal or relay changes

If you change the portal, the relay, or a game's published score:

- run `pnpm lint && pnpm check && pnpm test`
- build the portal with `pnpm --filter @gameclaw/web build` when the bundle changes
- play one `new → act → recap` loop through the dev server
- for relay changes, run `pnpm --filter @gameclaw/relay test`

If local HTTP proxy settings can interfere with localhost checks, bypass them
explicitly (`curl --noproxy '*'`) instead of treating proxy-caused failures as
game bugs.

### 6. New games ship in the portal

A new game implements `GameDefinition`, a scene in `web/src/games/`, catalog
rows (including `score.zh` and `score.en`), and zh/en strings. Do not add a CLI
entrypoint. The human and the agent already share the portal.

### 7. If the coding agent is unavailable, use a strict single-agent fallback loop

If Codex / ACP is clearly unavailable but the user still wants the task completed,
do not pretend the delegation happened:

- still follow `plan → implement → docs → validate → commit`
- prefer repo-level validation: `pnpm lint && pnpm check && pnpm test`, then build the portal
- replay at least one genuine `new → act → recap` loop in the dev server
- only then commit, and publish the site and relay as in `docs/release-flow.md`

## Minimum expectations before commit

For large changes, do not skip:

- a written plan
- doc updates
- a validation summary
- a clean explanation of what changed

## Suggested layout

```
packages/gamekit/       shared runtime
games/<game-id>/        one game
catalog/                machine-readable manifest
scripts/                catalog validation and per-game test entrypoints
docs/plans/             in-progress plans only; delete after the change ships
docs/references/        single design-rules canon
.github/workflows/      ci.yml (quality gate) + release.yml (notes-only tag)
SKILL.md                distributable skill (no game list)
```
