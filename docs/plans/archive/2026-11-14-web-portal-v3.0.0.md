# Plan — GameClaw web portal (v3.0.0)

Date: 2026-11-14 · Owner: maintainer agent · Status: shipped in v3.0.0

## Goal

Ship a free, static, browser-playable portal for all GameClaw games at
<https://arcobalneo.github.io/gameclaw/>. Humans play with mouse/keyboard in a
pixel-art window; agents play the same window through WebMCP tools (or a plain
`window.gameclaw` JS API). No CLI download is needed for either.

## Scope

- `web/` workspace package (Vite + TypeScript strict, Canvas2D, no framework).
- `packages/gamekit/src/core.ts` (browser-safe entry, no `node:` imports) and
  `MemorySession` (in-memory session with the same action resolution as the CLI).
- One scene module per game in `web/src/games/<id>.ts` that imports the game's
  unchanged `src/definition.ts` and only renders state / reacts to outcomes.
- WebMCP tools: `list_games`, `open_game`, `new_game`, `get_state`,
  `list_actions`, `act`, `recap`.
- Publish `web/dist` to GitHub Pages. CI `web` job + `pages.yml` deferred: the
  maintainer token lacks the `workflow` scope (exception noted here).
- Version bump to 3.0.0 (root, gamekit, games, skill), docs, CHANGELOG.

## Assumptions

- WebMCP (`document.modelContext.registerTool`) is a Chrome early preview; the
  portal must work without it, so a polyfill and `window.gameclaw` are provided.
- GitHub Pages is static; a hosted remote MCP server is out of scope.
- Game engines are deterministic and DOM-free, so they run unchanged in browsers.

## Risks

- Breaking CLI builds by changing gamekit exports → keep `index.ts` unchanged
  in behaviour; add `./core` subpath only.
- Bundle size (shrimp-look / shrimp-catch content) → each game is a lazy chunk.
- Agent tool calls racing human input → both go through one `GameHost` per game,
  which serialises moves and broadcasts every change to the visible window.

## Checklist

- [x] gamekit `core.ts` + `MemorySession` + tests
- [x] `web/` scaffold, pixel font subset (Fusion Pixel, OFL), gfx kit
- [x] Portal (home grid, windows with tabs, hash routing, keyboard map)
- [x] Scenes for all 11 games
- [x] Agent API, WebMCP registration (document / navigator / polyfill)
- [x] Bilingual copyable prompt per game
- [x] Unit tests (`web/tests`) + browser smoke (`web/e2e/smoke.mjs`)
- [x] Pages published from `gh-pages` (built `web/dist`)
- [ ] CI `web` job + `pages.yml` (follow-up, needs `workflow` token scope)
- [x] README (en/zh), SKILL.md (web play + WebMCP, still list-free), docs/web-portal.md
- [x] Version 3.0.0, CHANGELOG
- [x] `pnpm lint && pnpm check && pnpm test`
