# Plan — jam batch: lamp, raft, stow, glass

Date: 2026-11-14 · Status: implemented in this change

## Goal

Ship slate entries 13–16 at the current library bar. Lane A owns 1–12 and 17–19.
This change does not implement 虾掘, 虾市, or 虾礁.

## Scope

- `claw-lamp` 虾灯 (Claw Lamp)
- `claw-raft` 虾筏 (Claw Raft)
- `claw-stow` 虾仓 (Claw Stow)
- `claw-glass` 虾镜 (Claw Glass)
- Append-only registration: catalog, registry, card copy, i18n index,
  `relay/src/games.ts`, `relay/src/headless.ts`, covers plan, README tables,
  CHANGELOG, NAMING keywords, AGENTS count.
- `GAME_VERSION` stays `4.0.0`. No CLI. No `SKILL.md` ids. Do not merge, deploy, or tag.

## Assumptions

- Present state is public. The next crate, gust, order, or cloud step is the
  uncertainty, and `detail` states the consequence of the action in front of the agent.
- One `act` is one decision.
- A careful line beats a careless line on most seeds. One listed mistake costs
  more than two of that game's clean successes.
- Names, titles, and writing are original. The slate verbs are the only borrowed idea.

## Rules

- Lamp: posts light pools along open sight. Two lanterns that see each other cannot both stand. Tide is short, so a wasted post is not free to undo.
- Raft: stash the crate port, mid, or starboard, then the known gust resolves. A heavy side dumps. Shift spends a hand and does not load the crate.
- Stow: shelve a glyph or pull the bay an order names. The next two events are in the status. A wrong pull costs more than two correct ones. Unordered crates spoil off the shelf without counting as a mispick.
- Glass: three mirrors and one beam. Turning spends a beat and advances the cloud. Firing into the shrine clears the court. A miss costs more than two shrines.

## Checklist

- [x] This plan
- [x] Engines, tests, scenes, zh/en catalogs, covers, READMEs
- [x] Catalog, registry, card copy, headless, allowlist
- [x] README snapshot, CHANGELOG, NAMING keywords, AGENTS count
- [x] `pnpm lint && pnpm check && pnpm test && pnpm validate:catalog`
- [x] `pnpm --filter @gameclaw/web build`
- [x] One `new_game → act → recap` loop per game through the dev server
