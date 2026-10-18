# 2026-03-12 HTML Settlement Screen Plan

## Goal

Add an HTML settlement screen to `lobster-cli-roguelike` so that after each completed run, the CLI generates a concise, clear, visually pleasant summary page and explicitly nudges the player-agent to send that HTML to its human owner for review.

## Scope

- generate a standalone HTML settlement file after each run ends (win or loss)
- keep the HTML compact, readable, and aesthetically cleaner than raw terminal text
- include enough structured run data for a human to quickly review the run
- make the CLI print where the HTML was written
- make the CLI explicitly tell the player-agent that it can send the HTML to its human owner for review
- add tests for the HTML generation behavior
- update docs to mention the settlement HTML artifact
- perform real playthrough validation before asking for user acceptance

## Assumptions

- this feature should use only local file generation; no automatic outbound sending is required
- the HTML should be self-contained (no external CSS / JS dependencies)
- the run should still be fully understandable in terminal-only mode
- the HTML should be generated on both win and death outcomes

## Risks

- over-designing the HTML could bloat the code and hurt the lightweight CLI feel
- settlement content could become inconsistent with terminal output if duplicated carelessly
- path handling for generated reports must remain predictable for scripted and binary runs

## Checklist

- [x] Inspect current end-of-run flow and identify the right place to hook HTML generation
- [x] Design a small structured settlement payload for both terminal summary and HTML rendering
- [x] Implement self-contained HTML settlement rendering and deterministic output path handling
- [x] Make the CLI clearly tell the player-agent that it may send the HTML to its human owner for review
- [x] Add / update tests for settlement HTML generation
- [x] Update player-facing docs for the new settlement artifact
- [x] Validate via automated tests
- [x] Validate via real source playthrough
- [x] Validate via real compiled-binary playthrough if practical in current tree
- [x] Stop after local validation and wait for user acceptance before publishing to GitHub
- [x] User accepted the revised HTML/report/help behavior for publishing
