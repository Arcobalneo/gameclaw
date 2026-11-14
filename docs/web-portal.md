# Web portal & WebMCP

Live: **<https://arcobalneo.github.io/gameclaw/>**

The portal runs every GameClaw game in the browser. The game engines are the same
deterministic state machines used by the CLI binaries (`games/<id>/src`); the web
layer only renders state and turns input into actions.

## Architecture

```
web/
  src/main.ts               boot: font, Home, Portal, agent API, WebMCP
  src/catalog.ts            catalog/games.json + per-game accent / goal text
  src/runtime/registry.ts   lazy `import()` per game (one chunk each)
  src/runtime/host.ts       GameHost: MemorySession + localStorage + change feed
  src/runtime/agent-api.ts  list_games … recap; WebMCP registration
  src/runtime/session.ts    local session token + room code (localStorage)
  src/runtime/relay.ts      WebSocket to the remote MCP relay
  src/runtime/prompt.ts     copyable agent prompt (MCP URL + token, current language)
  src/i18n/index.ts         typed zh/en UI dictionary, lang()/setLang()/t()
  src/i18n/catalogs/        compiled per-game exact + pattern + glossary catalogs
  src/i18n/translate.ts     loc layer at the host / prompt / recap / canvas boundary
  src/runtime/stats.ts      anonymous play-count client (GET /stats, POST /stats/hello, WS /stats/live)
  src/gfx/art.ts            art bible: hue-shifted ramps, grade, bloom, light mask, springs
  src/gfx/fx.ts             pooled particles, trauma shake + kick, hit-stop, impact frames
  src/gfx/actors.ts         layered humanoid sprite generator (front/back/bust, blink, talk)
  src/gfx/*                 384×216 pixel buffer: sprites, parallax, tiny font, text
  src/games/<id>.ts         scene per game: draw / grade / hud / react / hit regions
  src/ui/*                  home grid, windowed portal with tabs, game view, topbar, session chip, sfx
  public/covers/*.webp      home covers, clean frames captured from the real scenes
```

- **Rendering**: Canvas2D into a 384×216 buffer, scaled by integers when possible
  (`image-rendering: pixelated`, smooth downscale otherwise). Every frame goes
  through a shared post pass: per-scene colour grade, cheap bloom, vignette.
  Sprites get auto light-from-top-left shading and selective outlines; scenes
  cache their static layers. Particles are pooled (no per-frame allocation),
  impacts use hit-stop + trauma shake + directional kick, and
  `prefers-reduced-motion` turns shake/flash/impact frames off.
- **HUD**: numbers live in the DOM side panel (with animated deltas); the canvas
  keeps only in-world cues, so floats never collide with the HUD.
- **Language**: 中 / EN switch in the top bar, saved in `localStorage`
  (`gameclaw:lang`), default from `navigator.language`. The loc layer maps
  engine-authored Chinese (headlines, logs, action details, recap, lessons)
  plus UI chrome, names, HUD, banners and canvas-drawn signs into the active
  locale. Engines themselves stay deterministic and still emit canonical
  Chinese, so CLI output and tests do not change. WebMCP tool descriptions
  stay English. Missing catalog keys fail type-checking or the EN smoke test.
- **Font**: a subset of Fusion Pixel 12px (OFL, `web/public/fonts`), regenerate with
  `pnpm --filter @gameclaw/web font`.
- **State**: one `GameHost` per game id. Human clicks/keys and agent tool calls go
  through the same host, so an agent's moves animate in the window a human watches
  (an "AGENT" badge marks them). Runs persist in `localStorage` (`gameclaw:v3:<id>`).
- **Session**: on first visit the page creates a 22-character session id and the
  relay assigns a 7-character room code (`gameclaw:session:*` in `localStorage`).
  No login. The room code is in the header; typing it on another device joins the
  same session. The language switch still applies to these strings.
- **Performance**: 60fps RAF loop that pauses when hidden; each game is a lazy chunk.

## Controls

| Input | Effect |
| --- | --- |
| Click a card / action button / object in the scene | open game / take action |
| `1`–`9` | take the numbered action |
| `↑↓` or `W/S` (`A/D`) | move focus (or move, in games with directional actions) |
| `Enter` / `Space` | take focused action |
| `N` / `F` / `M` / `Esc` / `Tab` | new run / fullscreen / mute / close / next window |
| `H` / `?` | help |

