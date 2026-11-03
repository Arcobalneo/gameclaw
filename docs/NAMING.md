# Naming convention

Every GameClaw game belongs to the Shrimp series. Chinese name, English name,
machine id, source path, package, executable, and release assets are one
coordinated identity rather than independent branding layers.

## Shrimp-series names are mandatory

- The Chinese title is exactly two characters: `虾` plus one verb or noun
  character, such as `虾走` or `虾写`.
- The English title uses Title Case and the form `Shrimp <Word>`, such as
  `Shrimp Trek` or `Shrimp Ink`.
- The machine id is `shrimp-<english-keyword>`: lowercase kebab-case, with the
  final keyword matching the English title's second word. Current keywords are
  `trek`, `guard`, `heist`, `catch`, `look`, `ink`, `rampage`, `greens`, and
  `conquest`.
- Whenever both display names appear, use **`虾× (English Name)`**, for example
  `虾走 (Shrimp Trek)`. This is the required per-game README title and the
  preferred paired form in user-facing documentation.
- `tagline` and `summary` describe gameplay; they are not part of either title.

New games MUST join this series. Choose the Chinese character, English keyword,
and machine id together; do not introduce a separate legacy or unprefixed id.

## Machine artifacts must agree

For each entry in `catalog/games.json`, all of the following must use the same
`shrimp-<english-keyword>` id:

- catalog `id` and `binary`;
- `source_dir`, as `games/<id>`;
- package name, as `@gameclaw/<id>`;
- compiled executable name;
- release assets, as `<id>-<platform>.tar.gz` or `<id>-<platform>.zip`.

The runtime `meta.id`, `meta.name`, and `meta.englishName` must exactly equal
the catalog values. The CLI derives help, banners, observer metadata, and
settlement reports from those fields, so a game must not invent another display
title.

The root `SKILL.md` is not a naming registry. It must discover the live list
from GitHub Releases and `catalog/games.json`, not embed ids or display names.

## Intentional identity refreshes

Breaking machine-id renames are allowed when the series identity is
intentionally refreshed. Coordinate the directory, package, binary, catalog,
and every release asset in the same change; do not keep shipping aliases under
old asset names. Document the complete old-to-new mapping in `CHANGELOG.md` and
the release notes.

### v2.5.0 migration

| Old id | New display name | New id |
| --- | --- | --- |
| `lobster-cli-roguelike` | `虾走 (Shrimp Trek)` | `shrimp-trek` |
| `lobster-cli-tower-defense` | `虾守 (Shrimp Guard)` | `shrimp-guard` |
| `lobster-cli-heist` | `虾潜 (Shrimp Heist)` | `shrimp-heist` |
| `lobster-cli-tamer` | `虾抓 (Shrimp Catch)` | `shrimp-catch` |
| `lobster-cli-sideways-look` | `虾看 (Shrimp Look)` | `shrimp-look` |
| `lobster-cli-ink` | `虾写 (Shrimp Ink)` | `shrimp-ink` |
| `pumpkin-rampage` | `虾闹 (Shrimp Rampage)` | `shrimp-rampage` |
| `vege-life` | `虾素 (Shrimp Greens)` | `shrimp-greens` |
| `tiny-conquest` | `虾征 (Shrimp Conquest)` | `shrimp-conquest` |

## Onboarding check

1. Choose a `虾×` Chinese title, a Title Case `Shrimp <Word>` English title, and
   the matching `shrimp-<word>` id.
2. Add matching `id`, `name`, `englishName`, `source_dir`, `binary`, and release
   assets to the catalog.
3. Copy those exact id/title values into `GameDefinition.meta` and use the id in
   the package name and build script.
4. Title the Chinese per-game README `虾× (Shrimp <Word>)` and keep mechanics in
   that README rather than expanding the title.
5. Run `pnpm validate:catalog`, build the real binary, and check `help`,
   `--version`, the observer, and the settlement report.
