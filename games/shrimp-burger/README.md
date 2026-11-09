# 虾堡 (Shrimp Burger)

限时接料做成美味汉堡。配方外材料照样进栈；落物可能自行融合；小动物会来偷吃；火候球也要接，过生过熟就得安抚客人。

## 快速开始

```bash
bun src/main.ts new --seed 7 --json
bun src/main.ts act catch:0 --json
bun src/main.ts recap --json
```

版本：`2.8.0` · id / binary：`shrimp-burger`

## 动作

| id | 作用 |
| --- | --- |
| `catch:<0\|1\|2>` | 接住对应落物格（食材 / 火候 / 融合） |
| `shoo:<pestId>` | 腾出另一只手驱赶害虫 |
| `serve` | 出餐；公开阈值后抽判定值 |
| `soothe` | 安抚不满客人（guest 阶段） |
| `wait` | 空拍；guest 阶段等于放任离店 |
| `discard-top` | 丢掉顶层误接 |
| `abort` | 主动收摊 |

## 规则摘要

- **错料不自动失败**：不在图例里的材料仍入栈；最终美味看 `quality` 与 1–100 判定值。
- **融合**：两阶段落物；不稳定时可抢接（额外 +6 火候），稳定后无额外热量。
- **害虫**：老鼠 / 海鸥 / 浣熊 / 鸽子 / 猫，倒计时结束偷吃材料或火候。
- **火候**：`rare/medium/well` 火候球增加整数火候；每拍冷却 2；每单有目标区间。
- **胜负（normal）**：60 拍内送出 4 份 tasty/lucky；离店或灾难餐达上限、或超时则负。

## 关键状态路径

`phase` · `recipe` · `stack` · `heat` · `falling` · `pests` · `guest` · `served/goal` · `turnsRemaining` · `lastOrder.taste` · `walkouts` · `ruined`

## 测试

```bash
pnpm --filter @gameclaw/shrimp-burger test
pnpm --filter @gameclaw/shrimp-burger check
```
