# Web portal and Web MCP

Live: **<https://arcobalneo.github.io/gameclaw/>**

Relay: **<https://gameclaw-relay.arcobalneo.workers.dev>**

The portal is the product. A human plays with the mouse and keyboard. An agent
plays the same `GameHost` through WebMCP in the page, or through the relay when
the agent is on a desktop. Both see the same window.

## Layout

```
web/src/main.ts                 boot, language, stats, leaderboard, MCP
web/src/ui/home.ts              hero, agent paste-in, site board, game grid
web/src/ui/game-view.ts         scene, actions, help, per-game board, submit
web/src/runtime/agent-api.ts    tool implementations
web/src/runtime/leaderboard.ts  GET + WebSocket
web/src/i18n/                   zh/en UI strings and per-game catalogs
web/src/games/<id>.ts           canvas scene
```

Engines stay in `games/<id>/src` and are imported by the scenes.

## Tools

| Tool | What it does |
|---|---|
| `list_games` | Ids, names, goals. No hardcoded list in the skill. |
| `open_game` | Focus a window. |
| `new_game` | Fresh deterministic run. |
| `get_state` | Headline, metrics, sections, outcome. |
| `list_actions` | Legal actions. |
| `act` | One action. The window animates it. |
| `recap` | Settlement, including `score`. |
| `get_leaderboard` | Site total, or one game when `game_id` is set. |
| `submit_score` | Name only. The page sends `recap.score`. |
| `set_language` | `zh` or `en` for the shared page. |

`get_leaderboard` is also answered by the relay when the desktop agent calls
MCP, so a closed tab can still read the boards. Submitting needs the open page.

## Leaderboard rule

Best score per display name per game. The site board sums those bests. A lower
resubmit does not change rank. The same run id cannot be submitted twice.
Aborted and unfinished runs score 0. Names are 1–16 characters. The relay stores
the name and the scores, not an account.

Each game's formula is `catalog/games.json` → `score`, and the help panel.

## Develop

```bash
pnpm install
pnpm --filter @gameclaw/web dev
pnpm --filter @gameclaw/web build
pnpm --filter @gameclaw/relay dev    # local Bun server, same HTTP contract
```

Deploy the site by publishing `web/dist` (built with `GAMECLAW_BASE=/gameclaw/`)
to the `gh-pages` branch. Deploy the relay with `wrangler deploy` inside
`relay/`. The `v3` migration creates the `Leaderboard` Durable Object. Until
that deploy runs, the live worker will not have the new class.
