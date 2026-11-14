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

Follow the full checklist in [`docs/adding-a-game.md`](docs/adding-a-game.md).
Every game uses the Claw-series names in [`docs/NAMING.md`](docs/NAMING.md).
Do not add a CLI entrypoint, and do not add the game to `SKILL.md`.

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

Be direct about code, generous about people.
