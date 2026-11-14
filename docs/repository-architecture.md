# Repository architecture

GameClaw is a web product. Humans and agents share one portal. Engines are
deterministic libraries. The relay carries sessions, play counts, and
leaderboards.

## Layers

### 1. Runtime — `packages/gamekit/`

Browser-safe TypeScript. No `node:` imports.

- `GameDefinition` (`create`, `status`, `actions`, `act`, `recap`, optional `abort`)
- `MemorySession` for the page
- sfc32 `Rng`
- `recap.score` and `normalizePlayerName`

A game must not parse argv, exit the process, or open a socket.

### 2. Games — `games/<id>/`

```
games/<id>/
├── package.json
├── src/            engine, content, definition
├── tests/
└── README.md       mechanics, score rule, how to test
```

`games/*` may import `@gameclaw/gamekit` only. Games do not import each other.
State is JSON-serialisable. Same seed + same actions + same version = same run.

### 3. Portal — `web/`

Vite + Canvas2D. Each game is a lazy scene in `web/src/games/<id>.ts`.
The host, the buttons, and the MCP tools call the same `GameHost`.

zh/en catalogs live in `web/src/i18n/`. Engines keep emitting canonical Chinese.
The portal translates at the boundary. English dictionary strings contain no CJK.

### 4. Relay — `relay/`

Cloudflare Worker + Durable Objects:

| Class | Role |
|---|---|
| `SessionRoom` | Forwards MCP tool calls to the open tab |
| `CodeRegistry` | Room code ↔ session token |
| `PlayStats` | Anonymous play counts (migration `v2`) |
| `Leaderboard` | Best-per-game scores and the site total (migration `v3`) |

`GET /leaderboard` is the cheap first paint. `/leaderboard/live` pushes updates.
`POST /mcp` is Streamable HTTP. `get_leaderboard` is answered by the worker.
`submit_score` is forwarded to the page, which posts the run's `recap.score`.

### 5. Catalog — `catalog/games.json`

Schema 2. Ids, names, summaries, and `score.zh` / `score.en`. No platforms and
no release assets. `SKILL.md` does not list games.

## Dependency direction

`web` and `games` import `gamekit`. `relay` imports `gamekit` for name rules.
`gamekit` imports nothing from `web`, `games`, or `relay`.
