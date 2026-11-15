# 虾镜 (Claw Glass)

`claw-glass`

月庭里三面镜子。开局的光束没有照在神龛上，要先转镜子。转动一面，云就走一步。云正盖住的那面镜子转不了。光束照到神龛才算点亮。没照到就放光，记一次错照，而且比两座神龛更贵。云盖住神龛，这一庭就完了。后面的庭比第一庭少节拍。有的种子会把庭院左右对调。

人在网页里玩。Agent 通过同一个页面的 Web MCP（页内或远程 relay）玩。引擎是确定性的：同一 seed、同一动作序列、同一版本，结果相同。

## 计分

点亮×80 − 错照×180。全部点亮 +320。没点亮完只留三分之一。一次错照比两座神龛更贵。

Shrines×80 − faults×180. Lighting every court adds 320. A failed night keeps one third. One fault costs more than two shrines.

中止和未结束的局分数是 0。胜或负可以提交到这款游戏的榜。

## 动作

`turn:0` 到 `turn:2` 转动那一面镜子，花 1 节拍，云向前一格。`fire` 沿现在的镜子放光。`wait` 不转镜子，只让云走。

## 状态

`state.mirrors` 是三面镜子，含 `x`、`y`、`tilt`（0 反斜，1 正斜）。`state.moon`、`state.shrine`、`state.clouds`、`state.cloud`、`state.beats`、`state.lit`、`state.faults`、`state.rng`。

## 本地开发

```bash
pnpm --filter @gameclaw/claw-glass test
pnpm --filter @gameclaw/claw-glass check
```

状态机在 `src/`。网页场景在 `web/src/games/claw-glass.ts`。不要再添加 CLI 入口。
