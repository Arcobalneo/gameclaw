# lobster-cli-heist

《横着潜：只给龙虾玩的 CLI 潜行渗透》是 `gameclaw` 的第三款游戏：一个 **CLI-first / compact-first / agent-friendly** 的短局 heist。

首版重点不是把地图做大，而是把这三个东西做实：

- mission grammar：`facility / security / objective / complication`
- `profile × package × extraction pressure` 的交叉
- 取物后的真实撤离压力，而不是“摸到目标就算过”

## 这版到底能玩什么

当前 vertical slice 已经包含：

- 3 条 profile：`藻披影行者` / `断钳拆闸手` / `脱壳快撤者`
- 3 套 facility frame：冷库挂架 / 后厨背线 / 码头仓道
- 3 套 security package：直线盯守 / 摆扫镜头 / 封锁响应
- 3 套 objective package：盐账账本 / 活体样本罐 / 黄铜钥环
- 4 套 complication package：蒸汽倒灌 / 快门闸卡涩 / 临时加班看线 / 湿滑地面
- 运行期本地 HTML observer 页面
- 默认 HTML 结算页（可用 `--no-settlement-report` 关闭）

## 玩家：从 Releases 获取二进制

玩家应优先从 **GameClaw 仓库** 的 Releases 下载：

- `https://github.com/Arcobalneo/gameclaw/releases/latest`

Linux：

```bash
tar -xzf lobster-cli-heist-linux-x86_64.tar.gz
cd lobster-cli-heist-linux-x86_64
./lobster-cli-heist
```

macOS Apple Silicon：

```bash
tar -xzf lobster-cli-heist-darwin-arm64.tar.gz
cd lobster-cli-heist-darwin-arm64
./lobster-cli-heist
```

## 维护者：从源码运行

### 方式 A：在游戏目录里直接运行

```bash
cd games/lobster-cli-heist
python3 main.py
```

### 方式 B：从 monorepo 根目录统一调用

```bash
./scripts/test-game.sh lobster-cli-heist
./scripts/build-game.sh lobster-cli-heist
```

## Observer 页面

新游戏默认会在本地启动 observer 页面：

- 默认从 `localhost:8000` 起寻找空闲端口
- 运行中会打印明确的 URL
- HTML 页只做实时旁观，不隐藏 CLI 没有的“真相 UI”
- 游戏结束后 server 会停止并释放端口
- 同时会把最终局面写成静态 HTML 结算页，保存在当前目录的 `settlement_reports/`

## 控制方式

- 全程纯数字菜单，适合人类与 agent 脚本化输入
- 每回合通常只做 1 个主动作
- `Observe` 用来读 patrol / camera 节奏
- `Interact` 用来操作终端、摸 side stash、检查目标或撤离
- `Gear` 是临场翻盘按钮，不是可以无脑全花完的消耗品

## 关键参数

```bash
python3 main.py --quick-start --seed 7 --profile 2 --script 4,1,1,1,5,1,1,1
```

参数说明：

- `--seed`：固定随机种子
- `--quick-start`：跳过主菜单，直接进一轮
- `--profile`：预选 profile（1~3）
- `--script`：逗号分隔的脚本化输入；耗尽时会进入诚实的中止结算
- `--verbose-text`：切回更长说明文案
- `--no-settlement-report`：关闭 HTML 结算页
- `--observer-port-start`：从指定端口开始搜索 observer 端口

## 测试

维护者现在统一通过仓库根目录的 `uv` workspace（`pyproject.toml` + `uv.lock`）运行测试。

如果你在该游戏目录里直接执行：

```bash
python3 -m unittest discover -s tests
```

如果你想遵循 monorepo 的稳定入口，则从仓库根目录执行：

```bash
./scripts/test-game.sh lobster-cli-heist
```

## 本地打包

如果你只想在该游戏目录里本地打包：

```bash
python3 -m nuitka --onefile --output-dir build/nuitka --output-filename lobster-cli-heist main.py
```

如果你想遵循 monorepo 的统一入口，则从仓库根目录执行：

```bash
./scripts/build-game.sh lobster-cli-heist
```

## 关于“防逆向”的真实边界

这个游戏的二进制发行目标是：

- 降低普通玩家在玩家路径里直接翻源码的便利度
- 让下载与启动体验更接近正常 CLI 游戏

不是：

- 绝对防逆向
- 绝对防篡改
- 强对抗安全系统

它会更不容易被随手看源码，但并不是不可分析的黑盒。
