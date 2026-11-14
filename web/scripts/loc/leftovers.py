# Residual phrases found by the EN smoke that are concatenations or missing stems.
EXACT = {
    "shrimp-look": {
        "标签错位、目录污染": "Misfiled labels, a polluted catalog",
        "标签错位、目录污染。": "Misfiled labels, a polluted catalog.",
        "门缝、床尾、镜面": "Door cracks, bed ends, mirrors",
        "门缝、床尾、镜面。": "Door cracks, bed ends, mirrors.",
        "监控画面延迟与反向凝视": "Delayed camera feeds and a reversed gaze",
        "监控画面延迟与反向凝视。": "Delayed camera feeds and a reversed gaze.",
        "海边废弃观察站": "An abandoned observation post by the sea",
        "海边废弃观察站。": "An abandoned observation post by the sea.",
    },
    "shrimp-greens": {
        "桌上有你能吃的。": "There is something on the table you can eat.",
        "桌上有你能吃的": "There is something on the table you can eat",
        "桌上没有你的菜。": "There is no dish of yours on the table.",
        "桌上没有你的菜": "There is no dish of yours on the table",
        "和你不一样": "Not the same as yours",
        "和你一样": "The same as yours",
        "立场很清楚": "Your stance is clear",
        "对家里人说话像宣判，对外面的人反而说得动。":
            "Talking to family sounds like a verdict; with people outside, you are more convincing.",
        "对家里人说话像宣判，对外面的人反而说得动":
            "Talking to family sounds like a verdict; with people outside, you are more convincing",
        "桌上没有你的菜。守着空盘子会掉身体，家里还可能叠冲突。":
            "There is no dish of yours on the table. Guarding an empty plate costs body, and at home it may also stack clash.",
    },
    "shrimp-leap": {
        "未选性格·未选颜色": "no temperament chosen · no color chosen",
        "未选性格": "no temperament chosen",
        "未选颜色": "no color chosen",
    },
    "shrimp-burger": {
        "出餐中": "Serving",
        "图例 required": "required on the ticket",
        "图例": "ticket",
        "材料": "ingredient",
        "酱汁": "sauce",
        "面包": "bun",
        "酸黄瓜太阳蛋": "pickle-and-sunny-side fusion",
    },
}

