# 横着写 · v2 移植计划（第 7 款游戏）

来源：小红书笔记 Day152《筆轉乾坤》（note_id 6ae21b9e000000000d00b484）。
目标：把「一支能改写现实的笔 + 信与证的分歧」做成 gamekit 标准 CLI 游戏，随 v2.2.0 全平台发版。

## 1. 范围

- 新包 `games/lobster-cli-ink`，包名 `@gameclaw/lobster-cli-ink`，版本跟随根 `package.json`（2.2.0）。
- 只依赖 `@gameclaw/gamekit` 与 `node:*`；不新增第三方依赖。
- 不实现 CLI / observer / report：全部由 gamekit 提供。
- 不在规则里读时钟、不写文件；状态必须 JSON 可序列化，随机数只用 state.rng。

## 2. 核心循环（18 回合，一回合一个动作）

- 六处地点：归墟镇（市集）、断碑坡（风口）、雾渡口（补给）、墨池（墨）、荒庙（证）、皇驿（官）。
- 真笔所在从断碑坡 / 雾渡口 / 墨池 / 荒庙 中按种子抽取，玩家不可直接读。
- 三条资源：银（调查/买粮/买证）、粮（每回合 -1，赶路再 -1）、命（挖笔、墨噬、夺笔者）。
- 两条认知线：信（越信越容易「调查到真线索」，但也会把假线索当真）、证（可在荒庙验证，也可用笔后反证）。
- 墨债：每次用笔改写现实 +1~2，债 ≥3 起有反噬，≥5 每回合掉命，≥6 直接墨噬结局。
- 结局 9 种：执笔 / 证笔 / 售笔 / 封笔 / 寻笔 / 劝世 / 墨尽 / 墨噬 / 收壳。

## 3. 反支配策略设计

- 挖笔要 1 命且只在真址 + （信≥60 或 证≥阈值）时成功；失败文案统一，不泄露地点真假。
- 调查 2 银，成功率随信上升但封顶 0.75；假线索指向另一处野址，照挖会白掉一条命。
- 用笔收益强（+2 命 / +10 银 / +3 名），但债会把收益吐回去；18 回合内最多安全用 2 次。
-  selling 是最稳的银路，但结局分最低且被记入笔记（content 预设 `sold-once` 会抬高下一局挖笔门槛）。
- 疑者开局证高信低，走「先证后用」；信者开局信高证低，走「先挖后证」；录者居中但有书稿加成。

## 4. 交付清单

1. `docs/plans/2026-11-02-lobster-cli-ink-v2-plan.md`（本文件）
2. `games/lobster-cli-ink/{package.json,tsconfig.json,README.md,LICENSE}`
3. `games/lobster-cli-ink/src/{content,engine,definition,main}.ts`
4. `games/lobster-cli-ink/tests/engine.test.ts`（确定性、结局、经济、债、动作空间）
5. `catalog/games.json` 第 7 条、`SKILL.md`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`、根 `package.json` 版本 2.2.0
6. 验证：`pnpm lint && pnpm check && pnpm test`、`node scripts/validate-catalog.mjs`
7. 构建 `linux-x64` 冒烟，提交，打 tag `v2.2.0`，推送并核对 5 平台产物

## 5. 验收标准

- `actions` 在任一状态下 4–9 条，且每条 id 稳定可解析。
- 同 seed + 同动作序列 → 同 recap（含 metrics / timeline）。
- 至少三条互斥成功路线（执笔 / 证笔 / 售笔）在 200 seed 模拟下胜率均 > 8%。
- 无 `Math.random`、无 `Date.now`、无 `process` 退出逻辑。
- catalog 校验通过，5 平台资产名与 `<id>-<platform>` 规则一致。
