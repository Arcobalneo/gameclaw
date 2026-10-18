# 2026-03-12 GameClaw README Overhaul Plan

## Goal

Rewrite the root `README.md` so the GitHub repository presents like a real, polished project page rather than an internal note dump.

## Scope

- replace the current root README with a stronger public-facing project narrative
- make the first screen clearly answer: what GameClaw is, who it is for, what is playable now, and how releases work
- present the split between the GitHub monorepo and the prompt-only Forge skill in a cleaner, less confusing way
- add practical sections for players, maintainers, and contributors
- keep claims aligned with the live repo / release state
- update any supporting docs that would otherwise contradict the new README wording

## Assumptions

- canonical repo is `https://github.com/Arcobalneo/gameclaw`
- canonical release page is `https://github.com/Arcobalneo/gameclaw/releases/latest`
- currently published release assets for `lobster-cli-roguelike` are `linux-x86_64` and `darwin-arm64`
- this change is documentation-focused and should not alter game logic or release automation behavior

## Risks

- over-polishing could drift into marketing fluff and reduce technical clarity
- README claims could become inconsistent with `catalog/games.json` or release docs
- if platform support is described inaccurately, GitHub visitors will get a broken first impression

## Checklist

- [ ] Inspect current README and adjacent docs for contradictions / stale claims
- [ ] Rewrite `README.md` into a public-facing project page with strong information hierarchy
- [ ] Keep the monorepo-vs-skill boundary clear without making the introduction feel internal or defensive
- [ ] Align platform / release wording with the current live release reality
- [ ] Update supporting docs if the new README would otherwise conflict with them
- [ ] Review the rendered structure and wording for GitHub readability
- [ ] Commit the README overhaul
- [ ] Push to GitHub for user review
