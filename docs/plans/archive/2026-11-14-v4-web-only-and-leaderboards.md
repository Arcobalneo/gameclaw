# Plan — GameClaw v4.0.0: web + Web MCP only, with leaderboards

Date: 2026-11-14 · Owner: maintainer agent · Status: implemented on the v4 branch

## Goal

Make the browser the only official GameClaw product. Humans play the pixel
portal. Agents play the same session through in-page WebMCP or the existing
remote relay. Add per-game and site-wide leaderboards. Raise every game's
score into something worth climbing. Ship as v4.0.0, a breaking product change.

## Scope

- Delete the CLI product: entrypoints, Bun binaries, multi-platform release
  assets, CLI install docs, and CLI-only gamekit modules (argv, saves, observer,
  reports). Engines stay deterministic libraries under `games/<id>/` and are
  bundled by `web/`.
- Keep: zh/en localization, anonymous play counts, no-login session token and
  room code, remote MCP relay, 虾× display names.
- Leaderboards on the existing Workers + Durable Objects relay (new
  `Leaderboard` class, migration `v3`). Cheap `GET`, live updates on a
  WebSocket. Same actions as Web MCP tools.
- Design and score pass on all 11 games. Fix English canvas strings that were
  truncated to fit Chinese layouts (burger ticket and falling labels).
- Homepage: game list, site leaderboard, and a prominent paste-in for an agent
  (GitHub `SKILL.md` + live site + this visitor's token and MCP URL).
- Rewrite SKILL, READMEs, CHANGELOG, and maintainer docs so they no longer
  describe a CLI as the standard. Do not publish to ClawHub.

## Out of scope

- Editing `.github/workflows` (the token has no `workflow` scope).
- Deploying GitHub Pages or running `wrangler deploy`.
- Printing or committing any Cloudflare or session secret.

## Assumptions

- Engines remain the source of truth for a run's score. The relay does not
  resimulate a game. It checks shape, caps, names, and rate limits. A finished
  run's score is read by the open page (human button or `submit_score`).
- Existing CI still calls `scripts/release-matrix.mjs`. That script reports no
  CLI products (`__none__`) so the build job skips. Tagging a release before
  the workflow files are retired would try to build a CLI that no longer exists.
- Old local saves are dropped because each game's `GAME_VERSION` moves to
  `4.0.0` and `MemorySession.restore` rejects a version mismatch.

## Leaderboard rule

**Best per game, sum across games.**

- A name is 1–16 characters after trim: letters, numbers, spaces, `_`, `-`, `.`,
  `·`. No URLs. Latin case folds into one row; the board shows the casing of
  the best submit. No other personal data is stored.
- One row per name per game: the highest accepted score. A lower or equal
  resubmit does not change rank. Attempts are counted but do not rank.
- The site board is the sum of each name's best on every game. Playing another
  game, or beating your best, is how the total climbs. Replaying a worse run
  does not.
- Only `won` or `lost` runs with score 1–999999 and turn ≥ 1 can be submitted.
  Aborted and unfinished runs cannot. The same run id cannot be submitted twice.
- Rate limit: 8 submits per minute per IP, 20 per hour per name. IPs are not
  persisted.

## Score pass (identity kept, ladder changed)

Each game keeps its 虾× name and its core fantasy. The published score is
`recap.score`, 0 while ongoing or aborted. Formulas live in each engine and in
`catalog/games.json` (`score.zh` / `score.en`). A strong clear of any game
lands in roughly the same band, so one game cannot drown the site board.

| Game | What the ladder rewards |
|---|---|
| 虾走 | Banking before the gate vs surviving it. Death pays a fraction of fame. |
| 虾守 | Kills and a clean hold. A leak costs more than three kills on the ladder. |
| 虾潜 | A quiet verified extract. Alert, time, and wrong crates dominate the multiplier. |
| 虾抓 | Abyss depth, not a box full of surface catches. A death costs about a floor. |
| 虾看 | A fast, calm, verified escape. A wrong record has a hard low ceiling and costs extra dread. |
| 虾闹 | Right soothes and a real harvest. Blind soothes and trampling erase points. |
| 虾写 | Verified keep or a debt-free seal. Selling, or believing an unverified pen, pays much less. Debt is a tax. |
| 虾素 | Hosting your own table with the line held. Biting meat is a large penalty. Lasting all sixteen meals without an ending is a low score. |
| 虾征 | Mirror over pact over war. Captures are expensive. Starving scores nothing. |
| 虾跃 | Perfects and a perfect streak. Only a perfect continues the streak. Falls erase it and a large chunk of the score. |
| 虾堡 | Tasty serves and a tasty streak. A lucky bite does not extend the streak. A walkout costs more than a lucky serve. |

## Risks

- CI workflows still describe CLI builds. Mitigated by the `__none__` sentinel.
  A human must retire `ci.yml`'s build job and `release.yml` before tagging.
- Scores are client-reported. Caps, run-id dedupe, and rate limits blunt abuse;
  they are not a server-side replay. Documented as such.
- New Chinese strings in engines must have English catalog entries or the i18n
  smoke test fails.
- `Leaderboard` is a new Durable Object. It does nothing in production until
  `wrangler deploy` runs the `v3` migration.

## Checklist

- [x] Plan (this file)
- [x] gamekit is a browser-safe library; CLI modules and game `main.ts` deleted
- [x] `scripts/release-matrix.mjs` reports no CLI products; `build-game.mjs` removed
- [x] Catalog schema 2, validator updated
- [x] Relay leaderboard + tests + wrangler migration `v3`
- [x] Web MCP tools: existing play tools plus `get_leaderboard`, `submit_score`, `set_language`
- [x] Homepage agent paste-in + site board; per-game board and submit
- [x] Eleven score formulas, tests, and i18n for new strings
- [x] English canvas labels wrap instead of truncating
- [x] SKILL, README (en/zh), CHANGELOG, architecture, web portal, release notes, game READMEs
- [x] `pnpm lint && pnpm check && pnpm test`