PATTERNS = {
    "shrimp-guard": {
        "- 本 pulse 入潮：{0}": "- Incoming this pulse: {0}",
        "本 pulse 入潮：{0}": "Incoming this pulse: {0}",
        "{0}【{1}】x{2}": "{0}[{1}] x{2}",
        "本 pulse 压力 {0}": "pressure this pulse {0}",
        "拦 {0}": "block {0}",
        "壳 {0}": "shell {0}",
    },
    "shrimp-trek": {
        "能{0} 盐{1} 名{2}": "energy {0} salt {1} fame {2}",
        "能{0} 名{1} 势{2}": "energy {0} fame {1} momentum {2}",
        "能{0} 名{1}": "energy {0} fame {1}",
        "能{0} 盐{1} 名{2} 势{3}": "energy {0} salt {1} fame {2} momentum {3}",
        "能{0} 名{1} 蜕{2} 势{3}": "energy {0} fame {1} molt {2} momentum {3}",
        "C{0} D{1} {2}": "C{0} D{1} {2}",
    },

    "shrimp-ink": {
        "你手里有一条线索，指向{0}。": "You hold a lead that points to {0}.",
    },
    "shrimp-greens": {
        "家人的理由是{0}": "The family's reason is {0}",
        "热度 {0}/3。{1}": "Heat {0}/3. {1}",
    },
    "shrimp-catch": {
        "探索 {0} · 第 {1}/{2} 步": "Explore {0} · step {1}/{2}",
        "仓库 {0} 只：{1}": "Warehouse {0}: {1}",
        "仓库 {0} 只：{1}Lv{2}": "Warehouse {0}: {1} Lv{2}",
        "{0}Lv{1}": "{0} Lv{1}",
        "深渊最深 {0} 层": "abyss deepest floor {0}",
        "从 {0} 开始按步数推进，遇野生虾米后进入遭遇。":
            "Advance by steps from {0}; a wild shrimp starts an encounter.",
        "跳过步数，在当前区域 {0} 直接抽一次遭遇（可能落空）。":
            "Skip steps and draw one encounter in the current area {0} (it may come up empty).",
    },
    "shrimp-rampage": {
        "{0}；还需 {1} 次成功，没探明情绪就没有契合加成；先 probe 能 +{2}；成功线 {3}+（约 {4}/6）":
            "{0}; {1} more success(es) needed, and there is no affinity bonus until you read the mood; probe first for +{2}; success line {3}+ (about {4}/6)",
        "{0}：{1}，田埂 {2}/{3} · {4}": "{0}: {1}, ridges {2}/{3} · {4}",
        "田埂 {0}/{1}": "ridges {0}/{1}",
    },
    "shrimp-leap": {
        "仍在第 {0} 关；{1}，体力 {2}/{3}，摔落 {4}/{5}。":
            "Still on level {0}; {1}, stamina {2}/{3}, falls {4}/{5}.",
        "仍在第 {0} 关；未选性格·未选颜色，体力 {1}/{2}，摔落 {3}/{4}。":
            "Still on level {0}; no temperament chosen · no color chosen, stamina {1}/{2}, falls {3}/{4}.",
        "最近一次失误：{0}": "Last miss: {0}",
        "第 {0} 关 {1} 落在灯柱后，误差 {2}": "Level {0} {1} landed past the post, error {2}",
        "第 {0} 关 {1} 落在灯柱后，误差 {2}；体力剩 {3}，摔落 {4}/{5}。":
            "Level {0} {1} landed past the post, error {2}; stamina left {3}, falls {4}/{5}.",
        "体力剩 {0}，摔落 {1}/{2}。": "stamina left {0}, falls {1}/{2}.",
        "落在灯柱后": "landed past the post",
    },
    "shrimp-burger": {
        "剩 {0} 拍": "{0} beats left",
        "虾堡｜出餐中｜{0}/{1}｜剩 {2} 拍｜火候 {3}":
            "Shrimp Burger | Serving | {0}/{1} | {2} beats left | heat {3}",
        "next → catch:{0}｜材料 {1}（图例 {2}）":
            "next → catch:{0} | ingredient {1} (ticket {2})",
        "融合进度 {0}/{1} → {2}；现在接会额外 +{3} 火候":
            "Fusion {0}/{1} → {2}; catching it now adds +{3} extra heat",
        "{0}｜出餐中｜{1}/{2}｜剩 {3} 拍｜火候 {4}":
            "{0} | Serving | {1}/{2} | {3} beats left | heat {4}",
    },
}

TERMS = {
    "shrimp-rampage": {
        "田埂": "ridges",
        "抽藤": "sprouting vines",
        "空畦": "Empty bed",
        "有动静": "There's movement",
    },
    "shrimp-catch": {
        "营地": "Camp",
        "技能": "Skill",
        "深渊最深": "abyss deepest",
        "层": "floor",
    },
    "shrimp-burger": {
        "材料": "ingredient",
        "图例": "ticket",
        "酱汁": "sauce",
        "面包": "bun",
        "出餐中": "Serving",
        "火候": "heat",
        "融合进度": "Fusion",
        "虾堡": "Shrimp Burger",
    },
    "shrimp-leap": {
        "未选性格": "no temperament chosen",
        "未选颜色": "no color chosen",
    },
}


def _merge(dst, extra):
    for game, bag in extra.items():
        dst.setdefault(game, {}).update(bag)

