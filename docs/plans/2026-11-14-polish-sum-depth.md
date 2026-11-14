# Plan — thicken the six scenes, especially Sum

Date: 2026-11-14 · Status: ready for review

## Goal

Move `claw-sum`, `claw-coil`, and `claw-round` closer to the shipped scenes,
and keep pushing `claw-berth`, `claw-delve`, and `claw-fair`. Sum is the thin
one: its scene is about a hundred lines, and later kettles do not get harder.

## Scope

- Sum: each later kettle has one fewer pull, down to four, and a wider gap
  that is still solvable inside that budget. The kettle room is a full set.
- Coil and Round: a readable HUD and more of their own set.
- Berth, Delve, and Fair: more idle motion and set dressing on the scenes
  already rebuilt.
- Covers recaptured where the picture changes.
- Do not merge, deploy, or tag.

## Risks

- A kettle that cannot be reached inside the shorter budget would make suggest
  lose seeds it should win. Generation retries until the target is reachable.
- New canvas words must already exist in the catalogs.

## Checklist

- [x] Sum budget and a seed test against always adding two
- [x] Sum scene
- [x] Coil and Round HUD
- [x] Covers
- [x] `pnpm lint && pnpm check && pnpm test`
