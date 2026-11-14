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
  src/runtime/prompt.ts     bilingual copyable agent prompt
  src/gfx/*                 384×216 pixel buffer: sprites, parallax, fx, text
  src/games/<id>.ts         scene per game: draw / hud / react / hit regions
  src/ui/*                  home grid, windowed portal with tabs, game view, sfx
```

- **Rendering**: Canvas2D into a 384×216 buffer, scaled by integers when possible
  (`image-rendering: pixelated`). Parallax ridges, dithered glows, particles,
  screen shake, hit-stop, delta floats and outcome banners are shared by all games.
- **Font**: a subset of Fusion Pixel 12px (OFL, `web/public/fonts`), regenerate with
  `pnpm --filter @gameclaw/web font`.
- **State**: one `GameHost` per game id. Human clicks/keys and agent tool calls go
  through the same host, so an agent's moves animate in the window a human watches
  (an "AGENT" badge marks them). Runs persist in `localStorage` (`gameclaw:v3:<id>`).
- **Performance**: 60fps RAF loop that pauses when hidden; each game is a lazy chunk.

## Controls

| Input | Effect |
| --- | --- |
| Click a card / action button / object in the scene | open game / take action |
| `1`–`9` | take the numbered action |
| `↑↓` or `W/S` (`A/D`) | move focus (or move, in games with directional actions) |
| `Enter` / `Space` | take focused action |
| `N` / `F` / `M` / `Esc` / `Tab` | new run / fullscreen / mute / close / next window |

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

## Hosted remote MCP?

Not shipped. GitHub Pages only serves static files, so it cannot host an MCP
endpoint (Streamable HTTP needs a server process and per-session state). Because
the engines are pure TypeScript, a future remote MCP could run them on a
serverless runtime such as Cloudflare Workers / Durable Objects. Until then,
agents connect through WebMCP (or the JS API) in a real browser tab, which also
keeps the human-visible window in sync.

## Development

```bash
pnpm install
pnpm --filter @gameclaw/web dev          # http://localhost:5173/gameclaw/
pnpm --filter @gameclaw/web build        # web/dist
cd web && npx vite preview --port 4173 &  node e2e/smoke.mjs http://localhost:4173/gameclaw/
```

Deploy: build with `GAMECLAW_BASE=/gameclaw/ pnpm --filter @gameclaw/web build` and
publish `web/dist` to GitHub Pages (currently the `gh-pages` branch). A GitHub
Actions Pages workflow and a CI `web` job are planned as a follow-up (pushing
workflow files needs a token with the `workflow` scope).