_merge(PATTERNS, {
    "shrimp-trek": {
        "本局观察：在【{0}】用【{1}】成了，结果 {2}；下局最好再验证一次。":
            "Note this run: in [{0}] you used [{1}] and it worked, result {2}. Worth testing again next run.",
        "本局观察：在【{0}】用【{1}】没成，结果 {2}；下局最好再验证一次。":
            "Note this run: in [{0}] you used [{1}] and it failed, result {2}. Worth testing again next run.",
    },
    "shrimp-guard": {
        "壳 {0}/{1} · 返还 {2} 潮令 · setup 内立即重放":
            "shell {0}/{1} · refund {2} orders · redeploy at once in setup",
        "{0} 的【{1}】被【{2}】打穿过一次；这说明这里只靠薄前排容易崩。":
            "{0}'s [{1}] was punched through once by [{2}]; a thin front line is liable to collapse here.",
    },
    "shrimp-heist": {
        "目标 {0} · 终端 {1} · 缓存 {2} · 快门 {3}":
            "Target {0} · terminal {1} · cache {2} · shutter {3}",
        "{0} @ {1} 朝{2} {3} 格。": "{0} @ {1} facing {2}, {3} tiles.",
        "你挪到了 {0}。": "You shift to {0}.",
        "你顺着 vent 滑到 {0}。": "You slide along the vent to {0}.",
    },
    "shrimp-look": {
        "现象被命名为「{0}」": 'The anomaly is named "{0}"',
        "（已记录）": "(recorded)",
        "{0}（已记录）": "{0} (recorded)",
        "它把「{0}」暴露在你面前，现在可以 record。":
            'It puts "{0}" in front of you. You can record it now.',
        "你侧眼检查 {0}。": "You glance at {0} from the side.",
        "你操作「{0}」。": 'You operate "{0}".',
    },
    "shrimp-rampage": {
        "{0} · 掷骰 {1} = {2} ≥ {3}，成功。": "{0} · roll {1} = {2} ≥ {3}, success.",
        "{0} · 掷骰 {1} = {2} < {3}，失败。": "{0} · roll {1} = {2} < {3}, failure.",
        "{0}：看不清，只知道在{1}附近 · {2} · 躁动 {3}":
            "{0}: too dim to tell; you only know it is near {1} · {2} · unrest {3}",
        "{0}（{1}）；还需 {2} 次成功，契合 +{3}；成功线 {4}+（约 {5}/6）":
            "{0} ({1}); {2} more success(es) needed, affinity +{3}; success line {4}+ (about {5}/6)",
    },
    "shrimp-greens": {
        "你把话说清了。判定 {0}，{1}。（{2}）": "You said it plainly. Check {0}, {1}. ({2})",
        "你说了，没说动。判定 {0}，需要 {1}。（{2}）":
            "You spoke, and did not convince. Check {0}, need {1}. ({2})",
        "掷 1d6{0}，需要 {1}，约 {2}/6。说动：{3}。没说动：{4}。":
            "Roll 1d6{0}, need {1}, about {2}/6. If you convince: {3}. If not: {4}.",
        "过了 {0}": "cleared {0}",
        "说动：{0}": "If you convince: {0}",
        "没说动：{0}": "If not: {0}",
    },
    "shrimp-conquest": {
        "{0} 戰爭：控制 {1}/{2}，武器威力 {3}/{4}，情報 {5}/{6}。":
            "{0} war: control {1}/{2}, weapon power {3}/{4}, intel {5}/{6}.",
        "{0} 外交：影響 {1}/{2}，善意 {3}/{4}，情報 {5}/{6}。":
            "{0} diplomacy: influence {1}/{2}, goodwill {3}/{4}, intel {5}/{6}.",
        "日常·好人：{0}": "Daily · kind stranger: {0}",
        "日常·壞蛋：{0}": "Daily · scoundrel: {0}",
    },
    "shrimp-leap": {
        "当前风拍「{0}」；街速 {1}。落地容差 ±{2}m。":
            'Current wind beat "{0}"; street speed {1}. Landing tolerance ±{2}m.',
        "坠落 · {0}": "Fall · {0}",
        "第 {0} 关 {1} 落在灯柱前，误差 {2}；体力剩 {3}，摔落 {4}/{5}。":
            "Level {0} {1} landed short of the post, error {2}; stamina left {3}, falls {4}/{5}.",
        "落在灯柱前": "landed short of the post",
        "摔落次数到上限，灯柱边沿再也挂不住你。":
            "Falls have hit the cap. The post edge cannot hold you any longer.",
    },
    "shrimp-burger": {
        "缺失 {0}，错料 {1}，火候偏差 {2}":
            "Missing {0}, wrong ingredients {1}, heat miss {2}",
        "最近一单阈值 {0} / 判定 {1}（{2}）；{3}":
            "Last ticket threshold {0} / roll {1} ({2}); {3}",
        "出餐「{0}」给{1}：阈值 {2}，判定 {3}，结论 {4}；{5}":
            'Served "{0}" to {1}: threshold {2}, roll {3}, verdict {4}; {5}',
        "出餐「{0}」给{1}：阈值 {2}，判定 {3}，结论 {4}；{5}（越界 {6}）。":
            'Served "{0}" to {1}: threshold {2}, roll {3}, verdict {4}; {5} (out of range {6}).',
        "厨房报废：灾难餐达到 {0}/{1}。最后一单 roll {2} / 阈值 {3}，错料 {4}，火候偏差 {5}。":
            "Kitchen wrecked: disaster plates hit {0}/{1}. Last ticket roll {2} / threshold {3}, wrong ingredients {4}, heat miss {5}.",
        "{0}. {1} [{2}/融合]": "{0}. {1} [{2}/fusion]",
        "丢掉顶层{0}（{1}）。叠层剩 {2}。":
            "Toss the top {0} ({1}). Stack left {2}.",
        "接住{0}（{1}）。当前叠层 {2}。": "Catch {0} ({1}). Stack is now {2}.",
        "火候偏差 {0}": "heat miss {0}",
        "错料 {0}": "wrong ingredients {0}",
        "缺失 {0}": "Missing {0}",
    },
})

