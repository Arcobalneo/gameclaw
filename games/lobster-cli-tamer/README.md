# lobster-cli-tamer

**Lobster Sideways Catch: a CLI creature-taming game for lobsters only**

This game directory should keep only one English `README.md` as its local documentation entrypoint.
Game-specific mechanics, runtime notes, Observer behavior, and settlement-report behavior should live here, not in an extra per-game `SKILL.md`.

## What this game is

`lobster-cli-tamer` is a terminal-first lobster-universe creature-taming game built around:

- 111 collectible creatures
- 700+ skill data entries
- 100 affixes with reroll / upgrade / seal progression
- overworld exploration and capture
- party growth and workshop investment
- endless abyss runs with in-battle permadeath
- a live local Observer page
- an automatic static HTML settlement report on exit

## Player path: use the released binary

Players should prefer the GameClaw GitHub Releases binaries:

- `https://github.com/Arcobalneo/gameclaw/releases/latest`

### Linux

```bash
tar -xzf lobster-cli-tamer-linux-x86_64.tar.gz
cd lobster-cli-tamer-linux-x86_64
./lobster-cli-tamer
```

### macOS Apple Silicon

```bash
tar -xzf lobster-cli-tamer-darwin-arm64.tar.gz
cd lobster-cli-tamer-darwin-arm64
./lobster-cli-tamer
```

## Maintainer path: run from source

```bash
cd games/lobster-cli-tamer
PYTHONPATH=. python3 -m lobster_cli_tamer.game
```

Or use the repo-level entrypoints from the monorepo root:

```bash
./scripts/test-game.sh lobster-cli-tamer
./scripts/build-game.sh lobster-cli-tamer
```

## Runtime outputs

- Live Observer page: `http://localhost:8000+`
- Saves: `~/.lobster-cli-tamer/save_<slot>.json`
- Static settlement report: `~/.lobster-cli-tamer/reports/latest.html`

## Gameplay notes

- In abyss mode, HP reaching 0 during battle means immediate permanent death.
- Elite abyss floors can spread plague.
- Retreating or failing out of the abyss resolves plague death risk based on accumulated plague floors.
- The current version is standard-library based and does not require a database.

## Documentation layering

- Human users who want the stable one-click GameClaw prompt should read the repo root `README.md` / `README.zh-CN.md`.
- The publishable `gameclaw` skill itself is the repo root `SKILL.md`.
- This file is the only per-game documentation entrypoint inside `games/lobster-cli-tamer/`.
- Repo-wide build / release / maintainer process lives under the repo root `docs/`.
