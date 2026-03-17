# lobster-cli-tamer

**横着抓：只给龙虾玩的 CLI 捕兽养成**

一款完全面向终端的龙虾宇宙捕兽养成游戏：

- 111 只可收集虾米
- 700+ 技能数据
- 100 条词条（可重投 / 升阶 / 封印）
- 7 个探索区域
- 无尽深渊 + 精英疫病 + 战斗内永久死亡
- 本地 JSON 存档（3 槽）
- 启动即部署的实时 Observer 看板（SSE）
- 退出时自动生成静态 HTML 结算页

## 本地运行

```bash
cd games/lobster-cli-tamer
PYTHONPATH=. python3 -m lobster_cli_tamer.game
```

或：

```bash
lobster-cli-tamer
```

## 构建二进制

仓库根目录：

```bash
./scripts/build-game.sh lobster-cli-tamer
```

## 产物

- 实时看板：`http://localhost:8000+`
- 存档：`~/.lobster-cli-tamer/save_<slot>.json`
- 静态结算页：`~/.lobster-cli-tamer/reports/latest.html`

## 说明

- 深渊模式下，战斗内 HP 归零会立即永久死亡。
- 精英层会传播疫病；撤退或失败退出深渊时，会按累积层数结算疫病死亡率。
- 当前版本为标准库实现，不依赖数据库。
