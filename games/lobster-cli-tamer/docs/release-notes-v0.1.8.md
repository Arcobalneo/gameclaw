# Release Notes: lobster-cli-tamer v0.1.8

**Theme: terminal-native 交互优化 — 让通用 coding agent 稳定游玩**

---

## 变更类型

| 模块 | 改动量 |
|------|--------|
| `game.py` | +407 / -76 行 |
| `render.py` | +24 / -? 行 |
| `README.md` | +20 行 |
| 新增测试 | `tests/test_terminal_native_cli.py` |
| 新增文档 | `docs/2026-03-19-terminal-native-plan.md` |

---

## 核心功能

### 1. `--terminal-native` 模式

新增一等公民运行模式，专门为通用 coding agent（OpenClaw / Claude Code / Codex 等）优化交互体验。

推荐启动方式：

```bash
# 直接进入游戏（自动新建槽 0，名称为 Agent）
./lobster-cli-tamer --terminal-native --save-slot 0 --player-name Agent

# 无颜色，适合纯文本终端
./lobster-cli-tamer --terminal-native --no-color --save-slot 0
```

### 2. 新增 CLI 参数

| 参数 | 作用 |
|------|------|
| `--terminal-native` | 开启 agent 友好模式 |
| `--no-color` | 关闭 ANSI 颜色 |
| `--no-banner` | 关闭启动横幅 |
| `--no-observer` | 关闭本地实时观战看板 |
| `--save-slot <n>` | 直接进入指定存档槽（空槽自动新建） |
| `--player-name <name>` | 配合 `--save-slot` 跳过新档命名交互 |

### 3. 稳定文本锚点协议

`--terminal-native` 模式下，所有关键界面统一输出以下结构化锚点：

```
STATE: <当前状态>
ACTIONS: <可选动作列表>
PROMPT: <等待输入类型>
```

覆盖界面：
- 存档选择（`SAVE_SELECT`）
- 主菜单（`MAIN_MENU`）
- 野外战斗菜单（`BATTLE_MENU`）
- 深渊进入确认（`ABYSS_CONFIRM`）
- 深渊前进/撤退（`ABYSS_DECISION`）
- 工坊菜单（`WORKSHOP_MENU`）
- 技能选择 / 替换
- 工坊净化对象选择
- 图鉴返回、队伍详情返回

### 4. help 信息增强

`--help` 输出现在包含：
- 游戏背景与核心 loop 说明
- 对 coding agent 的启动建议
- 推荐 PTY 交互方式（优于管道一次性输入）

### 5. EOF 优雅处理

在 terminal-native 模式下遇到 EOF（stdin 关闭）时，游戏会：
- 打印明确退出信息
- 自动保存当前存档
- 以 exit code 0 正常退出

不会抛出裸 traceback。

### 6. 非法输入统一

分散的"无效输入"提示收敛为更短、更一致的风格，降低 coding agent 误判概率。

---

## 游戏数据 / 平衡性

无变化。核心数值（掉落率、深渊污染、工坊材料消耗）与 v0.1.7 保持一致。

---

## 技术变更

- `game.py`：引入 `GameOptions` dataclass + `_emit_state` / `_emit_actions` / `_emit_prompt` 内部协议方法
- `render.py`：新增 `render_menu(..., compact=False)` 参数，terminal-native 下抑制标题框线
- `save.py` / `loader.py` / `world.py`：无变更
- 所有新增行为仅在 `--terminal-native` 分支生效，默认 human-friendly 模式不受影响

---

## 测试

- 新增 `tests/test_terminal_native_cli.py`（8 个测试）
- 全部 39 个测试通过（含原有 31 个回归测试）

---

## 已知局限

以下界面尚未输出完整结构化锚点，将在后续版本补全：
- 战斗状态详情（`BATTLE_STATUS` 行）
- 资源/队伍简明摘要块
- 深渊撤退结算状态标签
- 队伍为空时的固定错误格式

---

## 推荐启动命令速查

```bash
# 人类玩家（保持原有体验）
./lobster-cli-tamer

# 通用 coding agent / PTY 交互
./lobster-cli-tamer --terminal-native --no-color --save-slot 0 --player-name Agent
```
