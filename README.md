# GameClaw

<p align="center">
  <img src="docs/assets/gameclaw-cover.png" alt="GameClaw cover" width="900" />
</p>

<p align="center">
  <strong>Twenty-six pixel games. A human and an agent share the same run.</strong>
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
If the page is closed, the agent can still play. Open the watch link from the
tool result to see the run.

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
| `claw-trek` | 虾走 Trek | Tide-cycle roguelike. Bank your fame, or live through the sea gate. |
| `claw-guard` | 虾守 Guard | Three lanes. A leak costs more than three kills. |
| `claw-heist` | 虾潜 Heist | Read patrols, take the real target, leave quietly. |
| `claw-catch` | 虾抓 Catch | Catch, raise, and take the abyss. Depth is the score. |
| `claw-look` | 虾看 Look | Record the anomaly. A wrong file opens the door and scores almost nothing. |
| `claw-rampage` | 虾闹 Rampage | Find, soothe, and harvest before dawn. Blind soothes waste the crop. |
| `claw-ink` | 虾写 Ink | A pen that makes writing real. Verify it, seal it, or sell it for less. |
| `claw-greens` | 虾素 Greens | Sixteen meals. Host your own table. Biting meat is expensive. |
| `claw-conquest` | 虾征 Conquest | One year, a tiny weapon, a giant kingdom. Mirror outranks war. |
| `claw-leap` | 虾跃 Leap | Power, angle, timing. Only a perfect extends the streak. |
| `claw-burger` | 虾堡 Burger | Catch the falling fixings. A lucky bite does not build the streak. |
| `claw-stamp` | 虾印 Claw Stamp | Twelve ferry passes. An edge fare pays more and costs a strike. |
| `claw-melt` | 虾熔 Claw Melt | Drop shells in a tide well. Only side-by-side shells melt. |
| `claw-net` | 虾网 Claw Net | Tie the tears, or haul before the net rips. |
| `claw-beat` | 虾节 Claw Beat | A four-beat phrase. Two edits, then commit. |
| `claw-count` | 虾数 Claw Count | One number decides which planks exist. Changes are scarce. |
| `claw-mask` | 虾罩 Claw Mask | A three-cell mask chooses which layer you step on. |
| `claw-clock` | 虾钟 Claw Clock | Turn the ring, then the hand eats the next cell. |
| `claw-flip` | 虾拨 Claw Flip | One flip swaps every plate and gap. Stones only hop. |
| `claw-round` | 虾循 Claw Round | Six beats, then the tide takes anything not in the pocket. |
| `claw-coil` | 虾绕 Claw Coil | The tail follows the head. Push the crate into the dock. |
| `claw-sum` | 虾算 Claw Sum | Pull levers until the number matches the target. |
| `claw-berth` | 虾泊 Claw Berth | Draft must fit the berth. Hazard ships cannot sit together. |
| `claw-delve` | 虾掘 Claw Delve | Leave an unbraced layer and the shaft falls. |
| `claw-fair` | 虾市 Claw Fair | Customers remember yesterday. A raise is only one. |
| `claw-reef` | 虾礁 Claw Reef | Step, then the tide pushes anything not anchored. |

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

Publishing the site and the relay is described in
[`docs/release-flow.md`](docs/release-flow.md). To add or rewrite a game, see
[`docs/adding-a-game.md`](docs/adding-a-game.md).
