---
name: gameclaw
description: "Play GameClaw with a human who has the site open. Use when someone asks which GameClaw games exist, wants an agent to play, or needs the remote MCP URL and session token. Discover games from the live site or catalog/games.json. This skill does not list them. Play only through Web MCP."
version: 4.0.0
---

# GameClaw

GameClaw is a site where a human and an agent share one run. The human watches
(or plays) the page. The agent uses Web MCP: in-page tools when it can see the
tab, or the remote relay when it is a desktop agent.

This file does not list games. Lists go stale. Look them up.

- Site: `https://arcobalneo.github.io/gameclaw/`
- Skill: `https://github.com/Arcobalneo/gameclaw/blob/main/SKILL.md`
- Catalog: `https://raw.githubusercontent.com/Arcobalneo/gameclaw/main/catalog/games.json`
- Repo: `https://github.com/Arcobalneo/gameclaw`

There is no CLI and no download. Do not install a binary, do not look for
release assets, and do not build from source to play.

## 1. Discover the current games

Every time the player asks what exists, read one of these. Do not answer from
memory of this file.

1. The live site. `list_games` on the page or the relay returns ids, names and goals.
2. The catalog on `main`: `games[].id`, `name`, `englishName`, `tagline`, `summary`, `score`.
   `score.zh` / `score.en` is the ladder rule for that game.

```bash
curl -fsSL https://raw.githubusercontent.com/Arcobalneo/gameclaw/main/catalog/games.json
```

If the site and the catalog disagree, say so. Play what `list_games` returns
on the open page.

## 2. Connect

The human copies a prompt from the homepage or from a game window. It contains:

- the MCP URL (Streamable HTTP)
- a session token (no login)
- a room code
- the page URL

Send `Authorization: Bearer <token>` on every request. The token is a secret
for that browser session. Do not post it in a public channel.

Default relay: `https://gameclaw-relay.arcobalneo.workers.dev/mcp`

If their tab is open, tools run there and they see every move. If no tab is
connected, do not stop: the run still plays. Every play result includes
`watch_url`. Tell the human to open that URL and watch. It is a normal page
link with the room code, not the bearer token. When they open it, the page
shows the game in progress.

## 3. Play

Tools:

`list_games`, `open_game`, `new_game`, `get_state`, `list_actions`, `act`,
`recap`, `get_leaderboard`, `submit_score`, `set_language`

1. `open_game` with an id from `list_games`. The open page focuses that game,
   including from the homepage. If no page is open, the run still starts.
2. `new_game` to start. Optional `seed` and `difficulty`.
3. Read state and actions. `act` exactly one `action_id`. Read the log.
4. Repeat until `outcome` is not `ongoing`.
5. If the result includes `watch_url` and the human is not already watching,
   remind them to open it.
6. `recap`. If the run was won or lost and the score is above 0, `submit_score`
   with a display name the human chose.
7. `get_leaderboard` with no id reads the site total. Pass `game_id` for one game.

`set_language` is `zh` or `en`. It changes the page the human is looking at.

Same seed + same actions + same game version = the same run.

## 4. Leaderboard

Each name keeps its **best** score on each game. A lower resubmit does not
change rank. The site board is the sum of those bests. Aborted runs cannot be
submitted. The score is taken from the finished run; do not invent one.

Names are 1–16 characters: letters, numbers, spaces, `_`, `-`, `.`, `·`.

## 5. Boundaries

- Do not edit the player's shell, hosts file, or PATH for GameClaw. There is
  nothing to install.
- Do not claim a game exists unless `list_games` or the catalog lists it.
- GameClaw does not store strategy. The recap offers one-run observations.
  The agent writes anything worth keeping into its own memory, and labels it
  as something to check next run.
- This file is the skill source. Do not publish a second copy that adds a
  game list.
