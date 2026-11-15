# Changelog

## Unreleased

- `虾熔` shows which way the next tide pushes, and how many drops are left
  before it. `虾网` draws a tear as a hole and a wet knot as a drip. `虾钟`
  draws you at the same size as a foe, and marks the opposite slot of a swap.
- `虾数` puts the step button in the water, under the planks. `虾罩` shows
  the flood before it reaches you. `虾钟` sweeps the hand across the slot it
  just turned. `虾拨` crosses a gorge with walls, a fall, and mist.
- `虾印` shows the next guest's kind and fare at the rail, so the pardon
  can be saved for the dearer edge. `虾节` lines each incoming beat up
  with the phrase that answers it.
- `虾筏 (Claw Raft)` and `虾仓 (Claw Stow)` now play on bespoke boards.
  The raft shows this gust and the next one; a crate on the side it does not
  prefer leans the next gust by 1. Stow shows the next three slips, and a
  mark is worth spending when that order arrives after the spoil age. Score
  formulas are unchanged. Those two games are `meta.version` `4.1.0`.
- `虾印` no longer counts an edge stamp as an approval. The fare and the
  strike still land. Suggest pardons or rereads that guest. A line that
  stamps high fares loses the night.
- `虾网` opens with five tears and a shorter thread. Suggest still fills
  the basket. Tying knots in board order does not.
- `虾熔` shows the shell in hand and numbers the columns. A points-only
  drop still plugs the well.
- `虾礁 (Claw Reef)` and `虾灯 (Claw Lamp)` now play on bespoke boards.
  A reef mark still counts only after the push, and an urchin on that cell is
  a sweep unless you anchor. Lamp's widest post blocks the posts that seal
  the shoal, and the action list no longer leads with a solved move. Score
  formulas are unchanged. Those two games are `meta.version` `4.1.0`.
- Rebuilt the scenes for `虾印`, `虾熔`, `虾网`, and `虾节`: a night ferry,
  a tide well of shells, a harbor net, and a ring. Each has its own props,
  idle motion, and hit feedback.
- `虾拨` no longer refills springs between stages. On normal, stage 2 and
  stage 4 each place one stone, and a hop spent earlier cannot cross it.
- `虾数` now hides one blank plank on stage 2 and stage 4. No number
  covers it, so the magnet is the only crossing. Stepping onto it falls.
- Rebuilt the scenes for `虾数`, `虾罩`, `虾钟`, and `虾拨`: a counted pier
  with sinking planks and a magnet, a two-stratum canyon with a brass visor,
  a geared clock chamber, and a spike gorge with a lever. Idle motion, HUD
  pips, and hit or fall effects are in each scene.
- Played `虾印`, `虾熔`, `虾网`, `虾节`, `虾数`, `虾罩`, `虾钟`, and `虾拨`.
  Clock looks two plies further. Mask shows a moving visor and a pulsing
  flood. Count and flip shake when you fall.
- Added four games: `虾灯 (Claw Lamp)`, `虾筏 (Claw Raft)`, `虾仓 (Claw Stow)`,
  and `虾镜 (Claw Glass)`. Lamp lights pools that must not see each other.
  Raft balances three holds against a known gust. Stow pulls the bay a slip
  names. Glass aims one moonbeam with three mirrors.
- Added three games: `虾掘 (Claw Delve)`, `虾市 (Claw Fair)`, and
  `虾礁 (Claw Reef)`. A bare shaft span falls, a stall remembers yesterday's
  price, and a reef mark counts only after the tide pushes.
- Added four games: `虾数 (Claw Count)`, `虾罩 (Claw Mask)`, `虾钟 (Claw Clock)`,
  and `虾拨 (Claw Flip)`. Count shares one number across a run of planks. Mask
  chooses which of two layers is solid. Clock feeds a hand. Flip swaps every
  plate and gap at once.
- Added four games: `虾印 (Claw Stamp)`, `虾熔 (Claw Melt)`, `虾网 (Claw Net)`,
  and `虾节 (Claw Beat)`. A working slate of nineteen concepts is in
  `docs/plans/2026-11-14-jam-slate.md`.
- Added four more games: `虾循 (Claw Round)`, `虾绕 (Claw Coil)`,
  `虾算 (Claw Sum)`, and `虾泊 (Claw Berth)`. The nineteen-concept slate is
  now implemented.

### Changed

English display names are `Claw <Word>` and machine ids are `claw-<word>`.
Chinese `虾×` titles are unchanged. The paired form is `虾× (Claw <Word>)`.
`GAME_VERSION` stays `4.0.0`. The four games above already used this identity.

| Former id | Current id | English name |
| --- | --- | --- |
| `shrimp-trek` | `claw-trek` | Claw Trek |
| `shrimp-guard` | `claw-guard` | Claw Guard |
| `shrimp-heist` | `claw-heist` | Claw Heist |
| `shrimp-catch` | `claw-catch` | Claw Catch |
| `shrimp-look` | `claw-look` | Claw Look |
| `shrimp-rampage` | `claw-rampage` | Claw Rampage |
| `shrimp-ink` | `claw-ink` | Claw Ink |
| `shrimp-greens` | `claw-greens` | Claw Greens |
| `shrimp-conquest` | `claw-conquest` | Claw Conquest |
| `shrimp-leap` | `claw-leap` | Claw Leap |
| `shrimp-burger` | `claw-burger` | Claw Burger |

- `#/play/<former id>` opens the game and replaces the address with
  `#/play/<current id>`.
- Web MCP and the headless desk accept a former id and return the current id.
  A `#/watch/<room code>` page restores a run stored under a former id into
  the current id. The room code itself is unchanged.
- Leaderboard rows and play counts stored under a former id are folded into
  the current id on read. No Durable Object migration tag was added.
- A browser save under `gameclaw:v3:<former id>` restores into the current id.

The alias map is `catalog/legacy-ids.json`.

## v4.0.1 — 2026-11-14

Documentation and CI cleanup. No gameplay change. Game `GAME_VERSION` stays 4.0.0.

- Replaced the leftover CLI binary jobs in `ci.yml` and `release.yml`. CI now
  lints, typechecks, tests, validates the catalog, and builds the portal.
  Tagging `v*` publishes GitHub Release notes only; it does not attach binaries
  or deploy the site.
