# GameClaw documentation

Maintainer-facing documentation. Player-facing content lives in the root
[`README.md`](../README.md) / [`README.zh-CN.md`](../README.zh-CN.md) and the
distributable [`SKILL.md`](../SKILL.md).

| Document | Read it when |
|---|---|
| [`repository-architecture.md`](repository-architecture.md) | You need the layering rules, dependency direction, or state layout |
| [`web-portal.md`](web-portal.md) | You are changing the site, Web MCP, or the relay contract |
| [`adding-a-game.md`](adding-a-game.md) | You are adding a game or iterating on an existing one |
| [`release-flow.md`](release-flow.md) | You are publishing the site, the relay, or a git tag |
| [`agent-coding-standards.md`](agent-coding-standards.md) | You are writing code, content, or tests |
| [`NAMING.md`](NAMING.md) | You are choosing an id or changing display metadata |
| [`references/ai-native-game-design-rules.md`](references/ai-native-game-design-rules.md) | You are designing or changing gameplay |
| [`plans/`](plans/) | You are writing a plan for a change that has not shipped yet |

## The one-paragraph version

GameClaw is a web product. Humans play in the browser. Agents play the same
session through Web MCP (in the tab, or through the remote relay).
`packages/gamekit` is the browser-safe runtime. Each `games/<id>` package is
one deterministic engine. `web/` is the portal. `relay/` is the Cloudflare
Worker for sessions, play counts, and leaderboards. `catalog/games.json` is the
machine-readable manifest. The root `SKILL.md` tells an agent to discover games
from the live site or the catalog, then play only through Web MCP. There is no
CLI and no downloadable binary.

## Where to put documentation

- Human discovery and the Agent paste-in → root README
- Agent distribution → `SKILL.md` (no game list)
- Machine-readable catalog → `catalog/games.json`
- One game's mechanics and score rule → `games/<id>/README.md`
- Architecture, portal, onboarding, release, standards → `docs/`
- Game design methodology → `docs/references/`

Do not duplicate a fact across layers. Link to the owning layer instead.
Do not keep shipped or obsolete plans in the tree.
