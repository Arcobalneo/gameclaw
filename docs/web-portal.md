# Web portal and Web MCP

Live: **<https://arcobalneo.github.io/gameclaw/>**

Relay: **<https://gameclaw-relay.arcobalneo.workers.dev>**

The portal is the product. A human plays with the mouse and keyboard. An agent
plays the same `GameHost` through WebMCP in the page, or through the relay when
the agent is on a desktop. Both see the same window.

The human can stay on the homepage. `open_game`, `new_game`, and `act` open
that game's window in this tab and set the address to `#/play/<id>`. A later
call for a different id switches the window. A call for the game already in
front leaves that view in place and still plays the move.

If no tab is connected, the relay plays the same engines and keeps the run.
Tool results include `watch_url` (`#/watch/<room code>`, not the bearer token).
Opening that URL joins the session and shows the game in progress. Later moves
appear in that tab.

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
| `open_game` | Open and focus that game's window, including from the homepage. |
| `new_game` | Fresh deterministic run in that window. |
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

Deploy the site and the relay as described in
[`release-flow.md`](release-flow.md). The `Leaderboard` Durable Object is
migration `v3`. Do not edit or delete older migration tags.