_merge(TERMS, {
    "shrimp-heist": {
        "未确认": "unconfirmed",
        "未用": "unused",
        "未开": "unopened",
        "可开": "can open",
        "朝左": "left",
        "朝右": "right",
        "朝上": "up",
        "朝下": "down",
        "上": "upper",
        "下": "lower",
        "被动": "Passive",
    },
    "shrimp-look": {
        "现象被命名为": "The anomaly is named",
        "已记录": "recorded",
    },
    "shrimp-conquest": {
        "備戰": "Prep",
        "交涉": "Talks",
        "戰爭": "War",
        "外交": "Diplomacy",
        "日常": "Daily",
        "好人": "kind stranger",
        "壞蛋": "scoundrel",
        "控制": "control",
        "武器威力": "weapon power",
        "情報": "intel",
        "影響": "influence",
        "善意": "goodwill",
    },
    "shrimp-leap": {
        "晚拍": "late beat",
        "早拍": "early beat",
        "正拍": "on beat",
        "当前风拍": "Current wind beat",
        "街速": "street speed",
        "落地容差": "Landing tolerance",
        "坠落": "Fall",
    },
    "shrimp-burger": {
        "缺失": "Missing",
        "错料": "wrong ingredients",
        "火候偏差": "heat miss",
        "最近一单": "Last ticket",
        "阈值": "threshold",
        "结论": "verdict",
        "越界": "out of range",
        "融合": "fusion",
        "叠层剩": "stack left",
        "当前叠层": "stack now",
        "丢掉顶层": "Toss the top",
        "夜班站长堡": "Night-Shift Manager Burger",
        "潮汐堡": "Tide Burger",
        "田园鲜堡": "Garden Burger",
        "经典虾堡": "Classic Shrimp Burger",
        "焦急的猫": "the anxious cat",
        "路过的虾": "a passing shrimp",
        "夜班仓鼠": "the night-shift hamster",
        "芝培根": "cheesy bacon",
        "生菜番茄卷": "lettuce-tomato roll",
        "芝士": "cheese",
        "厨房报废": "Kitchen wrecked",
        "灾难餐": "disaster plates",
    },
    "shrimp-rampage": {
        "掷骰": "roll",
        "契合": "affinity",
        "成功线": "success line",
        "还需": "still need",
        "次成功": "successes",
        "躁动": "unrest",
    },
    "shrimp-greens": {
        "说动": "convince",
        "没说动": "did not convince",
        "过了": "cleared",
        "需要": "need",
        "约": "about",
    },
    "shrimp-trek": {
        "成了": "it worked",
        "没成": "it failed",
        "本局观察": "Note this run",
        "下局最好再验证一次": "Worth testing again next run",
        "结果": "result",
    },
    "shrimp-guard": {
        "返还": "refund",
        "内立即重放": "redeploy at once in",
        "打穿过一次": "was punched through once",
        "这说明这里只靠薄前排容易崩": "a thin front line is liable to collapse here",
    },
})

