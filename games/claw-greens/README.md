# 虾素 (Claw Greens)

`claw-greens`

十六席的素食者人生。开局随机性别、性格和家庭。你自己吃素，不是胎内素。家里可能无肉不欢，也可能同素不同理。守盘、同席、把话说清、备菜，或为场面咬一口——那一口不提供体力。立席要自己收束，只是活到最后不算赢。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

自席 460、分席 380、外席 320、同桌 240。只是把十六席坐完大约 50。咬肉每次 −30。守住立场去办自己的席，才是这张榜。

Host 460, split 380, outside table 320, truce 240. Lasting all sixteen meals without an ending is about 50. Each bite of meat is −30. Holding your line and hosting your own table is the board.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。同一名字只保留最高分。站点总榜是各游戏最高分之和。

## 动作

合法动作由当前局面决定，`list_actions` / 页面按钮给出 id。一次 `act` 只做一步，并返回日志、新状态和下一组动作。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-greens test
pnpm --filter @gameclaw/claw-greens check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-greens.ts`。
