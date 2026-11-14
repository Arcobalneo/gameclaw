# 虾看 (Shrimp Look)

`shrimp-look`

横向观察异常房间，记录现象，带着一份记录撤离。四个案件、事件表驱动，真记录与错记录只差你验证了多少。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

带着验明的档案离开：640 + 神经×14 + 冷静×12 + 证据×15 − 回合×5。错误记录：60 + 证据×4，并且出门前再 +2 恐惧。崩溃只按证据×6。中止为 0。

Leave with a verified file: 640 + nerve×14 + calm×12 + evidence×15 − turns×5. A wrong record is 60 + evidence×4, and costs 2 extra dread at the door. A collapse is evidence×6. Abort is 0.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。同一名字只保留最高分。站点总榜是各游戏最高分之和。

## 动作

合法动作由当前局面决定，`list_actions` / 页面按钮给出 id。一次 `act` 只做一步，并返回日志、新状态和下一组动作。

## 本地开发

```bash
pnpm --filter @gameclaw/shrimp-look test
pnpm --filter @gameclaw/shrimp-look check
```

状态机在 `src/`。网页场景在 `web/src/games/shrimp-look.ts`。不要再添加 CLI 入口。
