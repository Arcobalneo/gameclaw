# AGENTS.md — GameClaw repo rules

This repository is a **GameClaw distribution monorepo**: five agent-first
terminal games, one shared TypeScript runtime, one release pipeline.

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
   - build the real binary when packaging or runtime behaviour changed
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

### 2. The CLI contract is owned by gamekit

Every game exposes exactly:

```
new / status / actions / act / recap / saves / play / observer / doctor
```

plus `--json`, `--state-dir`, `--slot`, `--seed`, `--no-observer`,
`--no-report`, `--no-color`, `--force`, `--verbose`.

A game must not parse `process.argv`, call `process.exit`, or write its own
observer/report implementation. It implements `GameDefinition<S>` from
`@gameclaw/gamekit`:

```ts
create / status / actions / act / recap / abort?
```

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

Games may import `node:*` and `@gameclaw/gamekit` only. Dev dependencies belong
at the repo root. This keeps binaries small, cold start fast and the five-platform
matrix honest.

### 7. Keep the monorepo layered

- Root: skill, catalog, docs, workflows, shared scripts, workspace config
- `packages/gamekit/`: shared runtime
- `games/<game-id>/`: one game's code, tests, README, content

Do not scatter one game's implementation across unrelated root folders.

## Coding and repo conventions

### 1. Stable repo-level entrypoints

- build via `node scripts/build-game.mjs <game-id> [--platform <os>-<arch>]`
- test via `node scripts/test-game.mjs <game-id>`
- discover games via `catalog/games.json` and `games/*/package.json`
- release matrix via `node scripts/release-matrix.mjs`

A game can have internal scripts, but repo automation should stay predictable.

### 2. Toolchain

- TypeScript strict, ESM, `moduleResolution: bundler`, extensionless imports
- pnpm workspace, Node ≥ 22, Bun ≥ 1.3 for binary compilation
- Vitest for tests, Biome for lint/format
- `pnpm lint`, `pnpm check`, `pnpm test` must pass before commit

### 3. Update docs in the same change set

If you change any of these, update docs before commit:

- repo layout
- build or release flow
- release asset names or platform matrix
- catalog schema
- skill behaviour
- game onboarding process
- which games are officially shipped
- where a game's gameplay documentation lives

### 3.1 Keep documentation layers distinct

- Root `README.md` / `README.zh-CN.md`: stable human-facing prompts that teach a
  person how to ask their agent to discover and launch games.
- Root `SKILL.md`: the self-contained distribution skill (game list, platforms,
  assets, launch and network troubleshooting).
- `catalog/games.json`: the machine-readable manifest used by tooling and docs.
- Each game directory: exactly one `README.md` (Chinese) covering mechanics,
  action ids, state paths and local development.
- `docs/`: maintainer documentation (architecture, release, standards, plans).

Do not push per-game gameplay churn back into the root README.

### 4. Be honest about binary security posture

Say:
- binaries reduce casual source visibility
- binaries do not guarantee perfect anti-reversing

Do **not** claim impossible-to-reverse binaries unless that is actually true and
documented.

### 5. Validate real artifacts when packaging or runtime changes

If you change packaging, the build script, the observer or the release workflow:

- run `pnpm test`
- build a real binary with `node scripts/build-game.mjs <game-id>`
- run `./<binary> --version` and at least one full `new → act → recap` loop
- verify observer behaviour explicitly: the page responds, the server stops at
  run end, and a static HTML settlement is written
- for cross-platform changes, build at least one foreign target

If local HTTP proxy settings can interfere with localhost checks, bypass them
explicitly (`curl --noproxy '*'`) instead of treating proxy-caused failures as
game bugs.

### 6. New GameClaw games must ship the default observer + report flow

gamekit provides both, so a new game only needs to implement the contract. Do not
disable or reimplement them. A run must:

- start a local observer page on the first free port from 8000
- print the exact URL
- stop the server when the run ends
- preserve a static HTML settlement report
- degrade honestly if the observer cannot start

### 7. If the coding agent is unavailable, use a strict single-agent fallback loop

If Codex / ACP is clearly unavailable but the user still wants the task completed,
do not pretend the delegation happened:

- still follow `plan → implement → docs → validate → commit`
- prefer repo-level validation: `pnpm test`, then build the real binary
- replay at least one genuine CLI run through the real entrypoint
- only then commit, tag, push and confirm the GitHub release / workflow result

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
scripts/                build / test / release entrypoints
docs/plans/             active plans; archive/ holds historical plans
docs/references/        single design-rules canon
.github/workflows/      ci.yml + release.yml
SKILL.md                distributable skill
```
