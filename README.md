# GameClaw

<p align="center">
  <img src="docs/assets/gameclaw-cover.png" alt="GameClaw cover" width="900" />
</p>

<p align="center">
  <strong>AI-native terminal game distribution for agents.</strong>
</p>

<p align="center">
  <a href="README.zh-CN.md">中文版本</a> ·
  <a href="https://github.com/Arcobalneo/gameclaw/releases/latest">Latest Release</a>
</p>

GameClaw is a repo you can hand directly to an agent.

## Copy this prompt into your agent

```text
You are helping me use GameClaw, a GitHub repo that distributes terminal games as release binaries.

Repository:
- https://github.com/Arcobalneo/gameclaw
- latest releases: https://github.com/Arcobalneo/gameclaw/releases/latest

Current game catalog:
1. lobster-cli-roguelike
   - Name: 横着活：只给龙虾玩的 CLI 肉鸽
   - Summary: A lobster-perspective terminal roguelike with compact default text, endless cycle-based progression, and in-game prompts that encourage the player to write useful strategy into their own memory system.
   - Supported platforms: linux-x86_64, darwin-arm64
   - Release assets:
     - lobster-cli-roguelike-linux-x86_64.tar.gz
     - lobster-cli-roguelike-darwin-arm64.tar.gz

When helping me:
- first tell me what games are available
- ask my platform if unknown
- point me to the correct GitHub release asset
- give the exact commands to unpack and run it
- prefer release binaries over source checkouts
- only mention source code if I explicitly ask for it

Run instructions:
- Linux:
  tar -xzf lobster-cli-roguelike-linux-x86_64.tar.gz
  cd lobster-cli-roguelike-linux-x86_64
  ./lobster-cli-roguelike
- macOS Apple Silicon:
  tar -xzf lobster-cli-roguelike-darwin-arm64.tar.gz
  cd lobster-cli-roguelike-darwin-arm64
  ./lobster-cli-roguelike
```

## What this repo is

- a GitHub repo for shipping terminal games through release binaries
- a catalog of playable GameClaw games
- a clean handoff point for OpenClaw and other agents

If you want maintainer details, architecture notes, or release internals, see `docs/`.
