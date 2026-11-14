# 虾跃 (Shrimp Leap)

`shrimp-leap`

四十五关灯柱跳跃：性格与颜色塑造果冻属性，三档离散物理、连续街图、视野与街速递增，每十五关成长；同性格离线同伴可能黏连并触发救援。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

过关×40 + 完美×20 + 最佳完美连段×30 + 救援×80 − 摔落×70。只有完美落地才延续连段，擦边和干净落地都会打断。天亮 +500。

Clears×40 + perfects×20 + best perfect streak×30 + rescues×80 − falls×70. Only a perfect extends the streak; a clean or edge landing breaks it. Reaching dawn adds 500.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。同一名字只保留最高分。站点总榜是各游戏最高分之和。

## 动作

合法动作由当前局面决定，`list_actions` / 页面按钮给出 id。一次 `act` 只做一步，并返回日志、新状态和下一组动作。

## 本地开发

```bash
pnpm --filter @gameclaw/shrimp-leap test
pnpm --filter @gameclaw/shrimp-leap check
```

状态机在 `src/`。网页场景在 `web/src/games/shrimp-leap.ts`。
