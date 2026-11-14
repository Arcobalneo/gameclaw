# Claw-series rename

## Goal

Rename the eleven shipped games from `shrimp-*` / `Shrimp <Word>` to `claw-*` /
`Claw <Word>`. Chinese titles stay the existing two-character `虾×` names.
Paired display stays `虾× (English)`.

## Scope

- Catalog, packages, directories, portal scenes, i18n catalogs, covers, tests,
  lockfile, and English game titles.
- `relay/src/games.ts` `GAME_IDS` and `relay/src/headless.ts` `DEFINITIONS`.
- Naming rule in `docs/NAMING.md` and the checklist in `docs/adding-a-game.md`.
- Compatibility for the live site: old `#/play/shrimp-*` URLs, Web MCP ids,
  headless desks restored by `#/watch/<room code>`, local saves, leaderboard
  rows, and play counts.

## Assumptions

- `GAME_VERSION` stays `4.0.0`. The engine contract does not change. Saved
  snapshots fail `MemorySession.restore` when `snapshot.game` is the old id, so
  restore rewrites that field before checking.
- `#/watch/<room code>` is a session code, not a game id. The watch flow
  redirects by restoring a desk stored under `shrimp-*` into the current
  `claw-*` id and then showing `#/play/<current id>`.
- Durable Object class migrations stay as they are (`v1`, `v2`, `v3`). Old
  rows are folded when the stored JSON is read. No new migration tag.
- Historical changelog entries keep the names they shipped with. The alias map
  is `catalog/legacy-ids.json`, repeated in `docs/NAMING.md` and the changelog.
- Another branch may add new `claw-*` games. This change only renames the
  eleven existing games and does not restructure unrelated code.

## Risks

- A cached old page still posts `shrimp-*`. The relay accepts those ids, stores
  them under `claw-*`, and returns the current id.
- A new page talking to an old relay would submit unknown `claw-*` ids until
  the relay deploy. The page folds old keys for display so a local cache still
  paints. Deploy the relay with the site.
- Two stored rows for one player (old id and new id) keep the higher score and
  add the attempt counts.
- A player already counted under `shrimp-*` must not be counted again. Seen
  keys stay under the old id; hello checks both.

## Checklist

- [x] Plan written before the rename
- [ ] Move game directories, scenes, catalogs, covers, and loc sources
- [ ] Replace ids and `Shrimp <Word>` titles; leave species ids and the food
      name `Classic Shrimp Burger`
- [ ] `catalog/legacy-ids.json` plus resolve-on-read for URLs, MCP, headless
      desks, local saves, boards, and play counts
- [ ] Docs: `NAMING.md`, `adding-a-game.md` (including `relay/src/headless.ts`),
      changelog mapping
- [ ] `pnpm lint && pnpm check && pnpm test && pnpm validate:catalog`
- [ ] `pnpm --filter @gameclaw/web build`