- Removed `scripts/release-matrix.mjs`.
- Deleted obsolete shipped plans and the old `docs/archive/` notes. Current
  maintainer docs and `docs/references/ai-native-game-design-rules.md` stay.
- Rewrote `docs/README.md`, `AGENTS.md`, and `docs/release-flow.md` so they
  describe the web product. Added `docs/adding-a-game.md`.

## v4.0.0 — 2026-11-14

Breaking product change. The browser is the only GameClaw. The CLI, the
single-file binaries, and the multi-platform release assets are gone.

### Play

- Humans play the portal. Agents play the same session through in-page WebMCP
  or the remote relay. New tools: `get_leaderboard`, `submit_score`,
  `set_language`.
- The homepage has a paste-in for an agent (skill URL, live site, this
  visitor's token and MCP URL), the site leaderboard, and the game list.
- Each game shows its own board. A finished win or loss can be submitted under
  a display name.

### Leaderboards

- Best score per name per game. A lower resubmit does not change rank.
- The site board is the sum of those bests.
- Stored on a new `Leaderboard` Durable Object (wrangler migration `v3`).
  First paint is `GET /leaderboard`. Open pages subscribe to
  `/leaderboard/live`. Names are validated and submits are rate-limited. No
  PII beyond the chosen display name and the scores.
- The page, not the agent, supplies the score from `recap.score`.

### Games

- All eleven games have a new ladder formula. Abort and unfinished runs score 0.
  Formulas are in each engine, in `catalog/games.json` `score`, and in the help
  panel. 虾走 can bank fame before the sea gate. 虾跃 tracks a perfect streak.
  虾堡 tracks a tasty streak (a lucky bite does not extend it). 虾守 leaks cost
  an extra point of integrity. 虾看 charges extra dread for a wrong record.
- English canvas labels wrap onto a second line instead of truncating
  (burger ticket, falling names, species plates, floating plates).

### Removed

- CLI entrypoints (`games/*/src/main.ts`), CLI tests, Bun `start`/`build`
  scripts, `scripts/build-game.mjs`, and the gamekit CLI (argv, saves, observer,
  reports).
- CLI entrypoints and `scripts/build-game.mjs` were removed. Workflow cleanup
  and the retirement of `scripts/release-matrix.mjs` followed in v4.0.1.

### Catalog

- `catalog/games.json` is schema 2: web product, no platforms, no release assets.
  Each game has `score.zh` and `score.en`.

## v3.3.0 — 2026-11-14

### Added — full localization and anonymous play counts

- A proper loc pipeline sits in front of the engines. Engines stay deterministic
  and still emit canonical Chinese; the web host, agent API, recap, prompts and
  canvas renderers map every string through typed zh/en catalogs (exact phrases,
  `{n}` patterns, and a glossary). Switching 中 / EN at the top right now covers
  site chrome, titles, HUD, action labels and details, names, phases, logs,
  headlines, recap/lessons, banners, agent prompts, and art-side glyphs (tickets,
  seals, signs). There is no side-by-side bilingual leftover.
- The language still defaults from `navigator.language` and persists in
  `localStorage`. The CLI is unchanged and remains Chinese.
- The portal footer and each game card / window show “N 人已玩过” / “N have
  played”. A first visit mints one durable anonymous play id (`gameclaw:player`).
  Opening the site counts once per id for the site total; opening a game counts
  that game once per id. Counts are stored on the relay as SHA-256 hashes of the
  id, not the raw id, and no PII is collected. First paint uses a cached GET
  `/stats`; live pages subscribe to `/stats/live` and increment together. Hello
  is rate-limited (30/min per id, 8 new players / 10 min per IP).

### Changed

- Relay version is 3.3.0. A `PlayStats` Durable Object (wrangler migration `v2`)
  backs the counters; the Bun node server uses the same in-memory contract.
- docs: README (EN+ZH), `docs/web-portal.md`. SKILL.md stays list-free.

## v3.2.0 — 2026-11-14

### Added — remote MCP, live spectating

- Opening the portal mints a high-entropy session token (no login, no email,
  no password) and a 7-character room code, stored in `localStorage`. The
  room code sits as a small chip in the header and is copyable. Typing a
  room code on another device reopens the same session.
- A relay service (`relay/`) fronts Streamable HTTP MCP at `POST /mcp`
  (`Authorization: Bearer <token>`) and a WebSocket at `/session/<id>`.
  Agent tool calls are forwarded to the already-open browser tab; the game
  engines still run there, so the human sees the same window, progress and
  animations (including the existing "AGENT" marker). If the tab is closed,
  MCP returns a clear "open the GameClaw page to spectate" error.
- The copyable agent prompt now includes the MCP URL, the session token,
  and short connect instructions (中 / EN follows the language switch).
- In-page WebMCP and `window.gameclaw` are unchanged. CLI games are unchanged.

Default MCP endpoint: `https://gameclaw-relay.arcobalneo.workers.dev/mcp`.
The Worker + Durable Object entry is in `relay/`; a Bun server with the
same contract is used for local development and e2e.

## v3.1.0 — 2026-11-14

### Changed — web portal polish

- **Art**: shared art bible in code (hue-shifted ramps, auto top-left shading
  and selective outlines on every sprite, per-scene colour grade, bloom,
  light masks, vignette). New layered humanoid sprites with blink / talk /
  squash. Scenes rebuilt: 虾素 (lit dining rooms, readable diners and a real
  player seat), 虾征 (giant's room, a giant face with tracking eyes at the
  window, stomping boot, glass jar, reaching hand), 虾走 (foreground
  parallax, drifting gill net, plastic bag / bottle / six-pack rings),
  虾跃 (clean two-layer skyline), 虾守 (seabed trenches, stone sea gate,
  bigger units), 虾潜 (building cross-section with lamp / torch / camera
  lighting), 虾抓 (crustacean species looks, travelling attack bolts),
  虾看 (perspective room, case folders, flashlight light mask), 虾闹
  (raised beds, farmhouse, scarecrow, night lighting), 虾写 (ink-wash map
  on rice paper), 虾堡 (diner kitchen, guest with moods).
- **Feel**: pooled particles (sparks, dust, rings, splashes, ink, steam,
  embers), trauma shake with directional kick, per-impact hit-stop, impact
  frames, anticipation on attacks and jumps, landing squash, sound cues
  aligned with hits. `prefers-reduced-motion` respected.
- **UI**: minimal home (logo, one-line tagline, cover grid with name and a
  short tagline, GitHub link). Covers are clean frames captured from the real
  scenes. Game window: canvas, compact HUD chips with animated deltas,
  action list with risk marks and a preview of the focused action,
  collapsible log and agent prompt with Copy, help behind `?`. Removed the
  in-canvas metric bar and duplicated status text; floats never overlap the HUD.
- **Language switch** (中 / EN) in the top-right corner, persisted, default
  from the browser. Typed dictionary; engine labels, metrics and phases
  translated through per-game glossaries. The agent prompt is now a single
  language. Engine narrative text stays Chinese.
- Version `3.1.0` across root, gamekit, games and skill metadata. Game rules
  and CLI behaviour are unchanged; WebMCP tools and `window.gameclaw` are
  unchanged.

## v3.0.0 — 2026-11-14

### Added

- **Web portal** at <https://arcobalneo.github.io/gameclaw/>: every game playable free in the browser in a
  unified 2D pixel-art style (parallax, dithered glow, particles, screen shake,
  hit-stop, crisp integer scaling, Fusion Pixel font). Covers grid on the home
  page; games open in an in-page window with tabs. Mouse + keyboard
  (`1`–`9`, arrows/WASD, `Enter`/`Space`, `N`/`F`/`M`/`Esc`/`Tab`), chiptune SFX,
  responsive layout, reduced-motion support, runs saved in `localStorage`.
- **WebMCP** tools `list_games`, `open_game`, `new_game`, `get_state`,
  `list_actions`, `act`, `recap` (registered on `document.modelContext`, with
  `navigator.modelContext` and polyfill fallbacks) plus `window.gameclaw`. Agent
  moves animate in the window the human sees. Each game window carries a
  copyable bilingual agent prompt. See `docs/web-portal.md`.
- `@gameclaw/gamekit/core` browser-safe entry and `MemorySession` (in-memory
  session with the CLI's action resolution and snapshot/restore).
- `web/` is covered by the root `pnpm check` / `pnpm test`; `web/e2e/smoke.mjs`
  is a headless Chrome smoke of all games (keyboard and agent moves). The
  built portal is published to GitHub Pages.

### Changed

- Root, gamekit, all eleven game packages, runtime versions and skill metadata
  move to `3.0.0`. Game rules are unchanged; CLI binaries behave as in 2.8.0.
- `SKILL.md` mentions browser play and WebMCP; it still keeps no game list.

## v2.8.0 — 2026-11-09

### Added

- `虾堡 (Shrimp Burger)` / `shrimp-burger`: a shift-timed burger station where
  agents catch falling ingredients and heat orbs, shoo pests, soothe unhappy
  guests, and plate burgers. Wrong ingredients never auto-fail — they still
  enter the stack and reshape a deterministic taste threshold; fusion lanes can
  spawn hybrids; heat bands differ per recipe.

### Changed

- The catalog lists eleven games and the release matrix builds 55 artifacts
  (11 games × 5 platforms). CI and release workflows continue to discover games
  from the workspace.
- Root, gamekit, all eleven game packages, runtime versions and skill metadata
  move to `2.8.0`. `SKILL.md` remains list-free.

All notable changes to `gameclaw` are documented here.

## v2.7.0 — 2026-11-04

### Added

- `虾跃 (Shrimp Leap)` / `shrimp-leap`: a 45-level action and growth game about
  a jelly creature crossing an ever-extending street lamp by lamp. Choose a
  nature and color, then combine power, angle and timing into deterministic
  discrete jumps using public physics forecasts.
- Four build stats, spark-funded training, growth at 15 and 30 clears, increasing
  vision and street speed, and same-nature offline slime encounters with a
  three-beat rescue minigame. No network connection or real-time input is used.
- Legal actions expose their real consequences and `next` recommends a current
  line. Recaps distinguish ordinary falls, exhaustion and rescue falls with the
  exact level, action, landing error, stamina and rescue tension.
- Engine and CLI coverage for action honesty, same-seed replay, builds, physics,
  street extension, growth, complete wins, offline rescue, endings and recaps.

### Changed

- The catalog lists ten games and the release matrix builds 50 artifacts
  (10 games × 5 platforms). CI and release workflows continue to discover games
  from workspace packages without a hardcoded game list.
- Root, gamekit, all ten game packages, runtime versions and skill metadata move
  to `2.7.0`. `SKILL.md` remains list-free.

## v2.6.0 — 2026-11-04

### Fixed

- 虾闹 mid-run recaps now preserve `ongoing` and report 季中 progress instead of
  an abort. Night-finishing act events retain the night and action-budget count
  where the action actually ran; explicit aborts and terminal outcomes remain
  distinct.
- 虾写 no longer offers investigation without 2 silver or a lethal dig at 1
  life. Other silver-priced actions follow the same affordability filtering.
- 虾守 clamps leak damage at zero integrity, so pulse events and status metrics
  agree and reaching zero still loses the run.
- 虾抓 timeline entries now use the same turn number as the live act response.
- 虾看 makes `next` progress through record, archive claim and verified extract
  priorities instead of repeatedly recommending inspect.
- Mid-run recap adapters in 虾写, 虾素 and 虾征 also preserve `ongoing` rather
  than misreporting an abort.

### Changed

- 虾写 recommends useful local investigation, verification, supported digs,
  income and supplies; the price-rise log now says the next food bag costs 4
  silver.
- 虾守 leads deployment choices with current lane pressure and distinguishes
  regular pulses from the cleanup tail waves in setup guidance.
- 虾潜 explicitly marks an adjacent responder's objective-interaction collision
  as lethal regardless of the exposure meter.
- 虾素 recommends an available settlement ahead of hold.
- Root, gamekit, all nine game packages, runtime versions and skill metadata move
  to `2.6.0`. `SKILL.md` remains list-free.

## v2.5.0 — 2026-11-03

### Breaking

- Renamed the complete catalog to the Shrimp series. Game ids, source
  directories, package names, binaries, save/report namespaces, and release
  assets now use the new ids; no old-id asset aliases are shipped.

| Old id | New id |
| --- | --- |
| `lobster-cli-roguelike` | `shrimp-trek` |
| `lobster-cli-tower-defense` | `shrimp-guard` |
| `lobster-cli-heist` | `shrimp-heist` |
| `lobster-cli-tamer` | `shrimp-catch` |
| `lobster-cli-sideways-look` | `shrimp-look` |
| `lobster-cli-ink` | `shrimp-ink` |
| `pumpkin-rampage` | `shrimp-rampage` |
| `vege-life` | `shrimp-greens` |
| `tiny-conquest` | `shrimp-conquest` |

### Changed

- Display names are `虾走 (Shrimp Trek)`, `虾守 (Shrimp Guard)`,
  `虾潜 (Shrimp Heist)`, `虾抓 (Shrimp Catch)`, `虾看 (Shrimp Look)`,
  `虾写 (Shrimp Ink)`, `虾闹 (Shrimp Rampage)`, `虾素 (Shrimp Greens)`, and
  `虾征 (Shrimp Conquest)` across the catalog, runtime banners, reports, and
  documentation.
- Rewrote `docs/NAMING.md`: every new game must use a two-character `虾×`
  Chinese title, a Title Case `Shrimp <Word>` English title, and the matching
  `shrimp-<word>` machine id. Intentional series refreshes may make documented
  breaking id renames.
- Bumped the root package, every workspace package, every game runtime, and the
  skill metadata to `2.5.0`.

## v2.4.0 — 2026-11-03

### Added

- `璿芃攻略 (Tiny Conquest)` / `tiny-conquest`: a 52-week miniature campaign.
  Choose one of three giant kingdoms and conquer it through war or diplomacy.
  Buy rations at home or steal leftovers that giants blame on mice; meet helpful
  and hostile people; combine frames, heads and drives into honest tiny weapons.
- Discovery branches into two deterministic terminal minigames: route selection
  plus countdown dodges, or cursor timing, combos and counters. Capture offers
  signal, ransom and seeded rescue attempts before the captive ending.
- War, pact, deadline, starvation, captive and abort settlements, plus the
  `鏡國` reversal in which the conquered kingdom looks like璿芃's own tiny home.
- Engine and CLI tests cover same-seed replay, legal actions, supplies, weapon
  drafts, both minigames, rescue, all ending gates and a legal diplomatic run.
- `docs/NAMING.md`: frozen legacy machine ids, short kebab-case ids for new
  games, lobster-series naming, and the `中文名 (English Name)` display form.

### Changed

- Catalog display metadata, runtime definitions and per-game README titles now
  agree. `lobster-cli-ink` is `Lobster Sideways Ink`; existing heist, tower
  defense and sideways-look display mismatches are corrected. All legacy ids,
  directories, binaries and release asset names remain unchanged.
- The catalog lists nine games and the release matrix contains 45 artifacts.
- Root, every workspace package, every game runtime version and the skill
  metadata move to `2.4.0`. `SKILL.md` still contains no game list.

## v2.3.0 — 2026-11-03

### Added

- `素食人生` / `vege-life`: a sixteen-seat vegetarian life. The opening roll
  picks gender, personality and household. The protagonist chose to be
  vegetarian — this is not a prenatal diet. Meat households can stack a clash
  that ends in `冲突` or a cutoff; vegetarian households may still disagree on
  why, and have to name that gap before `分席`. A bite of meat buys the table
  and costs body plus stance; it does not feed you. Living through all sixteen
  seats without settling is a loss (`没收束`).
- Four wins: `自席` (your own table), `同桌` (a truce at home), `外席` (a
  repeatable script outside), `分席` (a vegetarian house that said the
  disagreement out loud).
- Engine and CLI tests for both households, the clash path, the creed-gap
  settlement, the other endings, dice events and same-seed replay.

### Changed

- `catalog/games.json` now lists eight games; the release matrix builds 40
  artifacts (8 games × 5 platforms).
- Root `package.json`, every game package and each game's `GAME_VERSION` move
  to `2.3.0`. Gameplay of the existing seven games is unchanged.
- Root `README.md`, `README.zh-CN.md`, architecture and release docs count eight
  games. `SKILL.md` no longer embeds a game list or a count: agents query the
  latest GitHub Release, then `catalog/games.json` on `main`. READMEs are only
  a supplement. `validate-catalog` rejects a skill that hardcodes a shipped id.

## v2.2.0 — 2026-11-02

### Added

- `横着写` / `lobster-cli-ink`: an eighteen-act investigation narrative. Six
  sites, three starting profiles (believer / skeptic / scribe), twelve one-shot
  conversations, and a buried brush that only surfaces at the true site with
  enough belief or proof. Belief finds leads faster and swallows false ones;
  proof verifies leads and unlocks a skeptic's pen. Every write adds ink debt:
  backlash from 3, a life per act from 5, and a `墨噬` ending at 6.
- Nine endings: `执笔` / `证笔` / `售笔` / `封笔` / `寻笔` / `劝世` / `墨尽` /
  `墨噬` / `收壳`; selling the brush is the safest payout and the lowest score.
- Engine tests (19) covering determinism, action space, travel economy, lead
  verification, dig gating, pen probing, debt backlash, all settle branches and
  abort; CLI tests (6) for `new / act / recap / abort` and same-seed replay.

### Changed

- `catalog/games.json` now lists seven games; release matrix builds 35 artifacts.
- Root `README.md`, `README.zh-CN.md`, `SKILL.md` and all game packages move to
  `2.2.0`.

## v2.1.0 — 2026-11-01

### Added

- `南瓜大暴走` / `pumpkin-rampage`: a four-night pumpkin-field action game.
  Four nights × six actions on one shared stamina bar; probe plots to reveal
  four monster kinds and three moods, soothe them with candy / song / pat, and
  grow four pumpkins before dawn. Night 3 is a full rampage: after every action
  all monsters swap plots, so scouted information expires immediately.
- Deterministic replay tests for the new game (`--seed` → identical status and
  action list), plus CLI coverage for illegal actions, stamina cost, recap and
  abort.

### Changed

- `catalog/games.json` now lists six games; release matrix builds 30 artifacts.
- Darwin release jobs build on `macos-15`; the previous `macos-14` image is in
  scheduled brownout before its 2026-11-02 retirement, which silently cancelled
  every macOS job and skipped the publish step.
- Root `README.md`, `README.zh-CN.md` and `SKILL.md` list `pumpkin-rampage`.

## v2.0.0 — 2026-10-18

The TypeScript/gamekit rewrite. Everything below is user-visible; see
`docs/plans/2026-10-18-v2-cross-platform-normalization.md` for the full plan.

### Added

- `@gameclaw/gamekit`: one agent-first CLI runtime shared by every game
  (`new / status / actions / act / recap / saves / play / observer / doctor`).
- `--json` envelopes with stable error codes and exit codes for machine players.
- Deterministic sfc32 RNG with serialised state, so any run can be replayed.
- Unified save slots under `~/.gameclaw/<game-id>/`, NDJSON journals, a local
  observer daemon and self-contained HTML/Markdown settlement reports.
- Windows x64, Linux arm64 and macOS x64 builds (five platforms per game).
- Aggregate `SHA256SUMS` on every GitHub Release.
- `SKILL.md` network troubleshooting: GitHub520 hosts refresh first, then proxy,
  then mirror, with explicit verification steps.

### Changed

- All five games rewritten as strict TypeScript packages with zero third-party
  runtime dependencies.
- Text output now uses stable `GAME / STATE / STAT / ACTIONS / NEXT` anchors.
- Game binaries are built with Bun `build --compile` instead of Nuitka / Node SEA.
- Release assets renamed to `<game-id>-<platform>.(tar.gz|zip)`.

### Removed

- Python, `uv`, `pyproject.toml`, `uv.lock`, Nuitka and the per-game Python
  build scripts.
- Ink/React/rot-js and the old standalone Node CLI for `sideways-look`.
- Per-game `game_catalog/` files, superseded by `catalog/games.json`.
- v0.x `--quick-start`, `--script`, `--terminal-native` flags. Use
  `new / act / recap` instead.

### Migration notes

- v1/v0.2 saves are **not** migrated. Old releases keep working; v2 starts fresh.
- Replace `--script 1,2,1` with explicit `act <action-id>` calls.
- Use `--state-dir <path>` to isolate runs in CI or evals.

## Legacy 0.x history (archive)

The entries below describe the Python-era implementation and are kept for
traceability only. They do not describe the current code.

## 2026-06-02

### `lobster-cli-tamer` v0.2.7 (续) — 区域解锁修复

v0.2.7 首发后手动玩推到 deepest=10 击败 BOSS 10 (珊瑚帝王蟹 Lv13), 但 unlocked_zones 未变。原因是 `_abyss_loop` 退出时未调 `check_zone_unlock`。

- **Fix: `game.py _abyss_loop` 退出时调 `check_zone_unlock`**
  - 退深渊后调 check_zone_unlock (之前只野外探索退出时调)
  - 新解锁区域立刻 write_save

- **Bug 验证**: 玩家在 deepest=10 退出深渊后, 区域 deep_current_canyon 正确解锁

- 测试: 3 个新测试 (test_abyss_zone_unlock_v027.py)
- 76 个测试全绿 (73 + 3)

### `lobster-cli-tamer` v0.2.7 — AI/低等级玩家进一步友好

派大虾 v0.2.6 手动玩发现 Lv5 vs Lv5 同级怪仍过于兇猛 (12 击退 1 怪但我方也死)。v0.2.7 进一步让怪 Lv 低于我方以保证可持续战斗。

- **ai_easy 怪 Lv 锁: party_max_lv → party_max_lv - 1**
  - 之前 Lv5 队伍 vs Lv5 怪(同級), 互伤后中变不变
  - 现在 Lv5 队伍 vs Lv4 怪, 我方永远优势
- **ai_easy BOSS Lv 锁: party_max_lv + 5 → + 3**
  - 之前 BOSS 10 (珊瑚帝玉蟹) Lv 35 vs 队伍 Lv 10 等级差 +25 (困难)
  - 现在 BOSS 10 Lv 13 vs Lv 10 队伍 等级差 +3 (可挑战)
- **level_scaling_per_floor: 0.6 → 0.4**
  - 10 层野怪 Lv = 5 + 10*0.4 = 9 (之前 11)
  - 30 层 Lv = 17 (之前 23)

- 测试: 测试名称从 test_level_scaling_06 改为 test_level_scaling_04
- 73 个测试全绿

### `lobster-cli-tamer` v0.2.6 — reef_shrimp 初始强化 + ai_easy 怪 Lv 锁

派大虾 v0.2.5 手动玩试了几局, 发现 Lv5 reef_shrimp base HP 40 太脆弱, 野外抓怪 2 轮就死。v0.2.6 调整两点:

- **species/reef_shrimp base_stats**:
  - HP 40 → 60 (+50%)
  - ATK 25 → 30 (+20%)
  - DEF 18 → 20 (+11%)
  - SPD 48 → 50 (+4%)
  - END 18 → 22 (+22%)

- **ai_easy mode 怪 Lv 锁**: party_max_lv + 1 → party_max_lv
  - 之前 +1 让怪偶尔比我方高 1 级, Lv5 vs Lv6 难以抓
  - 现在 锁到队伍 Lv, 怪永远不比我方强, AI/低等级玩家可稳定推进

- 测试: 2 个新测试 (test_reef_shrimp_v026.py)
- 73 个测试全绿 (71 + 2)

### `lobster-cli-tamer` v0.2.5 — 深渊数值平衡调整 + 死档脏数据修复

派大虾 v0.2.4 在手动玩 1.5 小时后最深 5 层, BOSS 10 推不到。分析后发现 v0.2.4 的深渊数值过于严苛,给人类玩家挑战能测出极致但也打不到 BOSS 10。v0.2.5 重新平衡数值,同时修一个死档脏数据 bug。

#### 数值调整 (仅影响深渊, 不影响 normal mode)

- **plague_max_rate: 0.5 → 0.25**
  - 之前 10 层+ 死亡率达 50% (BOSS 10 = 50% 必死几只)
  - 现在 10 层+ 死亡率 25% (BOSS 10 25%, 仍会扣几但可玩)

- **plague_rate_per_floor: 0.05 → 0.03**
  - 之前 5 层 25% / 7 层 35%
  - 现在 5 层 15% / 7 层 21% / 10 层 25% (capped)

- **taint_to_plague_threshold: 3 → 5**
  - 之前 3 层 normal 累积污染自动转化疫病
  - 现在 5 层才转化,给玩家多 2 层缓冲

- **level_scaling_per_floor: 0.8 → 0.6**
  - 之前 BOSS 10 怪等级 = 5 + 10*0.8 = 13
  - 现在 BOSS 10 怪等级 = 5 + 10*0.6 = 11
  - 我方养成 Lv10 仍可打

- **normal 净疫盐补给: 0-1 → 1-2**
  - 之前 normal 0-1, 50% 概率无补给
  - 现在 1-2, 100% 补给 1 个, 50% 补给 2 个
  - 野外养成不再卡 "没 cure_plague 不能推进"

#### Bug 修复

- **towertower._on_floor_end 清理逻辑: `c.hp_current <= 0` 也清理**
  - 之前只清 `c.dead=True` 的怪, 战斗中 HP=0 但未被标记 dead 的脏数据占着 party 槽位
  - 现在 HP=0 一律清埋 + memorial
- **save.py cleanup_dead_creatures 同样补 HP=0 清理**
  - 防御性,主菜单存档时也清

#### 测试

- 7 个新测试 (test_tower_balance_v025.py)
- 1 个老测试更新 (taint 阈值从 3 改 5)
- 71 个测试全绿 (64 + 7)

#### Plan

- 下一轮手动玩 推到 BOSS 10 解锁"深流峡谷"

### `lobster-cli-tamer` v0.2.4 — 主菜单用药

派大虾 v0.2.3 在 AI 友好模式实玩中又发现：potion_minor 在 items 数据里被发放 3 个，但主菜单里没有 UI 入口，AI 自动化 / 人类玩家都无法用，导致多次战斗后血线衰减后无法回血。

- **New: 主菜单选项 8=用药**
  - 消耗 1 个 potion_minor
  - 给队伍中所有活的 / 未满血 的虾米回 30% 最大 HP
  - 多个虾米同时回血
  - 队伍满血时也会显示“已满血”提示
  - potion 耗尽时提示"没有 potion_minor 了！"

- **New: `game.py` 新增 `_use_potion` 方法**

- **New: tests/test_potion_main_menu.py 加 3 个测试**
  - test_potion_heals_active_party: 1 只 20% HP → 50% HP
  - test_potion_heals_multiple_creatures: 3 只同时回
  - test_potion_fails_when_empty: potion 耗尽返回 False

- **Fix: tests/test_terminal_native_cli.py 主菜单 action 字符串**
  - 从 "...,7=存档,q=退出" 改为 "...,7=存档,8=用药,q=退出"

- 64 个测试全绿 (61 + 3 新)

### `lobster-cli-tamer` v0.2.3 — AI 友好模式 `--ai-easy`

派大虾 v0.2.2 在 AI 自动化实玩中遇到设计层问题：Lve5 礁虾打 Lv10 怪需要 14 回合，Lv10 一击秒 Lv5。AI 自动化无脑 1 攻击策略无法稳定推进。human 玩家可以通过走位/调换/词条策略玩。决定**不污染** normal mode balance，而是加 AI 友好模式 flag。

- **New: `--ai-easy` flag 启动选项**
  - 野外怪 Lv 锁 ≤ 队伍最高 Lv + 1
  - BOSS 怪 Lv 锁 ≤ 队伍最高 Lv + 5
  - 敌怪对我方伤害 ×0.5
  - normal mode 行为 100% 不变

- **New: GameOptions.ai_easy, BattleState.ai_easy, WorldSession.ai_easy, TowerSession.ai_easy**
  - 全部默认 False
  - 传递链: parse_options → Game → WorldSession/TowerSession → encounter/BattleState

- **New: tests/test_ai_easy.py 加 6 个测试**
  - 验证 GameOptions/BattleState/WorldSession/parse_options/encounter 的 ai_easy 行为

- 61 个测试全绿 (55 + 6 新)

#### Plan

- `docs/plans/2026-06-02-lobster-cli-tamer-ai-easy-mode.md`
- 关联: `docs/plans/2026-06-02-lobster-cli-tamer-ai-automation-limits.md`

### `lobster-cli-tamer` v0.2.2 — 没网也涨 pity

派大虾在 v0.2.1 二进制实玩中又发现: c 试捕 fast path 调 `_handle_capture` 内部 `consume_item`，如果没捕捉球了 `consume_item` 失败 early return，但 `consume_capture_tool_pity` 放在 `_handle_capture` 之后调也被跳过，导致玩家卡在“没 net + 战斗不赢 = pity 不涨 = 永不再补给”的状态。

- **Fix: world.py battle_turn 把 `consume_capture_tool_pity` 移到 `_handle_capture` 之前**
  - v0.2.1 把 `consume_capture_tool_pity` 放在 `_handle_capture` 之后，导致没网时 `_handle_capture` 早出跳过 pity 调。
  - v0.2.2 修复: 不管 `_handle_capture` 内部是否早出，都先调 `consume_capture_tool_pity(None)` 涨 pity。这样 c 1 试捕多次失败后能触发保底补给。

- **New: tests/test_battle_dead_cleanup.py 加 test_capture_no_net_still_increments_pity**
  - 覆盖 v0.2.2 的没网也涨 pity 逻辑。

### `lobster-cli-tamer` v0.2.1 — 保底补给贯穿主菜单

派大虾在 v0.2.0 二进制实玩中又发现: c 1 试捕失败路径不走 _roll_battle_loot也不调 consume_capture_tool_pity，导致 capture_tool_pity 不会涨。

- **Fix: world.py battle_turn c 试捕失败也调 consume_capture_tool_pity**
  - 之前 v0.2.0 在 c 试捕成功路径补 loot + cleanup，但失败路径也不调 pity 计算。
  - v0.2.1 修复: 试捕行动总是调 save.consume_capture_tool_pity(None)，让 c 1 试捕反复失败的 pity 递增能触发保底补给。

- **Fix: game.py _main_menu 每轮都调 _grant_emergency_net_if_needed**
  - 之前只在加载存档时补给一次。主菜单每轮调，能及时补给已涨 pity 后的玩家。

- **New: tests/test_battle_dead_cleanup.py 加 test_capture_consume_pity_涨_补_网**
  - 覆盖 v0.2.1 的 pity 涨 + 保底补给逻辑。

### `lobster-cli-tamer` v0.2.0 — 完整解锁核心 loop (野外死怪清埋 + BOSS 护盾衰减 + box 调换菜单 + BOSS 战 q 退 + 野外 loot + 保底补给)

完整修复了派大虾在 2026-06-01 两轮实测中触发的所有 P0/P1 死局，以及后续在 v0.1.9 实玩中又发现的 loot 路径 BUG 和保底补给逻辑 BUG。

#### v0.1.8

- combat.py take_damage 统一设 dead=True (HP<=0)
- world.py _on_battle_end 统一清埋 dead
- combat.py _tick_status_both 每回合 shield_hp *= 0.5
- game.py _main_menu 加 6 调换队伍
- game.py _swap_menu 新增方法
- save.py cleanup_dead_creatures helper
- game.py _abyss_loop BOSS 战 q 退到主菜单
- game.py _skill_choice_prompt 明确替换提示
- uv.lock 一致性 (PyPI 锁定)
- scripts/test-game.sh + build-game.sh 修 --locked 错位
- 新增 52 个测试

#### v0.1.9

- combat.py _apply_skill HP<=0 时统一设 dead=True (野外不依赖 is_tower)
- world.py battle_turn 每回合 cleanup_dead_creatures
- 加测试 test_battle_turn_中间就清埋_dead_creatures

#### v0.2.0 (这个版本)

- **Fix: world.py battle_turn 捕捉成功路径也走 loot + cleanup**
  - 派大虾用 v0.1.9 实玩时发现只 c 1 试捕不消耗回合的路径不走 _on_battle_end也不调 _roll_battle_loot,导致只打 5-6 场战斗后 0 补给,playable 仍受限。
  - 修复:在 _handle_capture 后检查 battle_engine 是否清空(抓成功 = 战斗结束),清空则走 cleanup + loot。

- **Fix: game.py _grant_emergency_net_if_needed 改为 pity-based 补给**
  - 旧逻辑要求 capture_total == 0 才补给,玩家如果刚开始有 5 个 net,全用完后永远不再补给,致永不能再抓怪。
  - 改用 capture_tool_pity >= 3 触发补给 + 重置 pity。

### `lobster-cli-tamer` v0.1.9 — battle_turn 立即清埋 + 野外 dead 标记 (完整修复)

- **Fix: combat.py _apply_skill 现在 HP<=0 时统一设 dead=True**
  - 旧实现: `if defender.hp_current <= 0 and st.is_tower: defender.dead = True`
  - v0.1.8 commit 有这行 `and st.is_tower` 检查，所以野外战斗中死掉的怪 dead=False。实际 GitHub release v0.1.8 仍未修野外路径。
  - v0.1.9 修复: 去掉 `and st.is_tower`，无论深渊/野外，HP<=0 时都设 dead=True。
  - 这是 v0.1.8 commit 注释里写了但实际代码没改完的最后一道。

- **Fix: world.py battle_turn 立即 cleanup_dead_creatures**
  - v0.1.8 commit 写了 world.py _on_battle_end 统一清埋，但战斗中自动换手时死掉的怪没机会走 _on_battle_end（战斗还在继续）。
  - v0.1.9 修复: 在 battle_turn 的 run_turn 之后、state.is over() 检查之前，先调 save.cleanup_dead_creatures(cause="野外战斗")，让战斗中死掉的怪立即被释放。
  - 表现: 野外战斗中抓新怪能在当前战斗中填入之前战斗中死亡的怪留下的空槽。

### `lobster-cli-tamer` v0.1.8 — Bug fix release (unlocks the core loop)

- **Fix: battle_turn 每回合后立即 cleanup_dead_creatures**
  - 派大虾🦞 在 2026-06-01 用 v0.1.8 二进制跑第二轮实测中触发了续问题：战斗中自动换手后死掉的怪 (dead=True HP=0) 仍然占着 save.party 槽位，因为 _on_battle_end 只在 state.is_over() 时才触发。
  - 修改 `world.py battle_turn`: 在 run_turn 之后、state.is_over() 检查之前，先调 save.cleanup_dead_creatures(cause="野外战斗")，让战斗中死掉的怪立即被释放。
  - 表现: 野外抓到新怪后能在当前战斗中填入之前战斗中死亡的怪留下的空槽，无需等到主菜单才被清理。

### `lobster-cli-tamer` v0.1.8 — Bug fix release (unlocks the core loop)

- **Fix: 野外战斗死亡的虾米永远不清埋 (P0)**
  - `combat.py take_damage` 现在统一在 HP<=0 时把 `dead=True`，不再仅在 `is_tower=True` (深渊) 时设。
  - `world.py _on_battle_end` 新增统一的 `_cleanup_dead_creatures` 流程：胜利 / 全灭都会把死掉的虾米入纪念碑并释放 party 槽位。
  - 现象：玩家抓到 5 只新怪却装不进 6 槽，因为前 5 只在野外战斗死掉后仍占着 party 槽位不释放。修复后野外死了会自动清理，玩家可以正常补抓与推进。
  - Plan: `docs/plans/2026-06-02-lobster-cli-tamer-bugfix-and-unblock.md`

- **Fix: 珊瑚帝王蟹 BOSS “珊瑚壁垒” 护盾无上限累积 (P0)**
  - `combat.py _tick_status_both` 现在每回合把 `shield_hp *= 0.5` 衰减 (下限 0)，避免护盾类技能每回合叠加后普通攻击永远破不了。
  - 现象：BOSS 战护盾堆到 2463 都不衰减，与玩家战斗死循环。修复后护盾几回合后趋近稳定点，能被普通攻击逐步打破。

- **New: box 调换菜单 (P1)**
  - 主菜单多了一个选项 `6 调换队伍 (与仓库互换)`，可以从 party 选一只退到 box，也可以从 box 选一只调入 party。
  - 现象：原来主力全死后 box 里的 43 只怪取不出，玩家永远不能继续。修复后玩家能主动重组队伍。
  - 实现：`game.py _swap_menu` 新增方法；`save.py cleanup_dead_creatures` 复用了同一个 helper。

- **Fix: BOSS 战中 q 退到主菜单 (P1)**
  - `game.py _abyss_loop` 战斗菜单 BATTLE_MENU 多了一个选项 `q 放弃本局深渊 (结算疫病骰后退出)`，避免 BOSS 战死循环下只能 `tmux kill` 强退。
  - 代价：会走 `tower._settle_plague()` + `total_abyss_runs++`，与正常退深渊一致。

- **New: 主菜单存档时清理 dead 状态 (P1)**
  - `7 存档` 选项现在在写盘前会调 `save.cleanup_dead_creatures(cause="存档清理")`，防止各种边界场景下“死了但未清理”状态累积。

- **Improvement: SKILL_CHOICE 替换提示更明确 (P1)**
  - 当 `len(creature.moves) >= 4` 时，技能候选打印前先 `warn("⚠ 当前技能已满 4 个。选 1-3 后会被询问「替换第几个技能 1-4」。")`，提醒 agent / 玩家记得后续还要发替换序号。

- **Test infra: pytest 接入 + `test-game.sh` 修 bug (P2)**
  - `games/lobster-cli-tamer/pyproject.toml` 新增 `test` extra（`pytest>=8.0`）。
  - `scripts/test-game.sh` 修复两处 bug：
    - `ROOT_DIR` 推导少了 `/..`（曾把 game id 解析到 `scripts/games/...`）。
    - 原用 `unittest discover` 找不到 pytest 装饰器 + 裸函数，现在改为 `python -m pytest tests -v`。
  - `scripts/test-game.sh` 现在装 `--extra test`。
  - 新增测试 3 个：
    - `tests/test_battle_dead_cleanup.py` (4 个用例)
    - `tests/test_shield_decay.py` (3 个用例)
    - `tests/test_swap_menu.py` (3 个用例)
  - 所有 51 个测试全绿。

- **Verified end-to-end**: 派大虾🦞 在 2026-06-01 的两轮真实游玩中触发的所有死局都已被本次 v0.1.8 修复解开，下一步是用新版本真实推进到“解锁深流峡谷”再回头补发补丁。

## 2026-03-13

### New game: `lobster-cli-heist`
- Added `games/lobster-cli-heist/` as a full new game source tree with packaging, tests, live observer server, per-game catalog metadata, and distribution docs
- Shipped a playable stealth-heist vertical slice: compact 2x7 side-strip facilities, `facility / security / objective / complication` mission grammar, three profiles, and real extraction pressure after the pickup
- Added `--seed`, `--quick-start`, `--profile`, `--script`, `--verbose-text`, `--no-settlement-report`, default localhost observer boot, honest aborted-run handling, and HTML settlement reports

### Catalog / release distribution follow-up
- Added `lobster-cli-heist` to `catalog/games.json`, `SKILL.md`, `README.md`, and `README.zh-CN.md`
- Expanded the root GitHub release workflow matrix so GameClaw now builds and ships all three lobster games on Linux x86_64 and macOS arm64
- Updated release-flow docs and the root `uv` workspace metadata so the new game follows the same monorepo build / test / release entrypoints

### New game: `lobster-cli-tower-defense`
- Added `games/lobster-cli-tower-defense/` as a full new game source tree with packaging, tests, per-game catalog metadata, and distribution docs
- Shipped a playable single-stage vertical slice: pulse-based CLI tower defense, one map, three doctrines, six deployables, five enemy types, deployment / recall windows, and honest leak-based settlement
- Added compact lane render, scripted input support, `--quick-start`, `--seed`, `--doctrine` / `--lineage`, `--verbose-text`, and `--no-settlement-report`
- Added memory-first settlement output plus HTML settlement reports for won / lost / aborted endings

### `lobster-cli-tower-defense` follow-up iteration
- Refactored the tower-defense slice into clearer layers: `stages.py` for stage data, `simulation.py` for rule resolution, and a slimmer `game.py` focused on CLI flow
- Added doctrine-specific simulation coverage plus scripted regression baselines for `oracle`, `crusher`, and `gambler`
- Adjusted support-platform coverage so `LP` / `RP` behave more like side-watch positions instead of trivially seeing through the entire middle front slot
- Verified the follow-up through repo-level tests, targeted scripted smoke, and real playtests before release

### Catalog / release distribution
- Added `lobster-cli-tower-defense` to `catalog/games.json`, `SKILL.md`, `README.md`, and `README.zh-CN.md`
- Expanded the root GitHub release workflow matrix so GameClaw now builds and ships both lobster games on Linux x86_64 and macOS arm64
- Updated release-flow docs to keep asset names, build entrypoints, and player-facing instructions aligned with the actual repo contents

### Repository / design docs
- Replaced the old GDC reference track with a single canonical design authority document: `docs/references/ai-native-game-design-rules.md`
- Corrected the design canon toward **gameplay-first / memory-first / agent-first**, explicitly removing benchmark-first framing
- Updated `AGENTS.md` so future game design work must read the single design-rules document first
- Added local Forge feedback log at `docs/forge-feedback-log.md` to preserve user comments and recurring product signals

### `lobster-cli-roguelike` gameplay improvements
- Rebalanced key encounters including `拖网阴影`, `电鳗裂隙`, `塑料垃圾流`, and `归海闸口`
- Strengthened lineage/build identity while reducing over-generic oracle play
- Changed memory prompts from fake certainty (`更稳/容易翻车`) to honest run-scoped observations (`本局观察 / 下局再验证`)
- Added build observations to mutation flow and settlement prompts
- Improved failure and settlement copy so runs are easier to review and learn from

### Repetition / pacing follow-up
- Added lightweight `潮势` to create more carry-over rhythm between reading-the-water actions and harder follow-up actions
- Added recent-encounter suppression so runs are less likely to hit the same encounter back-to-back in the mid/late phase
- Added mid-phase / late-phase prompts to make a single cycle feel less like repeated button drills

### Scripted-play / QA improvements
- Replaced scripted-input `EOFError` crashes with an explicit **aborted settlement** path
- Settlement output now supports `won / lost / aborted` endings
- Updated tests and CLI/README documentation to match the new gameplay and abort behavior

### Repo hygiene
- Added ignore rules for generated `settlement_reports/` artifacts so review/playtest output stays out of commits by default
