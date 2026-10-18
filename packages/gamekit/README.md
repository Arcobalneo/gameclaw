# @gameclaw/gamekit

Shared runtime for GameClaw's agent-first terminal games.

`gamekit` owns everything that is **not game rules**:

- a single CLI surface: `new / status / actions / act / recap / saves / play / observer`
- deterministic save slots under `~/.gameclaw/<game-id>/`
- a text contract with stable anchors (`GAME`, `STATE`, `STAT`, `ACTIONS`, `NEXT`)
- a single JSON envelope on stdout for every command when `--json` is passed
- a detached local observer page on the first free port from 8000
- self-contained HTML / Markdown settlement reports
- an atomic NDJSON journal per run

It has **zero third-party runtime dependencies** and is bundled into each game's
single-file binary by Bun.

## Game contract

A game implements `GameDefinition<S>`:

```ts
import type { GameDefinition } from '@gameclaw/gamekit';

export const definition: GameDefinition<MyState> = {
  meta: { id, name, englishName, tagline, description, version, repo, license, guide },
  create({ seed, content, difficulty, now }) { /* ... */ },
  status(state) { /* headline, metrics, sections, outcome, turn */ },
  actions(state) { /* stable ids + labels + risk + detail */ },
  act(state, actionId) { /* mutate state in place, return { log, events } */ },
  recap(state) { /* cause, metrics, timeline, lessons, memoryPrompt */ },
  abort(state) { /* optional clean exit; enables the `abort` action */ },
};
```

`gamekit` clones the state before calling `act`, so a throwing action can never
corrupt a saved run.

## CLI contract

```bash
<bin> new      [--slot N] [--seed N] [--content X] [--difficulty Y] [--json]
<bin> status   [--slot N] [--json]
<bin> actions  [--slot N] [--json]
<bin> act <id> [--slot N] [--json]
<bin> recap    [--slot N] [--format text|markdown|html] [--json]
<bin> saves    [--json]
<bin> play     [--slot N]
<bin> observer [--port N]
<bin> doctor
```

Global flags: `--state-dir`, `--json`, `--no-color`, `--no-observer`,
`--no-report`, `--force`, `--verbose`. `GAMECLAW_HOME` overrides the state root.

### Text anchors

```
GAME   <id> v<version>  slot=0  turn=3  outcome=ongoing  seed=7
STATE  潮段 2 · 深度 12 · 章鱼讨债者
STAT   壳=6  能=4  盐=5 ...
---
遭遇 · 章鱼讨债者
...
---
ACTIONS
  [1] enc:1  左钳硬拼  risk=medium
NEXT   act enc:1
```

### JSON envelope

Every successful command prints exactly one JSON object with `ok`, `game`,
`slot`, `runId`, `seed`, `turn`, `outcome`, `status`, `actions`, `log`,
`events`, `observer`, `report`, `recap` and `next`. Errors print
`{ ok: false, error: { code, message, hint } }` and use a stable exit code:

| code | exit |
|---|---|
| `USAGE` | 2 |
| `NO_SAVE`, `SLOT_IN_USE`, `STATE_CORRUPT` | 3 |
| `ILLEGAL_ACTION`, `GAME_OVER` | 4 |
| `UNSUPPORTED` | 5 |
| `INTERNAL` | 1 |

## Determinism

Games store the four-word sfc32 RNG state in their save file. `Rng.fromSeed`
warms up; `Rng.restore` does not, so a replayed save continues the exact same
stream. Same seed + same action sequence + same game version = same run.

## Observer

`new` starts a detached daemon that serves:

- `GET /` — a dependency-free HTML dashboard polling once per second
- `GET /health` — liveness + game id
- `GET /state.json` — current save projected through `status` / `actions`
- `POST /shutdown` — token-protected shutdown

The port file lives at `~/.gameclaw/<game-id>/observer/daemon.json`. The daemon
expires after three hours. If it cannot start, the CLI says so instead of
pretending it exists.
