# Plan — rebuild berth, delve, and fair

Date: 2026-11-14 · Status: ready for review

## Goal

Bring `claw-berth`, `claw-delve`, and `claw-fair` up to the shipped scenes'
standard: a painted set, bespoke sprites, idle motion, and hit or fail effects.
Round, coil, and sum are a separate pull request. Reef, lamp, raft, stow, and
glass are another lane.

## Scope

- Berth: a docked ship stays four tides, and a new ship is a hazard half the
  time. Suggest should beat both waiting and grabbing the first legal berth.
- Delve: a sideways dig says when the next cell holds ore. The shaft scene
  exposes brace as a click, not only a listed action.
- Fair: the price rules stay. The stall gets its own set so yesterday, purse,
  and stock are readable on the canvas.
- Covers and the zh/en lines those rules add.
- Do not merge, deploy, or tag.

## Assumptions

- `GAME_VERSION` stays `4.0.0`.
- Shared files stay append-only. This change does not add a game id.

## Risks

- A docked ship that stays longer can fill the harbor and force a wait. The
  seed sweep has to show suggest still clears the quota more often than the
  first legal berth.
- New canvas words have to exist in the catalogs or they vanish in English.

## Checklist

- [x] Berth rule and seed test
- [x] Delve ore detail and brace hit
- [x] Three scenes, HUD, and react effects
- [x] Covers recaptured
- [x] `pnpm lint && pnpm check && pnpm test && pnpm validate:catalog`
- [x] Portal build
