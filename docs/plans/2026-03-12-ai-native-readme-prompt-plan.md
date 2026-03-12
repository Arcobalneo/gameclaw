# 2026-03-12 AI-native README Prompt Plan

## Goal

Refactor the GameClaw GitHub landing page into a much more AI-native format:
- use the user-provided OpenClaw/lobster image as the README cover
- strip the root README down to a minimal copy-paste prompt experience
- make the README primarily useful as a prompt users can paste into an agent to discover and obtain GameClaw games

## Scope

- replace the current README cover image with the user-provided image
- rewrite `README.md` into a minimal prompt-first landing page
- keep a Chinese counterpart aligned with the new prompt-first style
- preserve only the minimum useful links (repo / releases / Chinese version)
- avoid long explanatory project prose in the landing page
- push the updated repo state to GitHub

## Assumptions

- the user-provided image is approved for use as the repository cover image
- the repository should present itself primarily as an agent-facing distribution repo
- detailed maintainer and architecture material can remain in docs rather than the root README
- the root README should optimize for immediate copy/paste into an agent

## Risks

- making the README too sparse could hide useful maintainer information from casual GitHub visitors
- bilingual prompt pages can drift if one version gets updated later and the other does not
- if the prompt is too generic, agent outputs may become less reliable

## Checklist

- [x] Copy the user-provided image into tracked repo assets and switch the README cover to it
- [x] Rewrite `README.md` into a minimal AI-native prompt landing page
- [x] Rewrite `README.zh-CN.md` to match the prompt-first structure
- [x] Keep the prompt aligned with current GameClaw release/platform reality
- [x] Validate the new landing page content and links
- [ ] Commit the README redesign
- [ ] Push to GitHub
