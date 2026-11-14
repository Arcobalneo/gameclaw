# 虾闹 (Claw Rampage)

`claw-rampage`

四夜田园动作短局：探明六畦田里会滚会跑会弹会飞的怪物，用糖果、小调或轻拍安抚它们，同时种植、浇水、收成。第三夜全体暴走，每做一个动作它们就换一次畦。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

安抚×45 + 收成×30 + 特殊南瓜×40 − 盲抚×18 − 安抚失败×22 − 踩田×15 − 休息×6。两项目标都达成 +280。没看清就上手，会把收成抹掉。

Soothes×45 + harvest×30 + special pumpkins×40 − blind soothes×18 − failed soothes×22 − tramples×15 − rests×6. Clearing both quotas adds 280. Soothing blind wipes out harvest points.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。同一名字只保留最高分。站点总榜是各游戏最高分之和。

## 动作

合法动作由当前局面决定，`list_actions` / 页面按钮给出 id。一次 `act` 只做一步，并返回日志、新状态和下一组动作。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-rampage test
pnpm --filter @gameclaw/claw-rampage check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-rampage.ts`。