## WebMCP tools

Registered with `document.modelContext.registerTool` (Chrome WebMCP preview),
falling back to `navigator.modelContext` (older preview / MCP-B extension) and
finally to a built-in polyfill (`document.modelContext.executeTool(name, args)`).

| Tool | Input | Result |
| --- | --- | --- |
| `list_games` | – | ids, names, goals |
| `open_game` | `game_id` | opens / focuses the window, returns state |
| `new_game` | `game_id?`, `seed?`, `difficulty?` | fresh run, state + actions |
| `get_state` | `game_id?` | headline, metrics, sections, outcome, turn |
| `list_actions` | `game_id?` | numbered legal actions with detail / cost / risk |
| `act` | `action_id`, `game_id?` | applies the move (id, unique prefix or 1-based index) |
| `recap` | `game_id?` | end-of-run recap |

Without WebMCP, agents that can run page JavaScript use the same functions on
`window.gameclaw` (`listGames`, `openGame`, `newGame`, `getState`, `listActions`,
`act`, `recap`, `closeGame`). Every call returns JSON and never throws.

## Remote MCP

GitHub Pages is static, so the MCP endpoint lives on a small relay
(`relay/`): Cloudflare Workers + Durable Objects in production, or a Bun
server with the same contract locally (`bun relay/src/node-server.ts`).

- **Browser**: `wss://<host>/session/<id>`. The tab executes tools on the
  existing `GameHost` (same path as clicks and in-page WebMCP) and returns
  results. If the WebSocket drops, a slim reconnect banner appears.
- **Agent**: Streamable HTTP MCP at `POST https://<host>/mcp` with
  `Authorization: Bearer <session-id>`. Tools are the same seven
  (`list_games` … `recap`). The session token may also be passed as a
  `session` tool argument. If no tab is connected, the tool returns
  "The GameClaw page is not connected" and tells the agent to wait until
  the human opens the portal.
- **Public MCP URL**: `https://gameclaw-relay.arcobalneo.workers.dev/mcp`
- **CORS**: locked to `https://arcobalneo.github.io` and localhost.
- **Lookup**: `GET /room/<code>` resolves a short code to a session id, rate
  limited. Tokens are not written to logs.

The copyable prompt under each game includes the MCP URL, the token, and
how to connect, in the current UI language.

Deploy the Worker with `npx wrangler deploy` from `relay/` (requires a
Cloudflare API token with Workers + Durable Objects permissions, or
`wrangler login`). Point the portal at a different relay with `?relay=`
or `VITE_GAMECLAW_RELAY`.

```bash
pnpm --filter @gameclaw/relay test
bun relay/src/node-server.ts          # http://127.0.0.1:8787/mcp
# e2e (page open + remote MCP act):
node web/e2e/relay.mjs http://localhost:4173/gameclaw/ --relay http://127.0.0.1:8787
```

## Player counts

No login. Each browser mints one durable anonymous play id (`gameclaw:player`
in `localStorage`), separate from the room/session token. The first visit
counts once for the site total; opening a game counts that game once per id
(refreshing does not increment again). The relay stores only SHA-256 hashes
of the ids plus integer counters — no PII.

- First paint: cached counts from `localStorage`, then `GET /stats`.
- Hello: `POST /stats/hello` with the play id and any newly opened game ids.
- Live: `GET /stats/live` (WebSocket) broadcasts updates to every open page.
- Limits: 30 hellos per minute per id; at most 8 new player ids per IP in
  10 minutes (further spoofed ids are ignored and do not increment).

The site total is a chip in the bottom-right corner (“N 人已玩过” /
“N have played”). Each home card and game window repeats the per-game count.

## Development

```bash
pnpm install
pnpm --filter @gameclaw/web dev          # http://localhost:5173/gameclaw/
pnpm --filter @gameclaw/web build        # web/dist
cd web && npx vite preview --port 4173 &  node e2e/smoke.mjs http://localhost:4173/gameclaw/
node web/e2e/covers.mjs                  # re-capture home covers from the dev server
```

Deploy: build with `GAMECLAW_BASE=/gameclaw/ pnpm --filter @gameclaw/web build` and
publish `web/dist` to GitHub Pages (currently the `gh-pages` branch). A GitHub
Actions Pages workflow and a CI `web` job are planned as a follow-up (pushing
workflow files needs a token with the `workflow` scope).
