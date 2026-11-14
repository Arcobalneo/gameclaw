# Ferry depth — 虾印, 虾熔, 虾网, 虾节

## Goal

After playing the eight games on the live site, the weakest thing on the first four is depth, not the picture. A careful line must beat a greedy line by a wide margin, and a test has to say so.

## What the live play showed

- 虾印: kind and fare are public, and a fare-greedy line still sails 5 of 12 seeds. Suggest sails 11.
- 虾熔: suggest already sails 12 of 12 against a points-only drop, but the test only stacks column 0. The current shell is invisible until a column is hovered.
- 虾网: tying knots in board order wins the same 12 seeds as suggest. Thread is long enough that the knot you pick does not matter.
- 虾节: suggest knocks out 12 of 12. Committing the resting phrase wins 0. No test says that.

## Scope

- 虾印: stamping an edge keeps the fare and the strike, and does not count as an approval. Suggest pardons or rereads instead of stamping the edge.
- 虾熔: test the points-only line. Draw the current shell and the column numbers without a hover.
- 虾网: shorter thread, one more opening tear. Suggest still fills the basket. A board-order tie does not.
- 虾节: test an immediate commit against suggest.

No catalog ids, no relay allowlist, no other games.

## Assumptions

- The public kind on 虾印 stays public. The new decision is whether the fare is worth a strike that does not fill the quota.
- Score formulas stay. Only what counts as an approval changes.

## Risks

- A tighter net can make suggest lose. The survey has to stay at least 8 of 12 before the test is locked.
- Edge-stamp tests that expected an approval need the new count.

## Checklist

- [x] Stamp rule and suggest
- [x] Net thread and opening tears
- [x] Melt shell, column numbers, points-only test
- [x] Beat commit test (already in the engine suite: four rests win 0)
- [x] READMEs, changelog, i18n
- [x] lint, check, test
- [x] One live-shaped `new → act → recap` on the dev server
