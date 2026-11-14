# Plan — raft and stow feel

Date: 2026-11-15 · Status: in progress

## Goal

Bring `claw-raft` and `claw-stow` up to the same bar as the rebuilt reef and
lamp boards: a bespoke pixel scene, and a turn that is a real choice.

## Scope

- Engines, tests, scenes, zh/en catalogs, covers, READMEs, CHANGELOG.
- `meta.version` `4.1.0`. Package version stays `4.0.0`.
- No CLI. No `SKILL.md` ids. Do not merge, deploy, or tag.

## Rules after this change

- Raft: the gust and the next gust are both visible. A crate placed on the
  side it prefers does not add lean. A crate placed on the other side adds 1
  to the next gust toward that side. Mid still ignores lean and holds 4.
  The heavy side still dumps, and 6 still capsizes. Actions stay
  port, mid, starboard, shift.
- Stow: some orders are for the crate that just arrived, and some are for a
  crate that has to wait through two more slips. The next three slips are in
  the status. A mark is worth spending only when the visible order arrives
  after the spoil age. Actions stay in bay order.

## Scoring

Unchanged. One dump still costs more than two cargo. One mispick still costs
more than two right pulls.

## Checklist

- [x] This plan
- [x] Raft engine, tests, scene, catalog, cover, README
- [x] Stow engine, tests, scene, catalog, cover, README
- [x] CHANGELOG
- [x] `pnpm lint && pnpm check && pnpm test && pnpm validate:catalog`
- [x] `pnpm --filter @gameclaw/web build`
- [x] Human click and Web MCP `new_game → act → recap` on both games
