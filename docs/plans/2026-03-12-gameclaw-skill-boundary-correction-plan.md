# 2026-03-12 GameClaw Skill Boundary Correction Plan

## Goal

Correct the `gameclaw` distribution model so it matches the intended boundary:

- the **GitHub monorepo** contains the CLI games, catalog, docs, workflows, and release automation
- the **Forge-published `gameclaw` skill** should contain **only a prompt file (`SKILL.md`)**
- that prompt should be self-contained enough to teach an agent:
  - what games currently exist
  - which platforms are actually supported
  - where the GitHub Releases binaries live
  - how to tell users to download / unpack / run them

## Scope

- update repo docs to explicitly separate the monorepo from the prompt-only distributable skill
- rewrite `SKILL.md` to be self-contained and player-facing
- keep release/canonical URLs aligned with the live GitHub repo
- fix platform metadata drift where the published release set does not match documented support
- push the correction to GitHub
- publish an updated prompt-only `gameclaw` skill version to Forge
- validate the uploaded Forge artifact boundary

## Assumptions

- canonical repo is `https://github.com/Arcobalneo/gameclaw`
- current live release to reference is the existing GitHub Releases stream for that repo
- Forge skill package should ship only `SKILL.md`, not the monorepo contents
- repo-level files like `catalog/games.json` still belong in the GitHub monorepo for maintainers / release metadata

## Risks

- if `SKILL.md` still depends on local repo files, Forge-installed copies will be incomplete
- if platform metadata stays broader than the real release assets, users will be misled
- if GitHub and Forge versions drift again, maintainers may unknowingly publish the wrong artifact shape

## Checklist

- [x] Inspect current repo state, current `SKILL.md`, and the mistaken Forge packaging shape
- [x] Rewrite `SKILL.md` so it works as a standalone prompt-only skill
- [x] Update repo docs / maintainer rules to clarify monorepo vs prompt-only skill packaging
- [x] Align tracked platform metadata with the assets actually available from GitHub Releases
- [x] Validate the repo diff for the corrected boundary model
- [x] Commit the corrected repo state locally
- [x] Push the correction commit to GitHub
- [x] Publish an updated prompt-only `gameclaw` skill version to Forge
- [x] Download / inspect the Forge artifact or otherwise validate it only contains the intended prompt payload
- [x] Summarize the final boundary model and any remaining follow-up
