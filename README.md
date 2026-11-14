# GameClaw

<p align="center">
  <img src="docs/assets/gameclaw-cover.png" alt="GameClaw cover" width="900" />
</p>

<p align="center">
  <strong>Eleven pixel games. A human and an agent share the same run.</strong>
</p>

<p align="center">
  <a href="https://arcobalneo.github.io/gameclaw/"><strong>Play</strong></a> ·
  <a href="README.zh-CN.md">中文</a> ·
  <a href="SKILL.md">Skill</a> ·
  <a href="docs/">Docs</a>
</p>

The site is <https://arcobalneo.github.io/gameclaw/>. You play in the browser.
Your agent plays the same window through Web MCP: tools in the page, or the
remote relay when the agent is on a desktop. There is no install and no CLI.

The homepage has a block you can paste to an agent. It points at
[`SKILL.md`](SKILL.md), the live site, and the session token already in your
browser. The agent must discover games from the site or from
[`catalog/games.json`](catalog/games.json). This README's table is a snapshot.

A 中 / EN switch in the top right localizes the site, the in-game text, and
the canvas labels. Chinese names stay on the 虾× scheme.

## Paste this to an agent

```text
Read https://github.com/Arcobalneo/gameclaw/blob/main/SKILL.md and follow it.
Open https://arcobalneo.github.io/gameclaw/ with me.
Discover the games from the live site or catalog/games.json. Do not use a memorized list.
Play only through Web MCP, on the session token I paste from the page.
```

Then paste the block the homepage gives you. It has the token.

## The games

| Id | Name | What you do |
|---|---|---|
| `shrimp-trek` | 虾走 Trek | Tide-cycle roguelike. Bank your fame, or live through the sea gate. |
| `shrimp-guard` | 虾守 Guard | Three lanes. A leak costs more than three kills. |
| `shrimp-heist` | 虾潜 Heist | Read patrols, take the real target, leave quietly. |
| `shrimp-catch` | 虾抓 Catch | Catch, raise, and take the abyss. Depth is the score. |
| `shrimp-look` | 虾看 Look | Record the anomaly. A wrong file opens the door and scores almost nothing. |
| `shrimp-rampage` | 虾闹 Rampage | Find, soothe, and harvest before dawn. Blind soothes waste the crop. |
| `shrimp-ink` | 虾写 Ink | A pen that makes writing real. Verify it, seal it, or sell it for less. |
| `shrimp-greens` | 虾素 Greens | Sixteen meals. Host your own table. Biting meat is expensive. |
| `shrimp-conquest` | 虾征 Conquest | One year, a tiny weapon, a giant kingdom. Mirror outranks war. |
| `shrimp-leap` | 虾跃 Leap | Power, angle, timing. Only a perfect extends the streak. |
| `shrimp-burger` | 虾堡 Burger | Catch the falling fixings. A lucky bite does not build the streak. |

Each game's ladder rule is in the catalog (`score`) and in the in-game help.

## Leaderboards

At the end of a win or a loss you can submit a display name. That score is kept
if it is your best on that game. The big board on the homepage is the sum of
each name's bests across games. A lower resubmit does not change rank. No login.
The only stored identity is the name you type.

`get_leaderboard` and `submit_score` are the same actions for an agent.

## For agents

[`SKILL.md`](SKILL.md) is the skill. It does not list games.

Tools: `list_games`, `open_game`, `new_game`, `get_state`, `list_actions`,
`act`, `recap`, `get_leaderboard`, `submit_score`, `set_language`.

Remote MCP: `https://gameclaw-relay.arcobalneo.workers.dev/mcp` with
`Authorization: Bearer <token>`.

## Develop

```bash
pnpm install
pnpm lint && pnpm check && pnpm test
pnpm --filter @gameclaw/web dev
```

Engines live in `games/<id>/` and are deterministic libraries. The portal is
`web/`. The relay is `relay/` (Cloudflare Workers + Durable Objects). See
[`docs/repository-architecture.md`](docs/repository-architecture.md) and
[`docs/web-portal.md`](docs/web-portal.md).

Publishing the site is a manual copy of `web/dist` to `gh-pages`. Publishing
the relay is `wrangler deploy` in `relay/`, which applies the `v3` Durable
Object migration for leaderboards. Workflow files in `.github/workflows` still
describe the old CLI build and must be retired before any release tag.
