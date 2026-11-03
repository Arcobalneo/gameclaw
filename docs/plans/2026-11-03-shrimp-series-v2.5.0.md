# Shrimp-series rename and v2.5.0

## Goal

Rename all nine games to the approved `虾× / Shrimp … / shrimp-<word>` identity,
including display names, machine ids, source directories, package names,
binaries, and release assets, and release the coordinated version as 2.5.0.

## Scope

- Move all nine `games/<old-id>` directories with `git mv`.
- Update the catalog, workspace manifests and lockfile, game metadata, runtime
  branding, tests, active documentation, tooling configuration, and workflows.
- Replace the legacy-id policy in `docs/NAMING.md` with the mandatory Shrimp
  series convention and document the breaking mapping in `CHANGELOG.md`.
- Keep `SKILL.md` free of game lists.
- Leave historical `docs/plans/**` and `docs/archive/**` bodies unchanged unless
  a change is needed for the migration record itself.
- Commit the validated result locally on `rename/shrimp-series-v2.5.0`; do not
  push, open a pull request, tag, or create a release.

## Approved mapping

| Old id | Chinese | English | New id |
| --- | --- | --- | --- |
| lobster-cli-roguelike | 虾走 | Shrimp Trek | shrimp-trek |
| lobster-cli-tower-defense | 虾守 | Shrimp Guard | shrimp-guard |
| lobster-cli-heist | 虾潜 | Shrimp Heist | shrimp-heist |
| lobster-cli-tamer | 虾抓 | Shrimp Catch | shrimp-catch |
| lobster-cli-sideways-look | 虾看 | Shrimp Look | shrimp-look |
| lobster-cli-ink | 虾写 | Shrimp Ink | shrimp-ink |
| pumpkin-rampage | 虾闹 | Shrimp Rampage | shrimp-rampage |
| vege-life | 虾素 | Shrimp Greens | shrimp-greens |
| tiny-conquest | 虾征 | Shrimp Conquest | shrimp-conquest |

## Assumptions

- This is an intentional breaking rename: no old-id aliases or old release asset
  names will be shipped.
- Old ids and names may remain only in historical plans/archives and in explicit
  migration records such as this plan, the changelog, and naming policy.
- Gameplay mechanics and narrative content remain unchanged except where text
  embeds a game's old title or machine id.
- All workspace packages, including gamekit, move to version 2.5.0.

## Risks

- Renamed workspace paths can leave stale pnpm importers or lockfile entries.
- Catalog-derived build matrices must agree with package scripts and executable
  names, especially Windows asset suffixes.
- Tests and runtime reports may assert old ids, banners, or save/report labels.
- Broad textual replacement must not rewrite historical archives or accidentally
  change narrative words unrelated to branding.

## Checklist

- [x] Audit the clean branch, catalog, manifests, active references, and nested
  repository instructions.
- [x] Move all nine game directories with `git mv`.
- [x] Update catalog ids, names, paths, binaries, and release asset names.
- [x] Set every workspace package and game definition to the new identity and
  version 2.5.0; update package build arguments.
- [x] Update game READMEs, tests, embedded runtime branding, Biome ignores,
  gamekit examples, scripts, and CI/workflow references.
- [x] Rewrite `docs/NAMING.md`, add the v2.5.0 changelog entry dated 2026-11-03,
  and update both root READMEs and other active maintainer documentation.
- [x] Refresh the workspace with `pnpm install` and inspect the resulting diff.
- [x] Run `pnpm validate:catalog`, `pnpm lint`, `pnpm check`, and `pnpm test`;
  fix all rename-related failures.
- [x] Build and exercise representative real binaries, including a full
  `new → act → recap` loop and observer/report checks because executable names
  and packaging metadata changed.
- [x] Audit residual old-id/display-brand references, allowing only historical
  records and explicit migration documentation.
- [x] Review `git status` and the final diff, remove generated artifacts not
  needed for the change, and prepare one clear local commit.

## Validation

- `pnpm install` refreshed all nine game importers in `pnpm-lock.yaml`.
- `pnpm validate:catalog` passed: nine games × five platforms.
- `pnpm lint`, `pnpm check`, and `pnpm test` passed: 21 test files, 211 tests.
- `node scripts/build-game.mjs shrimp-heist` produced `shrimp-heist` v2.5.0 and
  `shrimp-heist-linux-x64.tar.gz`; the archive contains the new directory and
  executable names.
- The compiled binary completed `new → act choose:runner → act abort → recap`.
  The observer responded with HTTP 200 during the run and stopped at run end.
  HTML and Markdown reports were written beneath the new `shrimp-heist` state
  directory, with `虾潜` and `Shrimp Heist` in the HTML report.
- `node scripts/build-game.mjs shrimp-heist --platform windows-x64 --no-archive`
  compiled the foreign executable successfully. Windows zip packaging could not
  be exercised because this environment has no `zip` executable; the normal
  archived cross-build reached packaging and failed with `spawnSync zip ENOENT`.
- Old ids remain only in historical plans/archives and the explicit mapping in
  this plan, `docs/NAMING.md`, and current/historical changelog entries.
- Generated binaries, archives, and smoke state were removed after validation.
