# GameClaw v2.6.0 completion report

## Code changes by game

- `shrimp-trek` / 虾走: no gameplay changes; package and runtime versions move to
  2.6.0.
- `shrimp-guard` / 虾守: leak damage clamps integrity at zero, pulse events and
  status metrics now agree, and zero still triggers `lost`. Deployment actions
  lead with current lane pressure; setup text distinguishes regular pulses from
  cleanup tail waves. Package/runtime/docs move to 2.6.0.
- `shrimp-heist` / 虾潜: objective interactions beside an active adjacent
  responder now carry high risk and an explicit lethal-collision warning that
  does not depend on exposure. Package/runtime/docs move to 2.6.0.
- `shrimp-catch` / 虾抓: recap timeline entries use the current live `turn`
  rather than `turn + 1`. Package/runtime/docs and the CLI version expectation
  move to 2.6.0.
- `shrimp-look` / 虾看: the first legal action (gamekit's `next`) now prefers
  verified extraction at an exit, then an available archive claim at full
  evidence, then an unrecorded phenomenon; low resources prefer `brace`. The
  legal action set is unchanged. Package/runtime/docs move to 2.6.0.
- `shrimp-rampage` / 虾闹: mid-run recaps preserve `ongoing`, use 季中 progress
  wording, and produce ongoing report paths. True aborts remain `aborted`; won
  and lost titles/outcomes are unchanged. Cross-night `events.act` entries use
  the action's original night and consumed budget. Package/runtime/docs move to
  2.6.0.
- `shrimp-ink` / 虾写: `investigate` is hidden below 2 silver and `dig` at 1
  life; verify/probe and paid talks are also filtered by affordability.
  Contextual recommendations prefer urgent supplies/income, verification,
  probing, supported digs, or investigation. The grain log says the next bag
  rises to 4 silver, and mid-run recaps preserve `ongoing`.
  Package/runtime/docs move to 2.6.0.
- `shrimp-greens` / 虾素: an available settlement becomes `next` ahead of
  `hold`; mid-run recaps preserve `ongoing`. Package/runtime/docs move to 2.6.0.
- `shrimp-conquest` / 虾征: mid-run recaps preserve `ongoing`; no other gameplay
  changes. Package/runtime/docs move to 2.6.0.

Root, gamekit, every game package, every game runtime constant and `SKILL.md`
metadata are 2.6.0. `CHANGELOG.md` has the requested 2026-11-04 entry.
`docs/NAMING.md` is unchanged and `SKILL.md` remains list-free. The required
pre-change checklist is `docs/plans/2026-11-04-v2.6.0-playtest-fixes.md`.

## Tests added or updated

No new test framework or test files were introduced. Existing suites updated:

- `games/shrimp-rampage/tests/engine.test.ts`: ongoing/abort/won/lost recaps and
  cross-night act attribution.
- `games/shrimp-ink/tests/engine.test.ts`: silver/life boundaries, legal positive
  cases, recommendations, food-price wording and recap outcomes.
- `games/shrimp-guard/tests/engine.test.ts`: over-leak clamp in event/status,
  zero-integrity loss and pressure-led deployment recommendation.
- `games/shrimp-catch/tests/engine.test.ts`: live-turn/recap timeline agreement.
- `games/shrimp-catch/tests/cli.test.ts`: 2.6.0 banner expectation.
- `games/shrimp-look/tests/engine.test.ts`: record, claim and extract priority
  cases plus 2.6.0 runtime expectation.
- `games/shrimp-look/tests/cli.test.ts`: 2.6.0 envelope expectation.
- `games/shrimp-heist/tests/engine.test.ts`: adjacent-responder lethal warning.
- `games/shrimp-greens/tests/engine.test.ts`: settle-over-hold and ongoing/abort
  recap outcomes.
- `games/shrimp-greens/tests/cli.test.ts`: 2.6.0 envelope expectation.
- `games/shrimp-conquest/tests/engine.test.ts`: ongoing/abort recap outcomes.
- `games/shrimp-conquest/tests/cli.test.ts`: 2.6.0 envelope expectation.

## Validation commands and results

All final required checks passed:

| Command | Result |
| --- | --- |
| `node scripts/validate-catalog.mjs` | PASS — 9 games × 5 platforms |
| `pnpm lint` | PASS |
| `pnpm check` | PASS — gamekit and all nine games |
| `pnpm test` | PASS — 21 test files, 230 tests |
| `node scripts/test-game.mjs shrimp-rampage` | PASS — 18 tests |
| `node scripts/test-game.mjs shrimp-ink` | PASS — 30 tests |
| `node scripts/test-game.mjs shrimp-guard` | PASS — 26 tests |
| `node scripts/test-game.mjs shrimp-catch` | PASS — 24 tests |
| `node scripts/test-game.mjs shrimp-look` | PASS — 23 tests |
| `node scripts/test-game.mjs shrimp-heist` | PASS — 19 tests |
| `node scripts/test-game.mjs shrimp-greens` | PASS — 26 tests |
| `node scripts/test-game.mjs shrimp-conquest` | PASS — 32 tests |
| `node scripts/build-game.mjs shrimp-rampage` | PASS — real linux-x64 binary and archive |
| `games/shrimp-rampage/dist/shrimp-rampage --version` | PASS — `shrimp-rampage v2.6.0` |
| Real binary `new → act → recap` plus six-rest night boundary | PASS — ongoing recap/report and night 1, used 6 act event |
| `git diff --check` | PASS |

An intermediate lint run found three formatting-only differences, which were
corrected. An intermediate 虾素 test run failed because the fixture did not
actually offer `hold`; the fixture was corrected to a legal kitchen settlement
and the final run passes. `pnpm install` was not needed because existing
workspace dependencies successfully ran every check.

The compiled binary/archive and temporary save/report data used for validation
were removed after the replay; they are not deliverables.

## Residual known issues / intentionally deferred notes

- No must-fix issue remains known. Optional balance- or structure-heavy ideas
  were not forced into this patch: 虾抓 exploration density, 虾闹 action-list
  grouping, 虾看 duplicate display-name presentation, and 虾走 strategy-level
  recommendations remain possible future polish.
- Observer implementation was untouched. The real binary replay used
  `--no-observer`; it explicitly verified the static ongoing report path.
- The pre-existing untracked `KIMI_V260_TASK.md` is left untouched and is not
  part of the v2.6.0 commit.

## Commit confirmation

All v2.6.0 deliverables, including this report, are included in a local
conventional commit on `feat/v2.6.0-playtest-fixes`. No push, tag, PR, merge or
other release action was performed.
