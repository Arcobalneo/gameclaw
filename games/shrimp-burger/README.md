# 虾堡 (Shrimp Burger)

`shrimp-burger`

混乱汉堡站台：接住食材与火候球，错料照样入栈并靠确定性味觉阈值出餐；落物可融合，小动物间歇偷吃需驱赶，过生过熟要安抚客人。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

美味×180 + 幸运×40 + 最佳美味连段×50。幸运不延续连段。离店 −120，比一份幸运更贵。交班成功 +200，再加剩余时间。

Tasty×180 + lucky×40 + best tasty streak×50. A lucky bite does not extend the streak. A walkout is −120, more than a lucky serve. Finishing the shift adds 200 plus time left.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。同一名字只保留最高分。站点总榜是各游戏最高分之和。

## 动作

合法动作由当前局面决定，`list_actions` / 页面按钮给出 id。一次 `act` 只做一步，并返回日志、新状态和下一组动作。

## 本地开发

```bash
pnpm --filter @gameclaw/shrimp-burger test
pnpm --filter @gameclaw/shrimp-burger check
```

状态机在 `src/`。网页场景在 `web/src/games/shrimp-burger.ts`。不要再添加 CLI 入口。
