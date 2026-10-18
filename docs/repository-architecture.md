# Repository architecture

`gameclaw` is a monorepo with two implementation layers and one distribution
layer. The split is deliberate: **runtime** must stay game-agnostic, and
**games** must stay runtime-agnostic.

## Layers

### 1. Runtime layer — `packages/gamekit/`

`@gameclaw/gamekit` owns everything that is not game rules:

- the CLI surface (`new / status / actions / act / recap / saves / play / observer`)
- argument parsing, exit codes and the JSON envelope
- deterministic RNG (sfc32) and slot persistence
- the local observer daemon and the HTML dashboard
- settlement reports (HTML + Markdown)
- the NDJSON journal

It has zero third-party runtime dependencies and is bundled into every game
binary by Bun.

### 2. Game layer — `games/<game-id>/`

Each game is a self-contained pnpm workspace package:

```
games/<game-id>/
├── package.json          # name, version, scripts, gamekit dependency
├── src/
│   ├── main.ts           # import definition + runCli, nothing else
│   ├── definition.ts     # meta + GameDefinition assembly
│   ├── engine.ts         # pure state machine
│   └── content.ts        # encounters, units, cases, items, ...
├── tests/                # engine determinism + CLI contract
├── README.md             # the only per-game documentation entrypoint
└── LICENSE
```

Games do not read `process.argv`, call `process.exit`, write files, open sockets
or render HTML. They expose state in, actions in, result out.

### 3. Distribution layer — root

- `SKILL.md` — the self-contained skill published to ClawHub / registries
- `catalog/games.json` — machine-readable manifest (ids, platforms, assets)
- `README.md` / `README.zh-CN.md` — human discovery and launch entrypoint
- `.github/workflows/` — `ci.yml` and `release.yml`
- `scripts/` — stable repo entrypoints
- `docs/` — maintainer documentation

## Dependency direction

```
games/<id> ──► packages/gamekit
     │
     └──────► node:*

packages/gamekit ──► node:*
```

`gamekit` must never import a game. Games must never import each other. Shared
helpers belong in gamekit; game-specific helpers stay in the game.

## The why: distribution logic vs game logic

Because the repo itself is part of the product:

- one skill distributes five games
- one catalog describes five games
- one release pipeline builds five games for five platforms
- one agent workflow governs every change

Per-game repositories would fragment the skill, the release matrix and the
review process without improving the player experience.

## Expected invariants

1. Every shipped game appears in `catalog/games.json` and `games/`.
2. Every game implements `GameDefinition` and nothing outside it.
3. Every game passes `pnpm check` and `pnpm test`.
4. Every game builds a single-file binary via `scripts/build-game.mjs`.
5. Every game ships the same CLI surface and the same JSON envelope.
6. Every game is deterministic for a fixed seed and action sequence.
7. Root README stays focused on discovery and launch; gameplay detail lives in
   each game's own README.
8. Player-facing downloads resolve to GitHub Releases, never to a source checkout.
9. Documentation layers stay distinct: human prompt, agent skill, manifest,
   per-game README, maintainer docs.

## Runtime state layout

```
~/.gameclaw/<game-id>/
├── saves/slot-<n>.json     # authoritative run state
├── last-slot               # last used slot
├── journals/<run-id>.ndjson
├── observer/daemon.json    # port + pid + token, deleted on shutdown
└── reports/latest.html     # settlement report
```

`--state-dir` or `GAMECLAW_HOME` relocates the whole tree, which is what tests and
evaluations use.
