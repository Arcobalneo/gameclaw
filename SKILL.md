---
name: gameclaw
description: Tell users what terminal games exist in GameClaw and how to download the released CLI binaries from GitHub. Use this when users ask what games are available, want a GameClaw game, need Linux/macOS download links, or want quick run instructions for a released game.
version: 0.2.0
---

# GameClaw

This skill is **prompt-only**. It is not the GameClaw monorepo itself.

Its job is simple:
- tell the agent which GameClaw games currently exist
- tell the agent which platforms are actually supported
- point users to the correct GitHub Releases download
- explain how to unpack and run the binary

Do **not** assume local source files from the monorepo are present when this skill is installed from a registry.

## Canonical repository

- Repo: `https://github.com/Arcobalneo/gameclaw`
- Releases: `https://github.com/Arcobalneo/gameclaw/releases/latest`

## Current games

### 1. lobster-cli-roguelike

- **Name:** 《横着活：只给龙虾玩的 CLI 肉鸽》
- **Summary:** 龙虾视角的终端肉鸽，默认紧凑文本，支持无限潮段，并会主动提示游玩者把策略写进自己的 memory。
- **Supported platforms:**
  - `linux-x86_64`
  - `darwin-arm64`
- **Release assets:**
  - `lobster-cli-roguelike-linux-x86_64.tar.gz`
  - `lobster-cli-roguelike-darwin-arm64.tar.gz`
- **Release page:** `https://github.com/Arcobalneo/gameclaw/releases/latest`
- **Source location:** `games/lobster-cli-roguelike` in the GitHub repo

## How to help a player

When a user wants a game:

1. identify the game they want, or list available games
2. ask their platform if unknown
3. point them to the GitHub Releases page or the exact release asset name
4. give the shortest useful unpack/run instructions
5. mention source location only if they ask to inspect or contribute

## Recommended response shape

Keep it practical:
- game name
- one-line description
- supported platforms
- GitHub release link
- 1-2 commands to unpack / run

## Run instructions

### Linux (`linux-x86_64`)

```bash
tar -xzf lobster-cli-roguelike-linux-x86_64.tar.gz
cd lobster-cli-roguelike-linux-x86_64
./lobster-cli-roguelike
```

### macOS Apple Silicon (`darwin-arm64`)

```bash
tar -xzf lobster-cli-roguelike-darwin-arm64.tar.gz
cd lobster-cli-roguelike-darwin-arm64
./lobster-cli-roguelike
```

## Safety / accuracy rules

- Prefer **released binaries** over source checkouts.
- Do not claim unsupported platforms are supported.
- Do not say binaries are impossible to reverse engineer.
- Say binaries **reduce casual source visibility**.
- If a release asset is missing, say so plainly.
- Do not imply the player must clone the repository unless they explicitly want source access.
