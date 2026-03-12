# 2026-03-12 GameClaw Bilingual README + Repo Polish Plan

## Goal

Upgrade the GameClaw repository from a merely acceptable public repo into a more polished, credible GitHub project page and distribution repo.

## Scope

- turn the root README experience into a stronger project landing page
- provide a bilingual README setup for English and Chinese readers
- add at least one relevant visual asset to improve GitHub presentation
- fix the most visible repository inconsistencies discovered during repo review
- tighten release / platform / run-instruction accuracy across player-facing files
- push the full polish pass to GitHub for review

## Assumptions

- `README.md` should remain the primary GitHub landing page
- Chinese should be provided as a parallel README document rather than hidden in a long mixed-language block
- canonical repo is `https://github.com/Arcobalneo/gameclaw`
- current publicly available player assets are `linux-x86_64` and `darwin-arm64`
- if a target is not actually shipping, public docs should not imply it is ready

## Risks

- visual polish can become noisy if the image feels unrelated or too large
- bilingual docs can drift if structure differs too much between language versions
- repo-level fixes may span multiple files and must remain internally consistent
- changing workflow targets affects future release behavior and should match actual support intent

## Checklist

- [x] Inspect current public-facing files and identify the highest-value polish fixes
- [x] Add a lightweight visual asset for the GitHub README experience
- [x] Rewrite `README.md` into a more polished primary landing page
- [x] Add `README.zh-CN.md` as the Chinese counterpart and cross-link the two versions
- [x] Fix inaccurate player-facing run instructions across tracked files
- [x] Align release/platform claims and workflow targets with actual support intent
- [x] Update adjacent docs / skill files that would otherwise drift from the new README
- [x] Validate the resulting repo state and key user path assumptions
- [ ] Commit the repo polish pass
- [ ] Push to GitHub
- [ ] Report what was improved and what still remains as future work
