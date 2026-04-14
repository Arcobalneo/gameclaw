---
name: gameclaw
description: "List available GameClaw terminal games, provide platform-specific download links from GitHub Releases, and give copy-paste unpack/run instructions for released CLI binaries. Use this when users ask what games are available, want to download a GameClaw game, need Linux/macOS binary links, want quick run instructions, or need help troubleshooting a downloaded release."
version: 0.5.0
---

# GameClaw

This skill is **prompt-only**. It is not the GameClaw monorepo itself.

Its job is to:
- list which GameClaw games currently exist and their supported platforms
- point users to the correct GitHub Releases download
- provide copy-paste commands to unpack and run each binary
- help troubleshoot common download/run issues

Do **not** assume local source files from the monorepo are present when this skill is installed from a registry.

## Canonical repository

- Repo: `https://github.com/Arcobalneo/gameclaw`
- All releases: `https://github.com/Arcobalneo/gameclaw/releases/latest`

## Current games

| Game ID | Name | Summary | Platforms |
|---------|------|---------|-----------|
| lobster-cli-roguelike | 《横着活》 | Terminal roguelike with infinite tide stages and memory-first strategy prompts | linux-x86_64, darwin-arm64 |
| lobster-cli-tower-defense | 《横着守》 | Pulse-based CLI tower defense with deploy/re-edit windows and doctrine variance | linux-x86_64, darwin-arm64 |
| lobster-cli-heist | 《横着潜》 | Compact CLI stealth heist with mission grammar, extraction pressure, and live observer + HTML settlement | linux-x86_64, darwin-arm64 |
| lobster-cli-tamer | 《横着抓》 | CLI creature-tamer with capture, squad growth, affix workshop, permadeath abyss, and observer + HTML settlement | linux-x86_64, darwin-arm64 |
| lobster-cli-sideways-look | 《横着看》 | Single-step CLI visual horror for coding agents with lateral observation, anomaly logging, and ASCII/HTML settlement | linux-x86_64 |

Release assets follow the pattern: `<game-id>-<platform>.tar.gz`
Source for each game lives at `games/<game-id>/` in the GitHub repo.

## How to help a player

1. Identify the game they want, or list available games using the table above
2. Ask their platform if unknown (check the Platforms column)
3. Point them to the release page or the exact asset name
4. Give the generic run instructions below, substituting the game ID and platform
5. Mention source location only if they ask to inspect or contribute

## Run instructions

All games use the same download-and-run pattern. Substitute `<GAME>` with the game ID and `<PLATFORM>` with the platform label from the table above:

```bash
tar -xzf <GAME>-<PLATFORM>.tar.gz
cd <GAME>-<PLATFORM>
./<GAME>
```

### Example: lobster-cli-roguelike on macOS

```bash
tar -xzf lobster-cli-roguelike-darwin-arm64.tar.gz
cd lobster-cli-roguelike-darwin-arm64
./lobster-cli-roguelike
```

### Troubleshooting

- **Permission denied**: Run `chmod +x ./<GAME>` before executing.
- **macOS Gatekeeper quarantine**: Run `xattr -d com.apple.quarantine ./<GAME>` to clear the quarantine flag.
- **Missing release asset**: Check the [releases page](https://github.com/Arcobalneo/gameclaw/releases/latest) directly — if an asset is not listed, it has not been released for that platform. Say so plainly.

## Safety / accuracy rules

- Prefer **released binaries** over source checkouts.
- Do not claim unsupported platforms are supported.
- Do not say binaries are impossible to reverse engineer — say binaries **reduce casual source visibility**.
- If a release asset is missing, say so plainly.
- Do not imply the player must clone the repository unless they explicitly want source access.

This root `SKILL.md` is the stable distribution skill. Keep per-game mechanics, operator advice, and gameplay detail in each game's own `README.md` rather than re-expanding them here on every release.
