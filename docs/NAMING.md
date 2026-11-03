# Naming convention

GameClaw has two naming layers: permanent machine identifiers and changeable
display metadata. Never sacrifice an installed binary or a released asset to
make a display name look tidier.

## Machine names are compatibility contracts

- Existing game ids, source directories, package directory names, binary names,
  archive names and release asset names are **frozen**. This includes every
  legacy `lobster-cli-*` id and the unprefixed `pumpkin-rampage` / `vege-life`
  ids.
- Do not rename an existing id merely to match a new display convention. Saves,
  installed commands, downloaded assets and external automation refer to it.
- A new game id is a short English `kebab-case` phrase, normally two or three
  words, such as `tiny-conquest`.
- New games outside the lobster series must not use `lobster-cli-`. A new game
  that genuinely belongs to that series may use the prefix; its English display
  name must then begin with `Lobster` and follow the established
  `Lobster Sideways …` series form.
- The catalog `id`, catalog `binary`, game directory, package directory and
  compiled executable must agree. Release assets remain
  `<id>-<platform>.tar.gz` or `<id>-<platform>.zip`.

## Display names come from the catalog

For each entry in `catalog/games.json`:

- `name` is a short Chinese title, without a subtitle, colon, gameplay summary
  or the word `CLI` added as decoration.
- `englishName` is a Title Case English title. Lobster-series titles use the
  same `Lobster …` series identity in the catalog, package metadata, README,
  runtime definition and help/settlement output.
- The paired display form is **`中文名 (English Name)`**. Use it at the start of
  the per-game README and anywhere a document shows both names. A gameplay
  subtitle belongs in a separate line, not in `name`.
- `tagline` and `summary` describe the game; they are not part of either title.
- The runtime `meta.name` and `meta.englishName` must exactly equal the catalog
  values. The CLI derives help, banners, observer metadata and settlement
  reports from those fields, so a game must not invent a second display title.

The root `SKILL.md` is not a naming registry. It must discover the live list
from GitHub Releases and `catalog/games.json`, not embed ids or display names.

## Onboarding check

1. Choose the id and confirm that no compatibility-sensitive existing name is
   being repurposed.
2. Add matching `id`, `name`, `englishName`, `source_dir`, `binary` and release
   assets to the catalog.
3. Copy those exact id/title values into `GameDefinition.meta`.
4. Title the Chinese per-game README `中文名 (English Name)` and keep mechanics
   in that README rather than expanding the title.
5. Run `pnpm validate:catalog`, build the real binary, and check `help`,
   `--version`, the observer and the settlement report.
