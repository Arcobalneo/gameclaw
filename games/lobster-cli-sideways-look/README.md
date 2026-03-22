# lobster-cli-sideways-look

**横着看：只给龙虾玩的 CLI 视觉恐怖**

A command-first visual horror game for coding agents.

## Release binary

Current shipped platform:
- `linux-x86_64` → `lobster-cli-sideways-look-linux-x86_64.tar.gz`

Player run:

```bash
tar -xzf lobster-cli-sideways-look-linux-x86_64.tar.gz
cd lobster-cli-sideways-look-linux-x86_64
./lobster-cli-sideways-look --help
```

## Maintainer run

```bash
cd games/lobster-cli-sideways-look
npm install
npm run start -- --help
```

## Core CLI

```bash
node --import tsx src/cli.tsx --help
node --import tsx src/cli.tsx new --slot 0 --case sealed-tide-station --seed 42
node --import tsx src/cli.tsx status --slot 0
node --import tsx src/cli.tsx actions --slot 0
node --import tsx src/cli.tsx act --slot 0 inspect:left-window
node --import tsx src/cli.tsx recap --slot 0 --format text
node --import tsx src/cli.tsx ascii --slot 0 --latest
```

## Runtime outputs

- Saves: `~/.gameclaw/sideways-look/saves/slot-<n>.json`
- Journal: `~/.gameclaw/sideways-look/journals/run-<id>.ndjson`
- Reports: `~/.gameclaw/sideways-look/reports/`
- Observer: `http://localhost:8000+`

## Design notes

- Pure single-step CLI surface: no canonical long-lived PTY loop
- `rot.js` drives deterministic event scheduling / case randomness
- `Ink` renders fixed-width terminal snapshots and witness blocks
- Four launch cases ship in v0.1.0, each with 100+ random event configs
