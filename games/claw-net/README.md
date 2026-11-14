# 虾网 (Claw Net)

`claw-net`

五乘四的夜网。两个破洞挨着，完好的结会变湿；湿结再挨着破洞就会裂开；湿结旁边没有破洞时会干回去。补一结花一根线。剪一结不再蔓延，这格也没有鱼。收网按完好减两倍破洞计鱼，然后夜里加线并新开两个破洞。破洞到八张网就破。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

鱼×12 + 剩余线×6 − 剪口×18。鱼够了 +340。没够或网破只按鱼×4。剪一处比一条鱼更贵。

Fish×12 + thread left×6 − cuts×18. Filling the basket adds 340. A thin haul or a rip scores fish×4. A cut costs more than one fish.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`tie:x:y` 补破洞或湿结。`cut:x:y` 把完好结剪成缺口。`haul` 收当前这一网。坐标从 0 起。detail 写明能稳住几处邻居，以及现在收网大约几条鱼。

## 状态

`state.cells` 长 20，按行排列，值为 `tied`、`wet`、`torn` 或 `gap`。`state.night`、`state.thread`、`state.basket`、`state.quota`、`state.cuts`、`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-net test
pnpm --filter @gameclaw/claw-net check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-net.ts`。不要再添加 CLI 入口。
