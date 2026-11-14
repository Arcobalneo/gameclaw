# Plan — reef and lamp feel

Date: 2026-11-15 · Status: in progress

## Goal

Bring `claw-reef` and `claw-lamp` up to the original portal bar: a bespoke
pixel scene, and a turn that is a real choice. `claw-raft`, `claw-stow`, and
`claw-glass` are the same lane and ship in later changes off `origin/main`.

## Scope

- `games/claw-reef`, `games/claw-lamp`: engines, tests, READMEs, `meta.version`
  `4.1.0` (rules changed; package version stays `4.0.0` with the repo).
- `web/src/games/claw-reef.ts`, `web/src/games/claw-lamp.ts`
- zh/en catalogs, catalog copy if the pitch changes, covers, CHANGELOG.
- No CLI. No `SKILL.md` ids. Do not merge, deploy, or tag.

## What is thin

- Both scenes are a grid, one shared shrimp, and almost no motion.
- Reef is an 8-cell chart with two marks, and `actions` leads with a full
  search. The first id is the win.
- Lamp's widest post lights the most pools and still seals. Reading "new
  pools" is a dominant line. `actions` leads with that line.

## Rules after this change

- Reef: step, then the public tide pushes. An anchor spends one and stays.
  A mark counts only on the cell you still occupy. Landing on an urchin after
  the push is a sweep. Anchoring on an urchin braces it. The chart is 8×5
  with three marks on normal. Layouts are reshuffled until a path exists
  inside the sweep cap. Action order is compass, then anchor.
- Lamp: two posts that see each other cannot both hold a lamp. The widest
  post blocks the posts that actually seal the shoal. Tide on normal is too
  short to plant that post and still recover. `detail` names how many new
  pools and which posts this one blocks. Action order is post index, then
  seal. A careful search still wins; it is not sorted to the front.

## Scoring

Unchanged formulas. More reef marks raise the win ceiling by one mark's
90 points. Still well under the ladder cap. One sweep still costs more than
two saved anchors. One lamp lift still costs more than two saved lamps.

## Assumptions

- Present state stays public. Urchins, sight, and the tide are in `status`
  and `detail` before the act.
- Same seed + same actions + version `4.1.0` replays.
- English catalog strings contain no CJK.

## Risks

- Reef generation must not ship an unwinnable chart. The create path drops
  urchins only if eight shuffles still have no clear.
- Lamp stages are hand-built. Tests lock "widest post does not seal" and
  "careful beats planting post 0".

## Checklist

- [x] This plan
- [x] Reef engine, tests, scene, catalog, cover, README
- [x] Lamp engine, tests, scene, catalog, cover, README
- [x] CHANGELOG
- [x] `pnpm lint && pnpm check && pnpm test && pnpm validate:catalog`
- [x] `pnpm --filter @gameclaw/web build`
- [x] Human click and Web MCP `new_game → act → recap` on both games
