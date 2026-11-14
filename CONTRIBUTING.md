# Contributing to GameClaw

Thanks for playing, breaking and improving these games.

## Quick start

```bash
git clone https://github.com/Arcobalneo/gameclaw
cd gameclaw
pnpm install
pnpm check
pnpm test
```

Requirements: Node.js ≥ 22, pnpm 10.

## What we want

- **Gameplay that creates real decisions**, not more buttons.
- **Bugs with a reproducible seed and action sequence.** Every run is
  deterministic, so a failing run can be replayed exactly.
- **Docs that match reality.** If behaviour changes, the docs change in the same
  PR.
- **Small, honest claims.** Leaderboard scores are submitted by the page.
  The relay rate-limits and caps them. It does not replay the engine.

## Before a large PR

Read [`AGENTS.md`](AGENTS.md) and write a plan under `docs/plans/`. A large change
includes: a new game, an engine rewrite, an MCP or leaderboard change, or a
docs restructure.

The order is mandatory:

1. plan
2. implement
3. docs
4. validate
5. commit

## Adding a game

Follow [`docs/NAMING.md`](docs/NAMING.md): every game uses the Shrimp-series
display form and a matching `shrimp-<word>` id across the catalog, runtime,
and package.

1. Copy the structure of an existing game under `games/`.
2. Implement `GameDefinition` from `@gameclaw/gamekit`, including `recap.score`.
3. Add engine tests (`tests/engine.test.ts`, `tests/ladder.test.ts`).
4. Add a scene in `web/src/games/<id>.ts` and zh/en catalog strings.
5. Write `games/<id>/README.md` and a catalog entry with `score.zh` and `score.en`.
6. Run `node scripts/test-game.mjs <id>`.
7. Update the root README game table. Do not add the game to `SKILL.md`.

## PR checklist

- [ ] `pnpm lint` clean
- [ ] `pnpm check` clean
- [ ] `pnpm test` clean
- [ ] portal built when the bundle changed
- [ ] docs and `catalog/games.json` updated
- [ ] no secrets, no generated binaries committed
- [ ] commit messages follow `type(scope): summary`

## Reporting a bug

Include:

- game id and the portal version
- seed and the action ids you used
- the `get_state` / `recap` JSON of the failing turn, if you have it

## Code of conduct

Be direct about code, generous about people. Shrimp are involved.
