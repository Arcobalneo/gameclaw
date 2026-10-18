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

Requirements: Node.js ≥ 22, pnpm 10, Bun ≥ 1.3 (only for building binaries).

## What we want

- **Gameplay that creates real decisions**, not more buttons.
- **Bugs with a reproducible seed and action sequence.** Every run is
  deterministic, so a failing run can be replayed exactly.
- **Docs that match reality.** If behaviour changes, the docs change in the same
  PR.
- **Small, honest claims.** Binaries reduce source visibility; they are not
  anti-cheat.

## Before a large PR

Read [`AGENTS.md`](AGENTS.md) and write a plan under `docs/plans/`. A large change
includes: a new game, an engine rewrite, a CLI contract change, a release
workflow change, or a docs restructure.

The order is mandatory:

1. plan
2. implement
3. docs
4. validate
5. commit

## Adding a game

1. Copy the structure of an existing game under `games/`.
2. Implement `GameDefinition` from `@gameclaw/gamekit`.
3. Add engine + CLI tests (`tests/engine.test.ts`, `tests/cli.test.ts`).
4. Write a Chinese `games/<id>/README.md`.
5. Add an entry to `catalog/games.json`.
6. Run `node scripts/test-game.mjs <id>` and build one binary.
7. Update the root README game table and `SKILL.md` game table.

## PR checklist

- [ ] `pnpm lint` clean
- [ ] `pnpm check` clean
- [ ] `pnpm test` clean
- [ ] real binary built and smoke-tested when runtime/packaging changed
- [ ] docs and `catalog/games.json` updated
- [ ] no secrets, no generated binaries committed
- [ ] commit messages follow `type(scope): summary`

## Reporting a bug

Include:

- game id and version (`<game> --version`)
- platform (`darwin-arm64`, `linux-x64`, ...)
- `--seed` and the action ids you used
- the exact `--json` output of the failing turn, if possible

## Code of conduct

Be direct about code, generous about people. Lobsters are involved.
