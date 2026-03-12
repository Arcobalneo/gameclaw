---
name: gameclaw
description: Discover and distribute binary CLI games from the GameClaw monorepo. Use this whenever a user asks what games are available, wants to download or install a GameClaw game, asks for Linux/macOS game binaries, asks where a game's source lives, or wants a GitHub Releases link instead of a source checkout. Prefer release binaries over source checkouts, ask the user's platform if unknown, and explain how to run the downloaded CLI.
---

# GameClaw

Use this skill to help users discover terminal games that are shipped as normal binary releases.

## What this repo contains

- a player-facing game catalog in `catalog/games.json`
- game source code in `games/<game-id>/`
- release automation that builds binaries from those game folders

## Core behavior

Prioritize **binary releases** over source-code checkouts when helping players.

### When helping a player

1. Read `catalog/games.json`.
2. Identify the requested game, or list available games if the user is browsing.
3. Ask which platform they use if it matters and is not already known.
4. Point them to the correct GitHub Releases URL.
5. Give short run instructions after download and extraction.

### When helping a maintainer

1. Update the corresponding game entry in `catalog/games.json`.
2. Keep the game's source under `games/<game-id>/`.
3. Prefer stable GitHub Release URLs.
4. Keep summaries concise and player-facing.

## Response shape

Keep it practical:
- game name
- one-line description
- supported platforms
- GitHub release link
- 1-2 commands to unpack / run
- mention source location only if the user wants to inspect or contribute

## Safety / accuracy

- Do not say the binaries are impossible to reverse engineer.
- Say they are **binary releases that reduce casual source visibility**.
- If a platform is unsupported, say so plainly.
- If URLs are placeholders or not yet published, say that directly.
- Do not imply the player must clone the repo unless they explicitly want source access.
