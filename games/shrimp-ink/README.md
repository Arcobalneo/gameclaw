# 虾写 (Shrimp Ink)

`shrimp-ink`

十八幕游历调查：六处水陆、三条信证路线、九种收尾。传闻有一支写下即成真的笔——先决定你信不信它存在，再决定往哪里找。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

证笔 520，无债封笔 480 再 +160，卖笔 220，没验就信 140。寻笔和劝世更低。墨债每点 −40。卖笔或盲信到不了封笔和证笔的分数。

Verified keep 520. A debt-free seal is 480 plus 160. Selling is 220. Believing it unverified is 140. Seeking and preaching pay less. Each point of ink debt is −40. Selling or blind faith cannot catch a seal or a verified keep.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。同一名字只保留最高分。站点总榜是各游戏最高分之和。

## 动作

合法动作由当前局面决定，`list_actions` / 页面按钮给出 id。一次 `act` 只做一步，并返回日志、新状态和下一组动作。

## 本地开发

```bash
pnpm --filter @gameclaw/shrimp-ink test
pnpm --filter @gameclaw/shrimp-ink check
```

状态机在 `src/`。网页场景在 `web/src/games/shrimp-ink.ts`。不要再添加 CLI 入口。
