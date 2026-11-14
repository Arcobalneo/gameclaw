# Adding or updating a game

This is the checklist for a new GameClaw game, and for a substantial rewrite of
an existing one. The product form is fixed: the engine is a deterministic
library, the human plays in the portal, and the agent plays the same session
through Web MCP. Do not add a CLI, a downloadable binary, or a second play path.

Read [`NAMING.md`](NAMING.md) and
[`references/ai-native-game-design-rules.md`](references/ai-native-game-design-rules.md)
first. For a large change, write a plan under [`plans/`](plans/).

## 1. Identity

Choose together, in one step:

- a two-character Chinese title `虾×`
- a Title Case English title `Claw <Word>`
- a machine id `claw-<word>`

The eleven games already shipped still use `Shrimp` / `shrimp-` until the
rename that is landing separately. New games use `Claw` / `claw-`.

Use that same id for the catalog row, `games/<id>/`, the package
`@gameclaw/<id>`, `GameDefinition.meta`, and `web/src/games/<id>.ts`.

Do not add the game to `SKILL.md`. Agents discover games from the live site or
`catalog/games.json`.

## 2. Engine — `games/<id>/`

```
games/<id>/
├── package.json          name: @gameclaw/<id>, scripts: check / test
├── src/                  engine, content, definition (export `definition`)
├── tests/                engine tests + ladder tests
└── README.md             title `虾× (Shrimp <Word>)`, mechanics, score, how to test
```

The game implements `GameDefinition<S>` from `@gameclaw/gamekit`. It may import
only `@gameclaw/gamekit` and its own files. No `node:` imports, no `process`, no
sockets, no HTML, no files on disk.

`recap.score` is a meaningful integer for a finished win or loss. Ongoing and
aborted runs score 0. Document the formula in the README and in the catalog
`score.zh` / `score.en` fields.

Same seed + same actions + same `GAME_VERSION` = the same run. State must be
JSON-serialisable and must include `rng: number[]`.

## 3. Catalog

Add a row to `catalog/games.json`: `id`, `name`, `englishName`, `tagline`,
`summary`, `genres`, `source_dir`, `status`, and `score`. Run
`pnpm validate:catalog`.

## 4. Portal

1. Add a lazy scene in `web/src/games/<id>.ts` and register it in
   `web/src/runtime/registry.ts`.
2. Add accent, ink, and zh/en goals and card tags in `web/src/catalog.ts`.
3. Add zh/en strings so the 中 / EN switch covers UI, actions, logs, recap, and
   any canvas text. English dictionary strings contain no Chinese characters.
4. Add a 384×216 cover at `web/public/covers/<id>.webp`.
5. Register the definition in `relay/src/headless.ts` and the id in
   `relay/src/games.ts`, so a closed tab can play and a score can be submitted.
6. Keep the homepage and window chrome concise. A human action on the page must
   have a matching Web MCP tool — usually the existing host tools are enough.

## 5. Validate

```bash
node scripts/test-game.mjs <id>
pnpm lint && pnpm check && pnpm test
pnpm --filter @gameclaw/web build
```

Play one `new_game → act → recap` loop in the dev server
(`pnpm --filter @gameclaw/web dev`), once as a human and once through the
page's MCP tools. If the score rule changed, submit a name on the board in
development and confirm `get_leaderboard` sees it.

## 6. Docs in the same change

- `games/<id>/README.md`
- the root README game table (it is a snapshot of this version; the skill stays
  list-free)
- `CHANGELOG.md`

Do not put play instructions back into the skill or invent a second catalog.
