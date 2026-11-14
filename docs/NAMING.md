# Naming convention

Every GameClaw game belongs to the Claw series. Chinese name, English name,
machine id, source path, and package are one coordinated identity.

## Claw-series names are mandatory

- The Chinese title is exactly two characters: `虾` plus one verb or noun
  character, such as `虾走` or `虾写`.
- The English title uses Title Case and the form `Claw <Word>`, such as
  `Claw Trek` or `Claw Stamp`.
- The machine id is `claw-<english-keyword>`: lowercase kebab-case, with the
  final keyword matching the English title's second word. Current keywords are
  `trek`, `guard`, `heist`, `catch`, `look`, `ink`, `rampage`, `greens`,
  `conquest`, `leap`, `burger`, `stamp`, `melt`, `net`, `beat`, `count`,
  `mask`, `clock`, `flip`, `round`, `coil`, `sum`, and `berth`.
- Whenever both display names appear, use **`虾× (English Name)`**, for example
  `虾走 (Claw Trek)` or `虾印 (Claw Stamp)`. This is the required per-game
  README title and the preferred paired form in user-facing documentation.
- `tagline` and `summary` describe gameplay; they are not part of either title.

New games MUST join this series. Choose the Chinese character, English keyword,
and machine id together; do not introduce a separate legacy or unprefixed id.

## Machine artifacts must agree

For each entry in `catalog/games.json`, all of the following must use the same
`claw-<english-keyword>` id:

- catalog `id`;
- `source_dir`, as `games/<id>`;
- package name, as `@gameclaw/<id>`;
- the portal scene `web/src/games/<id>.ts`;
- the headless definition in `relay/src/headless.ts`;
- the allow-list in `relay/src/games.ts`.

The runtime `meta.id`, `meta.name`, and `meta.englishName` must exactly equal
the catalog values. The page and the agent tools use those fields, so a game
must not invent another display title.

The root `SKILL.md` is not a naming registry. It must discover the live list
from the site or `catalog/games.json`, not embed ids or display names.

## Former ids

Eleven games shipped first as `shrimp-*`. Those ids remain aliases. The map
lives in [`catalog/legacy-ids.json`](../catalog/legacy-ids.json):

| Former id | Current id | English name |
| --- | --- | --- |
| `shrimp-trek` | `claw-trek` | `虾走 (Claw Trek)` |
| `shrimp-guard` | `claw-guard` | `虾守 (Claw Guard)` |
| `shrimp-heist` | `claw-heist` | `虾潜 (Claw Heist)` |
| `shrimp-catch` | `claw-catch` | `虾抓 (Claw Catch)` |
| `shrimp-look` | `claw-look` | `虾看 (Claw Look)` |
| `shrimp-rampage` | `claw-rampage` | `虾闹 (Claw Rampage)` |
| `shrimp-ink` | `claw-ink` | `虾写 (Claw Ink)` |
| `shrimp-greens` | `claw-greens` | `虾素 (Claw Greens)` |
| `shrimp-conquest` | `claw-conquest` | `虾征 (Claw Conquest)` |
| `shrimp-leap` | `claw-leap` | `虾跃 (Claw Leap)` |
| `shrimp-burger` | `claw-burger` | `虾堡 (Claw Burger)` |

`#/play/<former id>` opens the game and replaces the address with
`#/play/<current id>`. Web MCP and the headless desk accept a former id and
return the current one. A `#/watch/<room code>` page restores a run stored
under a former id into that current id. Leaderboard rows, play counts, and
saved runs stored under a former id are folded in on read. Do not add a
Durable Object migration tag for that fold.

`claw-stamp`, `claw-melt`, `claw-net`, `claw-beat`, `claw-count`, `claw-mask`,
`claw-clock`, `claw-flip`, `claw-round`, `claw-coil`, `claw-sum`, and
`claw-berth` were born on the current identity and have no former id.

## Intentional identity refreshes

Breaking machine-id renames are allowed when the series identity is
intentionally refreshed. Coordinate the directory, package, catalog, headless
definitions, and relay allow-list in the same change. Document the old-to-new
mapping in `CHANGELOG.md` and, when old URLs or stored rows must keep working,
in `catalog/legacy-ids.json`.

## Onboarding check

1. Choose a `虾×` Chinese title, a Title Case `Claw <Word>` English title, and
   the matching `claw-<word>` id.
2. Add matching `id`, `name`, `englishName`, `source_dir`, and `score` to the catalog.
3. Copy those exact id/title values into `GameDefinition.meta` and use the id in
   the package name and the portal scene.
4. Register the definition in `relay/src/headless.ts` and the id in
   `relay/src/games.ts`.
5. Title the Chinese per-game README `虾× (Claw <Word>)` and keep mechanics in
   that README rather than expanding the title.
6. Run `pnpm validate:catalog` and `node scripts/test-game.mjs <id>`.
