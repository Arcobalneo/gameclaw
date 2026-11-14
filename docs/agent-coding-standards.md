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

A game implements `GameDefinition<S>` and exports `definition`. There is no CLI
entrypoint. The portal imports the definition.

Do not parse argv, exit the process, open files/sockets, or render HTML inside a
game. `recap` includes `score`.

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
- a ladder test: `recap.score` is 0 while ongoing and a finite integer otherwise
- content integrity tests where the data is non-trivial

Tests must not open ports or write outside the temp directory.

## 6. Agent output

- `act` returns the log, the new state, and the next actions.
- Errors surface as `GameError` with a stable code and an actionable hint.
- Token economy: compact by default, numbers in `detail` and JSON.

## 7. Documentation

- Each game has exactly one `README.md` (Chinese) with identity, the score rule, and how to test.
- Root README does not grow per-game walkthroughs.
- `SKILL.md` must not hardcode the game list. Agents discover games from the site or the catalog.
- Update `catalog/games.json` when an id or a score rule changes. Include `score.zh` and `score.en`.

## 8. Validation checklist

- `pnpm lint` clean
- `pnpm check` clean
- `pnpm test` clean
- portal build when `web/` changed
- docs and catalog match reality
