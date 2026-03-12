# 2026-03-12 Binary Packaging Plan

## Goal

Turn `lobster-cli-roguelike` into a player-facing binary CLI release flow, verify a Linux binary locally, and document the workflow for future GameClaw distribution.

## Checklist

- [x] Confirm current repository state and target constraints
- [x] Install minimal build dependencies for local Linux binary packaging
- [x] Build a Linux native binary release artifact
- [x] Smoke test the built binary (not the source script)
- [x] Add / update maintainer docs based on what changed
- [x] Add repository operating rule for future large changes
- [x] Review git diff and summarize next release steps

## Notes

- Source repo remains open; player distribution should prefer release binaries.
- Binary packaging raises the inspection bar but does not guarantee anti-reversing.
- Future GameClaw integration should point users to GitHub Releases rather than source checkout.
- Local Linux packaging validated on 2026-03-12 with Nuitka onefile + patchelf.
- Local smoke test passed against the produced binary, not the Python source entrypoint.