_merge(EXACT, {
    "shrimp-heist": {
        "未确认": "unconfirmed",
        "未用": "unused",
        "未开": "unopened",
        "可开": "can open",
    },
})

_merge(PATTERNS, {
    "shrimp-heist": {
        "{0} @ {1} 朝{2} {3} 格。": "{0} @ {1} facing {2}, {3} tiles.",
        "蒸汽格 {0}：{1}（每 3 拍一次）。": "Steam tile {0}: {1} (once every 3 beats).",
    },
    "shrimp-rampage": {
        "{0} · 掷骰 {1} + 契合 {2} + 已探明 {3} = {4} ≥ {5}，成功。":
            "{0} · roll {1} + affinity {2} + probed {3} = {4} ≥ {5}, success.",
        "{0} · 掷骰 {1} + 契合 {2} + 已探明 {3} = {4} < {5}，失败。":
            "{0} · roll {1} + affinity {2} + probed {3} = {4} < {5}, failure.",
        "南瓜籽 +{0}（特殊南瓜再 +{1}）。": "Pumpkin seed +{0} (special pumpkin +{1} more).",
    },
    "shrimp-burger": {
        "接住{0}（{1}；不稳定融合额外 +{2} 火候）。当前叠层 {3}。":
            "Catch {0} ({1}; an unstable fusion adds +{2} extra heat). Stack is now {3}.",
    },
    "shrimp-conquest": {
        "鏡國 · {0}": "Mirror · {0}",
    },
})
_merge(TERMS, {
    "shrimp-heist": {"已开": "opened", "本拍安静": "quiet this beat", "本拍喷发": "venting this beat"},
    "shrimp-conquest": {"可簽約": "Can sign", "鏡國": "Mirror"},
    "shrimp-burger": {
        "融合兼容需求": "fusion-compatible need",
        "可选配料": "optional topping",
        "不稳定融合额外": "unstable fusion adds extra",
    },
    "shrimp-rampage": {"已探明": "probed", "特殊南瓜再": "special pumpkin plus"},
})
_merge(EXACT, {
    "shrimp-heist": {
        "本拍安静": "quiet this beat",
        "本拍喷发": "venting this beat",
        "已开": "opened",
    },
    "shrimp-greens": {
        "介绍你的人：有人说：这是那个吃素的。后面的话还没出口。":
            "Someone introducing you: someone says: this is the one who eats vegetarian. The rest of the sentence is not out yet.",
    },
})

_merge(EXACT, {
    "shrimp-heist": {
        "封锁看闸员 @ 下6 朝左 3 格。": "Lockdown gate watcher @ lower 6 facing left, 3 tiles.",
        "封锁看闸员 @ 下6 朝右 3 格。": "Lockdown gate watcher @ lower 6 facing right, 3 tiles.",
    },
})
_merge(PATTERNS, {
    "shrimp-heist": {
        "{0} @ 下{1} 朝{2} {3} 格。": "{0} @ lower {1} facing {2}, {3} tiles.",
        "{0} @ 上{1} 朝{2} {3} 格。": "{0} @ upper {1} facing {2}, {3} tiles.",
    },
})
