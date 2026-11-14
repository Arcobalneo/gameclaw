# Plan — glass feel

Date: 2026-11-15 · Status: in progress

## Goal

Bring `claw-glass` up to the same bar as the other four games in this lane:
a moon court you can read, and a turn that is not handed to you.

## Scope

- Engine, tests, scene, zh/en catalog, cover, README, CHANGELOG.
- `meta.version` `4.1.0`. Package version stays `4.0.0`.
- No CLI. No `SKILL.md` ids. Do not merge, deploy, or tag.

## Rules after this change

- Three mirrors and one beam. Turning spends a beat and the cloud steps.
- A mirror the cloud is sitting on cannot be turned that beat.
- Half of seeds mirror the court, so the same puzzle family is not the same
  picture. The action list stays turn, fire, wait. It does not lead with the
  search.

## Scoring

Unchanged. One fault still costs more than two shrines.

## Checklist

- [x] This plan
- [x] Engine, tests, scene, catalog, cover, README
- [x] CHANGELOG
- [x] `pnpm lint && pnpm check && pnpm test && pnpm validate:catalog`
- [x] `pnpm --filter @gameclaw/web build`
- [x] Human click and Web MCP `new_game → act → recap`
