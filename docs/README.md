# GameClaw documentation

Maintainer-facing documentation. Player-facing content lives in the root
[`README.md`](../README.md) and the distributable [`SKILL.md`](../SKILL.md).

| Document | Read it when |
|---|---|
| [`repository-architecture.md`](repository-architecture.md) | You need the layering rules, dependency direction or state layout |
| [`release-flow.md`](release-flow.md) | You are building, packaging, tagging or verifying a release |
| [`agent-coding-standards.md`](agent-coding-standards.md) | You are writing code, content or tests |
| [`references/ai-native-game-design-rules.md`](references/ai-native-game-design-rules.md) | You are designing or changing gameplay |
| [`plans/`](plans/) | You want the current plan or historical design context |

## The one-paragraph version

`packages/gamekit` owns the agent-first CLI runtime. Each `games/<id>` package
owns one deterministic state machine and its content. `catalog/games.json` is the
machine-readable manifest. `scripts/` builds and tests one game at a time.
`.github/workflows` runs CI and the five-platform release. The root `SKILL.md`
teaches an agent to download, verify and play the released binaries.

## Where to put documentation

- Human discovery / launch prompt → root README
- Agent distribution + troubleshooting → `SKILL.md`
- Machine-readable catalog → `catalog/games.json`
- One game's mechanics and operators notes → `games/<id>/README.md`
- Architecture, release, standards, design rules → `docs/`
- Design history → `docs/plans/`

Do not duplicate a fact across layers. Link to the owning layer instead.

## Archived material

`docs/archive/` holds historical notes that are kept for context but are not
maintained. In particular, the Python/uv workflow described in v0.x plans no
longer exists.
