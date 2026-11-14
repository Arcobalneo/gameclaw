# 虾走 (Claw Trek)

`claw-trek`

九场遭遇加一道归海闸口的无限潮段肉鸽：三种谱系、七种突变、潮势节奏与海压递增。死亡给出可归因死因，结算输出本局观察。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

收壳：名声×3 + 深度×18 + 壳 + 能。活过闸口：名声×6 + 潮段×160 + 深度×8 + 海压×20。死亡只留名声的一部分加深度×4。中止为 0。

Bank: fame×3 + depth×18 + shell + energy. Survive the gate: fame×6 + cycle×160 + depth×8 + pressure×20. A death keeps a fraction of fame plus depth×4. Abort is 0.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。同一名字只保留最高分。站点总榜是各游戏最高分之和。

## 动作

合法动作由当前局面决定，`list_actions` / 页面按钮给出 id。一次 `act` 只做一步，并返回日志、新状态和下一组动作。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-trek test
pnpm --filter @gameclaw/claw-trek check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-trek.ts`。
