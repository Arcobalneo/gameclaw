# Plan — rebuild round, coil, and sum

Date: 2026-11-14 · Status: in progress

## Goal

Bring `claw-round`, `claw-coil`, and `claw-sum` up to the shipped scenes'
standard: a painted set, bespoke sprites, idle motion, and hit or fail effects.
The other three owned games (berth, delve, fair) follow in a second change.
Reef, lamp, raft, stow, and glass are another lane.

## Scope

- Round: a wrong pocket now ends the tide, matching the written rule.
- Coil: the solution path is no longer stored on the save. Suggest searches.
  Each direction says whether it pushes the crate.
- Scenes, covers, and the zh/en lines those rules add.
- Do not merge, deploy, or tag.

## Checklist

- [x] Engines and tests
- [x] Scenes and covers
- [x] `pnpm lint && pnpm check && pnpm test && pnpm validate:catalog`
- [x] Portal build
- [x] One played loop per game
