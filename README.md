# GameClaw

**GameClaw** is a GitHub-first monorepo for shipping small terminal games as normal downloadable binaries.

It combines three things in one place:

- **CLI games** under `games/`
- a **player-facing catalog** for discovery
- a **release pipeline** that publishes playable builds to GitHub Releases

If you want the short version: **GameClaw lets people discover a game, download a release asset, unpack it, and start playing without cloning source code.**

- GitHub repo: <https://github.com/Arcobalneo/gameclaw>
- Latest releases: <https://github.com/Arcobalneo/gameclaw/releases/latest>

---

## Why this project exists

Most small terminal games are distributed in one of two annoying ways:

1. **source only** — users need the right language runtime, dependencies, and patience
2. **ad-hoc binaries** — downloads exist, but there is no consistent catalog, naming, or distribution story

GameClaw aims for a cleaner model:

- keep source code open in a monorepo
- ship player-facing builds as normal release artifacts
- make game discovery simple for both humans and agents
- keep release metadata, asset naming, and download instructions consistent

This is especially useful for agent-assisted software like OpenClaw, where a user might simply ask:

> “What games are available?”
> “Give me the Linux binary.”
> “How do I run this on my Mac?”

GameClaw is the layer that makes those answers clean and repeatable.

---

## What is in this repository

GameClaw has **one repository** but **two distinct distribution surfaces**:

### 1. The GitHub monorepo

This repository contains:

- game source code
- tests and packaging scripts
- release workflow automation
- player-facing catalog metadata
- maintainer documentation

This is the canonical source of truth for building and releasing the games.

### 2. The `gameclaw` skill

The Forge-published `gameclaw` skill is **not** the whole repository.

It is a **prompt-only skill** whose job is to teach an agent:

- what games currently exist
- which platforms are actually supported
- where the GitHub Releases downloads live
- how to tell a user to unpack and run them

In other words:

- **GitHub repo = source + release system**
- **Forge skill = discovery / download instructions**

Keeping that boundary clean is intentional.

---

## What you can play today

### `lobster-cli-roguelike`
**《横着活：只给龙虾玩的 CLI 肉鸽》**

A lobster-perspective terminal roguelike with:

- compact default text output
- endless cycle-based progression
- GitHub Releases binary distribution
- in-game prompts that encourage players to write useful strategy into their own memory system

**Currently published platforms:**
- `linux-x86_64`
- `darwin-arm64`

**Release assets:**
- `lobster-cli-roguelike-linux-x86_64.tar.gz`
- `lobster-cli-roguelike-darwin-arm64.tar.gz`

Release page:
<https://github.com/Arcobalneo/gameclaw/releases/latest>

---

## For players

You do **not** need to clone the repository just to play.

### Download
Go to the latest release page:

<https://github.com/Arcobalneo/gameclaw/releases/latest>

Choose the archive for your platform.

### Run on Linux

```bash
tar -xzf lobster-cli-roguelike-linux-x86_64.tar.gz
./lobster-cli-roguelike
```

### Run on macOS (Apple Silicon)

```bash
tar -xzf lobster-cli-roguelike-darwin-arm64.tar.gz
./lobster-cli-roguelike
```

If you want source code, modding, or local builds, then clone the repo. Otherwise, releases are the intended player path.

---

## For OpenClaw / agent users

GameClaw is designed to work well with agents.

An agent using the `gameclaw` skill should be able to answer questions like:

- “What games are available in GameClaw?”
- “I’m on Linux — give me the right binary.”
- “How do I run the lobster game on my Mac?”
- “Where is the source code for this game?”

The expected behavior is:

1. identify the requested game
2. identify the user’s platform
3. point to the correct GitHub release
4. give short unpack / run instructions
5. only mention source checkout when the user explicitly wants it

---

## Repository layout

```text
.
├── SKILL.md                       # prompt-only distribution skill behavior
├── catalog/
│   └── games.json                 # player-facing game catalog metadata
├── docs/
│   ├── repository-architecture.md
│   ├── release-flow.md
│   ├── agent-coding-standards.md
│   └── plans/
├── scripts/
│   ├── build-game.sh              # repo-level build entrypoint
│   └── test-game.sh               # repo-level test entrypoint
├── .github/
│   └── workflows/
│       └── release.yml            # GitHub Actions build/release workflow
└── games/
    └── lobster-cli-roguelike/
        ├── README.md
        ├── pyproject.toml
        ├── scripts/
        ├── lobster_cli_roguelike/
        └── tests/
```

---

## Local development

### Test a game

```bash
./scripts/test-game.sh lobster-cli-roguelike
```

### Build a game locally

```bash
./scripts/build-game.sh lobster-cli-roguelike
```

For the lobster game, local build artifacts are produced under:

```text
games/lobster-cli-roguelike/dist/
```

---

## Release model

GameClaw publishes games through **GitHub Releases**.

At a high level:

1. keep source in the monorepo
2. tag a release
3. let GitHub Actions build release artifacts
4. publish downloadable archives for supported platforms

Current workflow file:

- `.github/workflows/release.yml`

The project goal is to make distribution feel like a normal CLI release process, not like “clone this repo and pray.”

---

## Design principles

### 1. Releases first
Player-facing guidance should prefer release binaries over source checkouts.

### 2. Clear boundaries
The GitHub repo and the Forge skill serve different jobs and should stay separate.

### 3. Honest platform support
Only claim platforms that actually have published assets.

### 4. Open source, practical distribution
Source stays visible to maintainers and contributors; players get a cleaner binary download path.

### 5. No fake security claims
Binary releases can reduce casual source visibility in the player path, but they do **not** promise perfect anti-reversing or anti-tamper guarantees.

---

## Contributing

If you want to add or evolve a game in this repo, the normal workflow is:

1. add or update a game under `games/<game-id>/`
2. update `catalog/games.json`
3. keep docs in sync
4. validate with repo-level test/build entrypoints
5. publish through the shared release flow

For larger changes, this repo uses a **plan-first** workflow:

- write a checklist plan in `docs/plans/`
- make the changes
- update docs
- validate
- commit last

See also:

- `AGENTS.md`
- `docs/agent-coding-standards.md`
- `docs/repository-architecture.md`
- `docs/release-flow.md`

---

## Status

GameClaw is already live as a GitHub project with published releases, and the companion `gameclaw` skill is available as a prompt-only distribution skill for agent workflows.

The project is still early, but the core shape is now in place:

- one monorepo
- one catalog
- one release story
- many possible games
