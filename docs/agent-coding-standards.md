# Agent coding standards

This document complements `AGENTS.md` with concrete conventions.

## Workflow rule

For large changes: **plan → implement → docs → validate → commit**.
A plan lives in `docs/plans/` and states goal, scope, assumptions, risks and a
checklist. Do not reorder without documenting why.

## 1. Layer discipline

- Runtime changes go in `packages/gamekit/`.
- Gameplay changes go in `games/<id>/`.
- Distribution changes (skill, catalog, README, workflows) stay at the root.

If a change touches all three, split the commits and say so in the PR.

## 2. Game contract

A game implements `GameDefinition<S>` and exports `definition`. `src/main.ts` is
only:

```ts
import process from 'node:process';
import { runCli } from '@gameclaw/gamekit';
import { definition } from './definition';

process.exitCode = await runCli(definition);
```

Do not parse argv, exit the process, open files/sockets, or render HTML inside a
game.

### State

- JSON-serialisable only: no `Map`, `Set`, `Date`, class instances or functions.
- Include `rng: number[]` and update it after every action.
- Store enough information that `recap` can explain the run without replaying it.

### Actions

- Ids are stable and namespaced: `enc:1`, `deploy:<unit>@<slot>`, `move:n`.
- Prefix matching is supported by gamekit, so avoid ids that are prefixes of
  unrelated ids (`move:n` vs `move:north`).
- `ActionView.detail` carries decision-relevant numbers; `label` stays short.
- Every game supports `abort` via the `abort(state)` hook.

### Determinism

- Use `Rng` from gamekit; never `Math.random()`.
- Resolve every random decision in a fixed order.
- Do not branch on wall-clock time, locale, or host platform.

## 3. TypeScript conventions

- `strict: true`, `noUncheckedIndexedAccess`, `noUnusedLocals`.
- ESM, extensionless relative imports (`./engine`, not `./engine.js`).
- `import type` for type-only imports (`verbatimModuleSyntax`).
- Prefer `readonly` data and pure helpers; mutate state only in `act`.
- No `any`. Use discriminated unions and exhaustive `switch` checks.
- Keep files under ~400 lines; split `engine/` by system when a game grows.

## 4. Content conventions

- Content lives in `src/content.ts` or JSON under the game directory.
- Every content entry must carry player-facing text **and** machine-relevant
  numbers. Narrative must match mechanics.
- Prefer 3 meaningful options over 6 cosmetic ones.
- If content is generated, a test must assert its shape and cardinality.

## 5. Tests

Each game needs:

- a determinism test (same seed + action sequence = same state)
- a terminal-path test (win or lose) that runs the real engine
- an illegal-action test
- a CLI smoke test using `runCli` with `--state-dir <tmp> --no-observer --no-report`
- content integrity tests where the data is non-trivial

Tests must not touch `~/.gameclaw` or open ports.

## 6. CLI and output

- Text mode uses the gamekit anchors; don't invent new formats.
- JSON mode is one object per invocation; never log extra lines to stdout.
- Errors surface as `GameError` with a stable code and an actionable hint.
- Token economy: compact by default, `detail` in JSON, `--verbose` for humans.

## 7. Documentation

- Each game has exactly one `README.md` (Chinese) with: identity, why
  agent-first, platform matrix, mechanics, action ids, CLI reference, state
  paths, local dev, security boundary.
- Root README does not grow per-game walkthroughs.
- `SKILL.md` stays self-contained and must be updated when platforms, asset
  names or the CLI contract change.
- Update `catalog/games.json` whenever a game id, platform or asset name changes.

## 8. Validation checklist

- `pnpm lint` clean
- `pnpm check` clean
- `pnpm test` clean
- `node scripts/build-game.mjs <game-id>` produces a working binary
- `./<game> --version` and one `new → act → recap` loop verified
- observer: page responds, server stops, report written
- docs and catalog match reality
