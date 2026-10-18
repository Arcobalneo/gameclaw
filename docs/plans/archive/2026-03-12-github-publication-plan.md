# 2026-03-12 GameClaw GitHub Publication Plan

## Goal

Publish the local `gameclaw` repository to the authenticated GitHub account as a **public** repository, with repo metadata and player-facing links pointing at the real GitHub location.

## Scope

- create the GitHub repository `Arcobalneo/gameclaw`
- replace placeholder GitHub URLs in tracked repo metadata/docs
- validate tracked content is consistent before push
- push the repo to GitHub
- create a release tag so the existing workflow can build and publish release assets
- monitor the initial release workflow and surface any blocking issue

## Assumptions

- `gh` is installed and authenticated as `Arcobalneo`
- publishing this repository publicly is explicitly authorized by the user
- repo name should be `gameclaw`

## Risks

- placeholder URLs left behind could ship broken player instructions
- first release workflow could fail on one or more runners/platforms
- release tag timing matters; tag should point at the final publication commit

## Checklist

- [ ] Inspect GitHub auth, repo state, and placeholder URLs
- [ ] Add a publication plan document
- [ ] Replace tracked placeholder GitHub URLs with `https://github.com/Arcobalneo/gameclaw`
- [ ] Validate repo state after metadata/doc updates
- [ ] Commit the publication updates
- [ ] Create public GitHub repository and add remote
- [ ] Push branch and tags to GitHub
- [ ] Create/push initial release tag
- [ ] Monitor initial GitHub Actions release workflow
- [ ] Confirm published repo/release URLs back to the user
