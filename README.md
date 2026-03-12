# GameClaw

> Open-source terminal games, shipped like real CLI releases.

**GameClaw** is a GitHub-first monorepo for building, packaging, and distributing small terminal games through normal release artifacts instead of “clone the repo and figure it out yourself.”

It brings together three pieces that are usually scattered:

- **game source code** under `games/`
- a **catalog** that tells players and agents what exists
- a **release pipeline** that publishes downloadable binaries to GitHub Releases

If you want the shortest description:

**GameClaw helps people discover a terminal game, download the right binary for their platform, unpack it, and start playing in minutes.**

- GitHub repo: <https://github.com/Arcobalneo/gameclaw>
- Releases: <https://github.com/Arcobalneo/gameclaw/releases/latest>

---

## Why GameClaw exists

Small terminal games often ship in one of two frustrating formats:

- **source-only projects** that expect players to install runtimes, dependencies, and build tools
- **one-off binaries** with no catalog, weak documentation, and inconsistent naming

GameClaw is an attempt to make terminal game distribution feel more like a serious software project:

- keep source code open and maintainable
- publish player-facing builds as proper release assets
- keep download instructions short and reliable
- make the same metadata usable by both humans and agents

This is especially useful in agent workflows. A user should be able to ask questions like:

- “What games are available?”
- “I’m on Linux — give me the right binary.”
- “How do I run this on my Mac?”

…and get a clean, repeatable answer.

---

## What this repository contains

GameClaw has one repository but two different public surfaces.

### The GitHub monorepo

This repo is the canonical source of truth for:

- game implementations
- tests and packaging scripts
- release automation
- player-facing catalog metadata
- maintainer and contributor documentation

### The `gameclaw` Forge skill

The Forge-published `gameclaw` skill is a **prompt-only distribution skill**.

Its job is not to contain the monorepo. Its job is to teach an agent:

- what games currently exist
- which platforms are actually supported
- where the GitHub releases live
- how to tell a player to download, unpack, and run them

So the intended split is:

- **GitHub repo = source, metadata, build, release**
- **Forge skill = discovery and download guidance**

That boundary is deliberate.

---

## Playable today

### `lobster-cli-roguelike`
**《横着活：只给龙虾玩的 CLI 肉鸽》**

A lobster-perspective terminal roguelike built for repeated low-friction play:

- compact default text output
- endless cycle-based progression
- downloadable GitHub release binaries
- in-game prompts that encourage the player to write useful strategy into their own memory system

**Currently available release assets:**

- `lobster-cli-roguelike-linux-x86_64.tar.gz`
- `lobster-cli-roguelike-darwin-arm64.tar.gz`

**Currently supported player platforms:**

- Linux `x86_64`
- macOS Apple Silicon `arm64`

Release page:
<https://github.com/Arcobalneo/gameclaw/releases/latest>

---

## For players

You do **not** need to clone the repository just to play.

### 1. Download a release asset
Open the latest release page:

<https://github.com/Arcobalneo/gameclaw/releases/latest>

Then choose the archive for your platform.

### 2. Unpack and run

#### Linux

```bash
tar -xzf lobster-cli-roguelike-linux-x86_64.tar.gz
cd lobster-cli-roguelike-linux-x86_64
./lobster-cli-roguelike
```

#### macOS (Apple Silicon)

```bash
tar -xzf lobster-cli-roguelike-darwin-arm64.tar.gz
cd lobster-cli-roguelike-darwin-arm64
./lobster-cli-roguelike
```

If you want to inspect the source, contribute changes, or build locally, then clone the repo. For normal play, releases are the intended path.

---

## For OpenClaw and other agents

GameClaw is designed to be easy for agents to use.

An agent using the `gameclaw` skill should be able to:

- list the games currently available
- identify the right platform-specific download
- point the user to the GitHub release page
- give minimal unpack and run instructions
- mention source location only when the user explicitly wants it

This keeps the player path simple while still preserving an open source codebase behind it.

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

### Run tests

```bash
./scripts/test-game.sh lobster-cli-roguelike
```

### Build locally

```bash
./scripts/build-game.sh lobster-cli-roguelike
```

The current game writes local build artifacts under:

```text
games/lobster-cli-roguelike/dist/
```

---

## Release model

GameClaw ships games through **GitHub Releases**.

At a high level:

1. keep source code in the monorepo
2. tag a release
3. let GitHub Actions build the supported artifacts
4. publish downloadable archives for players

Current workflow file:

- `.github/workflows/release.yml`

The aim is simple: make distribution look and feel like a normal CLI software project.

---

## Design principles

### Releases first
Player-facing guidance should prefer released binaries over source checkouts.

### Honest platform support
Only claim support for platforms that have actual published assets.

### Clear distribution boundaries
The GitHub monorepo and the Forge skill serve different purposes and should stay separate.

### Open source, practical delivery
Source stays visible for contributors and maintainers; players get a cleaner binary download path.

### No fake security story
Binary releases can reduce casual source visibility in the player path, but they do **not** promise perfect anti-reversing or anti-tamper guarantees.

---

## Contributing

If you want to extend GameClaw, the normal maintainer flow is:

1. add or update a game under `games/<game-id>/`
2. update `catalog/games.json`
3. keep docs aligned with reality
4. validate through the repo-level test/build entrypoints
5. publish via the shared release flow

For larger changes, this repo uses a **plan-first** workflow:

- write a checklist plan in `docs/plans/`
- make the changes
- update docs
- validate
- commit last

Related docs:

- `AGENTS.md`
- `docs/agent-coding-standards.md`
- `docs/repository-architecture.md`
- `docs/release-flow.md`

---

## Current status

GameClaw is live as a public GitHub repository with published release assets and a companion prompt-only Forge skill for agent workflows.

It is still early, but the foundation is already in place:

- one monorepo
- one discovery catalog
- one release story
- room for many games
