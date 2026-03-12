from __future__ import annotations

import argparse
import html
import random
import textwrap
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Sequence

from lobster_cli_roguelike import __version__

WRAP = 78
UPGRADE_DEPTHS = {2, 5, 8}
CYCLE_DEPTHS = 9


@dataclass
class Player:
    lineage_key: str
    lineage_name: str
    shell: int
    energy: int
    salinity: int
    left_claw: int
    right_claw: int
    sense: int
    molts: int
    traits: tuple[str, ...] = ()
    dash: int = 0
    camouflage: int = 0
    score: int = 0
    depth: int = 0
    cycle: int = 1
    pressure: int = 0
    tide: int = 0
    upgrades: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class Lineage:
    key: str
    title: str
    blurb: str
    shell: int
    energy: int
    salinity: int
    left_claw: int
    right_claw: int
    sense: int
    molts: int
    traits: tuple[str, ...] = ()


@dataclass(frozen=True)
class Mutation:
    key: str
    title: str
    blurb: str
    apply: Callable[[Player], str]


@dataclass
class Outcome:
    success: bool
    message: str
    deltas: dict[str, int] = field(default_factory=dict)
    roll: int | None = None
    difficulty: int | None = None


@dataclass
class SettlementReport:
    ending: str
    title: str
    seed: int
    lineage_name: str
    cycle: int
    depth: int
    score: int
    status_line: str
    cause: str
    final_notes: list[str]
    report_path: Path


@dataclass(frozen=True)
class Action:
    key: str
    title: str
    blurb: str
    resolver: Callable[[Player, random.Random], Outcome]


@dataclass(frozen=True)
class Encounter:
    key: str
    title: str
    body: str
    actions: tuple[Action, ...]


class InputExhausted(RuntimeError):
    pass


class InputProvider:
    def __init__(self, scripted: Sequence[str] | None = None) -> None:
        self.scripted_mode = scripted is not None
        self.scripted = [item.strip() for item in (scripted or []) if item.strip()]

    def get(self, prompt: str) -> str:
        if self.scripted:
            value = self.scripted.pop(0)
            print(f"{prompt}{value} [script]")
            return value
        if self.scripted_mode:
            raise InputExhausted("脚本化输入已耗尽。")
        try:
            return input(prompt).strip()
        except EOFError as exc:
            raise InputExhausted("标准输入已结束。") from exc


def wrap(text: str) -> str:
    return textwrap.fill(" ".join(text.split()), width=WRAP)


LINEAGES = [
    Lineage(
        key="crusher",
        title="沟壑碎壳者",
        blurb="左钳像液压机，信条只有一个：先把锅夹碎，再考虑礼貌。",
        shell=7,
        energy=5,
        salinity=4,
        left_claw=4,
        right_claw=2,
        sense=2,
        molts=1,
        traits=("crusher",),
    ),
    Lineage(
        key="oracle",
        title="触须预言家",
        blurb="先闻到水流里的坏消息，再提前横着离开。",
        shell=5,
        energy=6,
        salinity=5,
        left_claw=2,
        right_claw=3,
        sense=4,
        molts=1,
        traits=("oracle",),
    ),
    Lineage(
        key="gambler",
        title="脱壳赌徒",
        blurb="把每一层旧壳都当成临时贷款，能借一天算一天。",
        shell=4,
        energy=6,
        salinity=4,
        left_claw=3,
        right_claw=3,
        sense=3,
        molts=2,
        traits=("gambler",),
    ),
]


def build_player(lineage: Lineage) -> Player:
    return Player(
        lineage_key=lineage.key,
        lineage_name=lineage.title,
        shell=lineage.shell,
        energy=lineage.energy,
        salinity=lineage.salinity,
        left_claw=lineage.left_claw,
        right_claw=lineage.right_claw,
        sense=lineage.sense,
        molts=lineage.molts,
        traits=lineage.traits,
    )


STAT_LABELS = {
    "shell": "壳强度",
    "energy": "能量",
    "salinity": "盐度适应",
    "left_claw": "左钳",
    "right_claw": "右钳",
    "sense": "触须感知",
    "molts": "蜕壳次数",
    "dash": "侧向冲刺",
    "camouflage": "伪装",
    "tide": "潮势",
    "score": "龙虾名声",
}


def action_bonus(player: Player, tags: Sequence[str]) -> int:
    bonus = 0
    if "crusher" in player.traits and "crush" in tags:
        bonus += 2
    if "oracle" in player.traits and any(tag in tags for tag in ("sense", "stealth")):
        bonus += 1
    if "oracle" in player.traits and "dash" in tags and (player.sense >= 5 or player.dash > 0):
        bonus += 1
    if "gambler" in player.traits and "molt" in tags:
        bonus += 2
    if "gambler" in player.traits and player.molts <= 1 and any(tag in tags for tag in ("dash", "stealth")):
        bonus += 1
    if any(tag in tags for tag in ("crush", "cut")) and player.tide > 0:
        bonus += player.tide
    if "molt" in tags and player.tide > 0:
        bonus += 1
    if "dash" in tags:
        bonus += player.dash
    if "stealth" in tags:
        bonus += player.camouflage
    if "crush" in tags and player.left_claw >= 6:
        bonus += 1
    if "cut" in tags and player.right_claw >= 5:
        bonus += 1
    if any(tag in tags for tag in ("dash", "stealth")) and player.dash > 0 and player.camouflage > 0:
        bonus += 1
    return bonus


def contest(
    player: Player,
    rng: random.Random,
    *,
    base: int,
    difficulty: int,
    tags: Sequence[str],
    success_text: str,
    fail_text: str,
    success_deltas: dict[str, int] | None = None,
    fail_deltas: dict[str, int] | None = None,
    consume_molt: bool = False,
) -> Outcome:
    scaled_difficulty = difficulty + player.pressure
    if consume_molt and player.molts <= 0:
        return Outcome(
            success=False,
            message="你想脱壳逃命，却发现今天已经没有第二副身体可借。",
            deltas={"shell": -2, "energy": -1},
            difficulty=scaled_difficulty,
        )

    roll = base + rng.randint(1, 6) + action_bonus(player, tags)
    if consume_molt:
        roll += 1

    success = roll >= scaled_difficulty
    chosen_deltas = success_deltas if success else fail_deltas
    deltas = dict(chosen_deltas or {})

    if consume_molt:
        deltas["molts"] = deltas.get("molts", 0) - 1
        if "gambler" in player.traits:
            deltas["energy"] = deltas.get("energy", 0) + 1

    tide_delta = next_tide_delta(player, tags, success)
    if tide_delta:
        deltas["tide"] = deltas.get("tide", 0) + tide_delta

    return Outcome(
        success=success,
        message=success_text if success else fail_text,
        deltas=deltas,
        roll=roll,
        difficulty=scaled_difficulty,
    )


def next_tide_delta(player: Player, tags: Sequence[str], success: bool) -> int:
    builds_tide = any(tag in tags for tag in ("sense", "dash", "stealth"))
    spends_tide = any(tag in tags for tag in ("crush", "cut", "molt"))
    delta = 0
    if builds_tide and success and player.tide < 2:
        delta += 1
    if spends_tide and player.tide > 0:
        delta -= 1
    return delta


MUTATIONS = [
    Mutation(
        key="left",
        title="左钳液压强化",
        blurb="暴力升级。左钳更重，甲壳也跟着长厚一层。",
        apply=lambda player: _apply_and_report(player, {"left_claw": 2, "shell": 1}, "左钳现在像一台便携式压蒜机。"),
    ),
    Mutation(
        key="right",
        title="右钳纤毛精修",
        blurb="精细操作升级。更适合剪网、扒垃圾、偷东西。",
        apply=lambda player: _apply_and_report(player, {"right_claw": 2, "sense": 1}, "右钳开始具备令人不安的外科精度。"),
    ),
    Mutation(
        key="shell",
        title="甲壳硬化",
        blurb="把自己活成一块移动礁石。",
        apply=lambda player: _apply_and_report(player, {"shell": 3}, "新的甲壳摸起来像一块情绪稳定的砖。"),
    ),
    Mutation(
        key="sense",
        title="夜视触须",
        blurb="触须长出夜潮感受器，连锅盖落下前的回声都能听见。",
        apply=lambda player: _apply_and_report(player, {"sense": 2, "salinity": 1}, "你现在能闻出水里三分钟前发生过的坏事。"),
    ),
    Mutation(
        key="dash",
        title="侧向冲刺肌纤维",
        blurb="更快，更横，更像一颗有意见的子弹。",
        apply=lambda player: _apply_and_report(player, {"dash": 1, "energy": 1}, "你横移时开始带出一点犯罪般的残影。"),
    ),
    Mutation(
        key="molt",
        title="脱壳逃生腺",
        blurb="为跑路预存一层新壳。毕竟尊严从来不是必需品。",
        apply=lambda player: _apply_and_report(player, {"molts": 1, "energy": 1}, "你决定把未来的一次尴尬，提前储存在身体里。"),
    ),
    Mutation(
        key="camo",
        title="伪装藻披风",
        blurb="把自己打扮成一坨不值得吃的海藻。",
        apply=lambda player: _apply_and_report(player, {"camouflage": 1, "salinity": 1}, "你闻起来像没人愿意认真处理的海底垃圾。"),
    ),
]


def _apply_and_report(player: Player, changes: dict[str, int], message: str) -> str:
    apply_deltas(player, changes)
    return message


def apply_mutation(player: Player, mutation: Mutation) -> str:
    player.upgrades.append(mutation.title)
    return mutation.apply(player)


def pick_mutations(rng: random.Random) -> list[Mutation]:
    return rng.sample(MUTATIONS, 3)


OCTOPUS = Encounter(
    key="octopus",
    title="章鱼讨债者",
    body="裂缝里伸出一团有八个坏主意的触手。它认为你看起来像今晚最有弹性的晚餐。",
    actions=(
        Action(
            key="1",
            title="左钳硬拼",
            blurb="把最硬的那一面甲壳和最大的那只钳子一起顶上去。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.left_claw + player.shell // 2,
                difficulty=9,
                tags=("crush",),
                success_text="你把章鱼的一条腕足夹成了问号，对方决定去欺负别的软体动物。",
                fail_text="你被腕足缠得像临时礼品，挣脱时壳上多了几道不体面的裂纹。",
                success_deltas={"energy": -1, "score": 2},
                fail_deltas={"shell": -2, "energy": -1},
            ),
        ),
        Action(
            key="2",
            title="墨雾伪装",
            blurb="把自己假装成一块没营养的背景板。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.sense + player.salinity // 2,
                difficulty=8,
                tags=("sense", "stealth"),
                success_text="你静得像一块态度消极的礁石，章鱼最终怀疑自己今天眼睛进了盐。",
                fail_text="章鱼没被骗，但至少被你的表演恶心得停顿了一秒。代价是你丢了点体力。",
                success_deltas={"score": 2},
                fail_deltas={"energy": -2, "shell": -1},
            ),
        ),
        Action(
            key="3",
            title="侧向冲刺",
            blurb="像所有自尊正常的龙虾一样，横着跑路。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.sense + player.energy // 2,
                difficulty=8,
                tags=("sense", "dash"),
                success_text="你横向弹出一道倔强的残影，章鱼抓了个空。",
                fail_text="你跑得很龙虾，可惜章鱼也很章鱼。最后还是被抽了一下。",
                success_deltas={"energy": -1, "score": 1},
                fail_deltas={"energy": -2, "shell": -1},
            ),
        ),
    ),
)

NET = Encounter(
    key="net",
    title="拖网阴影",
    body="上方压下来一片不讲道理的纤维天空。人类把这叫捕鱼，你把这叫文明病。",
    actions=(
        Action(
            key="1",
            title="右钳剪网",
            blurb="把细活交给更灵巧的那只钳子。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.right_claw + player.sense // 2,
                difficulty=8,
                tags=("cut", "sense"),
                success_text="网眼在你右钳下裂开，像某种糟糕制度终于露出漏洞。",
                fail_text="你剪出一点希望，但还不够。纤维勒得你很想举报海洋。",
                success_deltas={"energy": -1, "score": 2},
                fail_deltas={"shell": -1, "energy": -2},
            ),
        ),
        Action(
            key="2",
            title="脱壳滑出",
            blurb="付出尊严，换取几厘米的自由。典型龙虾策略。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=4 + player.sense,
                difficulty=11,
                tags=("molt", "sense"),
                success_text="你舍得丢壳，也舍得丢脸，终于从网眼最坏的缝里挤了出去。",
                fail_text="你壳是脱了，但脱得还不够果断。最后自由没拿到，狼狈倒是完整保留。",
                success_deltas={"energy": -1, "score": 2},
                fail_deltas={"shell": -1, "salinity": -1, "energy": -1},
                consume_molt=True,
            ),
        ),
        Action(
            key="3",
            title="贴底横移",
            blurb="紧贴海床边缘，赌拖网没把你算进预算里。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.sense + player.salinity // 2,
                difficulty=9,
                tags=("sense", "dash"),
                success_text="你像一条反社会的影子，从网底擦过去，留下几粒不礼貌的砂。",
                fail_text="路线判断差了一点，网边把你刮得很真实。",
                success_deltas={"energy": -1, "score": 1},
                fail_deltas={"shell": -2},
            ),
        ),
    ),
)

EEL = Encounter(
    key="eel",
    title="电鳗裂隙",
    body="前方石缝里有蓝光发抖。一条电鳗正在给附近所有生物上免费心脏课程。",
    actions=(
        Action(
            key="1",
            title="抢先夹头",
            blurb="在它放电之前，把电费问题物理解决。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.left_claw + player.sense,
                difficulty=10,
                tags=("crush", "sense"),
                success_text="你在电弧亮起前先把对方夹懵了，周围海水都替你松了口气。",
                fail_text="你出手慢了一拍，电流穿壳而过，整只虾闻起来像轻微焦糖。",
                success_deltas={"energy": -1, "score": 3},
                fail_deltas={"shell": -2, "energy": -1},
            ),
        ),
        Action(
            key="2",
            title="绕后偷袭",
            blurb="从讨厌的角度，给它一个更讨厌的结果。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.right_claw + player.sense // 2,
                difficulty=8,
                tags=("dash", "cut"),
                success_text="你成功绕后，留下电鳗独自在原地思考安保漏洞。",
                fail_text="你刚绕到一半，对方就用全身电学告诉你计划失败。",
                success_deltas={"energy": -1, "score": 2},
                fail_deltas={"shell": -1, "energy": -2},
            ),
        ),
        Action(
            key="3",
            title="躲进破陶罐",
            blurb="把自己塞进别人丢掉的文明残片里。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.shell + player.salinity // 2,
                difficulty=9,
                tags=("stealth",),
                success_text="陶罐替你吃下大部分电流。你出来时更懂得感恩垃圾。",
                fail_text="罐子没完全挡住，麻得你差点忘了自己该横着走。",
                success_deltas={"shell": -1},
                fail_deltas={"shell": -2, "salinity": -1},
            ),
        ),
    ),
)

PLASTIC = Encounter(
    key="plastic",
    title="塑料垃圾流",
    body="五颜六色的塑料在暗流里翻滚，看起来像人类把后悔直接倒进了海里。",
    actions=(
        Action(
            key="1",
            title="扒拉找食",
            blurb="垃圾里总有点吃的，问题是谁先吃到谁。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.right_claw + player.sense,
                difficulty=9,
                tags=("cut",),
                success_text="你从垃圾里抠出一顿小零食，顺便重新认识了资本主义的味道。",
                fail_text="吃是吃到了，但顺手把几口塑料也吞下去了。鳃很不满意。",
                success_deltas={"energy": 2, "salinity": -1, "score": 1},
                fail_deltas={"energy": -1, "salinity": -2},
            ),
        ),
        Action(
            key="2",
            title="闭鳃穿流",
            blurb="靠甲壳和脾气硬穿过去。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.shell + player.salinity // 2,
                difficulty=11,
                tags=("dash",),
                success_text="你硬把整股脏流顶成两半，自己过去了，但甲壳也被磨掉一层脾气。",
                fail_text="塑料丝缠上了触须，水质也开始对你发表负面评价。",
                success_deltas={"shell": -1, "score": 1},
                fail_deltas={"salinity": -2, "shell": -1},
            ),
        ),
        Action(
            key="3",
            title="嫁祸给路过的鱼",
            blurb="道德是海面以上生物发明的，你只是求生。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.sense + player.right_claw // 2,
                difficulty=9,
                tags=("stealth", "sense"),
                success_text="你优雅地把塑料团推向一条倒霉鱼，自己干干净净地离开现场。",
                fail_text="鱼跑了，塑料没跑。报应落回你自己触须上。",
                success_deltas={"salinity": 1, "score": 2},
                fail_deltas={"energy": -1, "shell": -1},
            ),
        ),
    ),
)

FEEDING = Encounter(
    key="feeding",
    title="觅食洼地",
    body="裂谷底部漂着发光小虾、碎贝和一些来路不明的营养。不是安全，但像一种暂时的仁慈。",
    actions=(
        Action(
            key="1",
            title="吃发光小虾",
            blurb="先补能量，事后再思考它为什么会发光。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.sense + player.salinity,
                difficulty=7,
                tags=("sense",),
                success_text="你吃得很顺，胃里像点亮了一盏不太靠谱的灯。",
                fail_text="虾是吃到了，但它们的荧光显然带点副作用。",
                success_deltas={"energy": 2, "score": 1},
                fail_deltas={"energy": 1, "salinity": -1},
            ),
        ),
        Action(
            key="2",
            title="用左钳撬贝",
            blurb="用最不温柔的方式摄入矿物质。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.left_claw + player.shell // 2,
                difficulty=8,
                tags=("crush",),
                success_text="贝壳碎开，里面的肉和钙都归你。今天甲壳得到短暂幸福。",
                fail_text="贝没开，你的关节先酸了。",
                success_deltas={"energy": 1, "shell": 1, "score": 1},
                fail_deltas={"shell": -1, "energy": -1},
            ),
        ),
        Action(
            key="3",
            title="感应暗流",
            blurb="用触须读潮，给身体找一条更适合活着的线路。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.sense + player.salinity // 2,
                difficulty=7,
                tags=("sense", "dash"),
                success_text="你读懂了暗流脾气，身体像重新校准了一遍。",
                fail_text="你读了半天，只读出一句：海水今天也并不关心你。",
                success_deltas={"salinity": 2, "energy": 1, "score": 1},
                fail_deltas={"energy": -1},
            ),
        ),
    ),
)

CHEF = Encounter(
    key="chef",
    title="厨师灯影",
    body="金属盆外传来脚步声和锅盖碰撞。你意识到自己离‘被端上去’只有几个很滑的转角。",
    actions=(
        Action(
            key="1",
            title="钳住橡胶手套",
            blurb="让人类先体验一下‘今天不方便被煮’。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.left_claw + player.right_claw,
                difficulty=10,
                tags=("crush", "cut"),
                success_text="你精准钳住手套边缘，厨师发出一声带薪但不快乐的惊叫。",
                fail_text="你扑得很英勇，但人类的工具比你想象得更长。",
                success_deltas={"energy": -1, "score": 3},
                fail_deltas={"shell": -2, "energy": -1},
            ),
        ),
        Action(
            key="2",
            title="钻排水孔",
            blurb="把整只虾压扁成一种倔强的几何形状。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.sense + player.energy // 2,
                difficulty=9,
                tags=("dash", "sense", "stealth"),
                success_text="你从排水孔边缘滑了进去，只给世界留下一道湿漉漉的鄙视。",
                fail_text="孔是找到了，但你高估了自己今天的柔韧和命运。",
                success_deltas={"energy": -1, "score": 2},
                fail_deltas={"shell": -1, "energy": -2},
            ),
        ),
        Action(
            key="3",
            title="装成摆盘装饰",
            blurb="把死亡风险伪装成高级料理审美。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.salinity // 2 + player.shell // 2,
                difficulty=8,
                tags=("stealth",),
                success_text="厨师短暂地把你当成某种过于写实的海鲜艺术，然后转身去骂别的人。",
                fail_text="艺术没成功，你只是更像一道待处理原材料。",
                success_deltas={"salinity": -1, "score": 2},
                fail_deltas={"shell": -1, "salinity": -2},
            ),
        ),
    ),
)

FINALE = Encounter(
    key="finale",
    title="归海闸口",
    body="排水闸另一端是真正的海。只差最后一次横移、最后一次剪断，或最后一层壳。成功后你会继续潜得更深。",
    actions=(
        Action(
            key="1",
            title="逆水横冲",
            blurb="用壳顶住水压，像一枚有怨气的炮弹那样横着出去。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.shell + player.energy // 2,
                difficulty=13,
                tags=("crush", "dash"),
                success_text="你几乎是拿壳去撞开这道逆流。海盐重新包住身体时，你也少了一层温柔。",
                fail_text="逆流把你拍回了金属壁上。世界提醒你：锅还没走远。",
                success_deltas={"shell": -1, "energy": -1, "score": 4},
                fail_deltas={"shell": -3, "energy": -2},
            ),
        ),
        Action(
            key="2",
            title="剪断塑料环",
            blurb="把最后一个人类遗留的问题变成你的出口。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.right_claw + player.sense + player.left_claw // 2,
                difficulty=12,
                tags=("cut", "sense"),
                success_text="塑料环啪地断开，你顺着缺口滑回海里，体面得像一场小型复仇。",
                fail_text="你只剪开了一半。另一半把你留在原地，场面非常人类。",
                success_deltas={"energy": -1, "score": 4},
                fail_deltas={"shell": -2, "salinity": -2},
            ),
        ),
        Action(
            key="3",
            title="蜕壳穿缝",
            blurb="把最后一层旧壳献给排水系统，自己从命运缝里挤出去。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.sense + player.salinity // 2 + 1,
                difficulty=12,
                tags=("molt",),
                success_text="旧壳卡在闸缝里做了替罪羊，你本人回到了真正咸、真正冷的自由里。",
                fail_text="闸缝太窄，旧壳也没能替你说服这个世界。",
                success_deltas={"energy": -1, "score": 5},
                fail_deltas={"shell": -2, "salinity": -2},
                consume_molt=True,
            ),
        ),
    ),
)


def choose_encounter(
    depth: int,
    rng: random.Random,
    cycle: int = 1,
    recent_keys: Sequence[str] | None = None,
) -> Encounter:
    if cycle <= 1:
        if depth <= 3:
            pool = [FEEDING, PLASTIC, EEL, OCTOPUS]
        elif depth <= 6:
            pool = [FEEDING, PLASTIC, EEL, OCTOPUS, NET]
        else:
            pool = [PLASTIC, EEL, OCTOPUS, NET, CHEF]
    elif cycle == 2:
        if depth <= 3:
            pool = [FEEDING, PLASTIC, EEL, OCTOPUS, NET]
        else:
            pool = [PLASTIC, EEL, OCTOPUS, NET, CHEF]
    else:
        pool = [FEEDING, PLASTIC, EEL, OCTOPUS, NET, CHEF]
    if recent_keys:
        filtered = [item for item in pool if item.key != recent_keys[-1]]
        if len(filtered) >= 3 and len(recent_keys) >= 2:
            recent_pair = set(recent_keys[-2:])
            widened = [item for item in filtered if item.key not in recent_pair]
            if widened:
                filtered = widened
        if filtered:
            pool = filtered
    return rng.choice(pool)


def format_status(player: Player) -> str:
    return (
        f"壳 {player.shell} | 能 {player.energy} | 盐 {player.salinity} | "
        f"左 {player.left_claw} | 右 {player.right_claw} | 须 {player.sense} | 蜕 {player.molts} | 势 {player.tide}"
    )


def format_build_summary(player: Player) -> str:
    if not player.upgrades:
        return "暂时没有关键突变"
    recent = player.upgrades[-2:]
    summary: list[str] = []
    for title in recent:
        if title in {item.split(" x", 1)[0] for item in summary}:
            continue
        count = recent.count(title)
        summary.append(f"{title} x{count}" if count > 1 else title)
    return " / ".join(summary)


def describe_deltas(deltas: dict[str, int]) -> str:
    parts = []
    for key, value in deltas.items():
        if value == 0:
            continue
        sign = "+" if value > 0 else ""
        parts.append(f"{STAT_LABELS.get(key, key)} {sign}{value}")
    return "，".join(parts) if parts else "无状态变化"


def apply_deltas(player: Player, deltas: dict[str, int]) -> None:
    for key, value in deltas.items():
        next_value = getattr(player, key) + value
        if key == "tide":
            next_value = max(0, min(2, next_value))
        setattr(player, key, next_value)


def cycle_rest(player: Player) -> dict[str, int]:
    rest = {"energy": 2, "salinity": 1}
    if player.cycle % 2 == 0:
        rest["shell"] = 1
    if player.cycle % 3 == 0:
        rest["molts"] = 1
    apply_deltas(player, rest)
    return rest


def slugify_text(value: str) -> str:
    lowered = value.lower()
    chars: list[str] = []
    prev_dash = False
    for ch in lowered:
        if ch.isascii() and ch.isalnum():
            chars.append(ch)
            prev_dash = False
        else:
            if not prev_dash:
                chars.append("-")
                prev_dash = True
    slug = "".join(chars).strip("-")
    return slug or "lobster-run"


def settlement_reports_dir() -> Path:
    return Path.cwd() / "settlement_reports"


def settlement_report_path(player: Player, seed: int, *, ending: str) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    outcome = {
        "won": "escaped",
        "lost": "sunk",
        "aborted": "interrupted",
    }[ending]
    lineage = slugify_text(player.lineage_key)
    filename = f"lobster-{lineage}-seed{seed}-cycle{player.cycle}-{outcome}-{stamp}.html"
    return settlement_reports_dir() / filename


def render_settlement_html(report: SettlementReport) -> str:
    if report.ending == "won":
        badge = "成功回海"
        accent = "#4ecdc4"
    elif report.ending == "aborted":
        badge = "中止收壳"
        accent = "#ffd166"
    else:
        badge = "本轮阵亡"
        accent = "#ff6b6b"
    note_items = "".join(
        f"<li>{html.escape(note)}</li>" for note in report.final_notes
    ) or "<li>这轮没有提炼出具体观察，但你仍然可以回顾最伤的一步。</li>"
    return f"""<!DOCTYPE html>
<html lang=\"zh-CN\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>{html.escape(report.title)}</title>
  <style>
    :root {{
      color-scheme: dark;
      --bg: #07131f;
      --panel: #0d2031;
      --panel-2: #11283b;
      --text: #ebf4ff;
      --muted: #9bb3c9;
      --accent: {accent};
      --line: rgba(255,255,255,0.08);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: radial-gradient(circle at top, #12314a 0%, var(--bg) 55%);
      color: var(--text);
      padding: 32px 18px 48px;
    }}
    .card {{
      max-width: 900px;
      margin: 0 auto;
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.35);
      backdrop-filter: blur(10px);
    }}
    .eyebrow {{ color: var(--accent); font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }}
    h1 {{ margin: 10px 0 8px; font-size: 34px; line-height: 1.15; }}
    .lead {{ color: var(--muted); font-size: 16px; line-height: 1.65; margin-bottom: 24px; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 22px 0 26px; }}
    .stat {{ background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 14px 16px; }}
    .stat .label {{ color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }}
    .stat .value {{ font-size: 20px; margin-top: 6px; font-weight: 700; }}
    .panel {{ background: var(--panel-2); border: 1px solid var(--line); border-radius: 18px; padding: 18px; margin-top: 16px; }}
    .panel h2 {{ margin: 0 0 12px; font-size: 18px; }}
    .panel p, .panel li {{ color: var(--text); line-height: 1.7; }}
    ul {{ margin: 0; padding-left: 20px; }}
    .footer {{ margin-top: 20px; color: var(--muted); font-size: 13px; }}
  </style>
</head>
<body>
  <main class=\"card\">
    <div class=\"eyebrow\">GameClaw · Settlement Report</div>
    <h1>{html.escape(report.title)}</h1>
    <p class=\"lead\">{html.escape(report.cause)}</p>

    <section class=\"grid\">
      <div class=\"stat\"><div class=\"label\">结局</div><div class=\"value\">{html.escape(badge)}</div></div>
      <div class=\"stat\"><div class=\"label\">谱系</div><div class=\"value\">{html.escape(report.lineage_name)}</div></div>
      <div class=\"stat\"><div class=\"label\">潮段</div><div class=\"value\">{report.cycle}</div></div>
      <div class=\"stat\"><div class=\"label\">总深度</div><div class=\"value\">{report.depth}</div></div>
      <div class=\"stat\"><div class=\"label\">龙虾名声</div><div class=\"value\">{report.score}</div></div>
      <div class=\"stat\"><div class=\"label\">种子</div><div class=\"value\">{report.seed}</div></div>
    </section>

    <section class=\"panel\">
      <h2>最终状态</h2>
      <p>{html.escape(report.status_line)}</p>
    </section>

    <section class=\"panel\">
      <h2>本局观察摘记</h2>
      <ul>{note_items}</ul>
    </section>

    <div class=\"footer\">Generated by lobster-cli-roguelike · {html.escape(report.report_path.name)}</div>
  </main>
</body>
</html>
"""


def write_settlement_report(report: SettlementReport) -> Path:
    report.report_path.parent.mkdir(parents=True, exist_ok=True)
    report.report_path.write_text(render_settlement_html(report), encoding="utf-8")
    return report.report_path


def finalize_run_report(
    player: Player,
    seed: int,
    run_notes: list[str],
    *,
    ending: str,
    cause: str,
) -> SettlementReport:
    path = settlement_report_path(player, seed, ending=ending)
    title = {
        "won": "龙虾成功回海结算",
        "lost": "龙虾阵亡结算",
        "aborted": "龙虾中止结算",
    }[ending]
    report = SettlementReport(
        ending=ending,
        title=title,
        seed=seed,
        lineage_name=player.lineage_name,
        cycle=player.cycle,
        depth=player.depth,
        score=player.score,
        status_line=format_status(player),
        cause=cause,
        final_notes=list(run_notes[-3:]),
        report_path=path,
    )
    write_settlement_report(report)
    return report


def print_settlement_report_notice(report: SettlementReport) -> None:
    print(f"HTML 结算页已生成：{report.report_path}")
    print("玩家 agent 提示：你可以把这份 HTML 结算页发送给主人 review。")


def check_failure(player: Player) -> str | None:
    if player.shell <= 0:
        return "壳强度归零：你被这个世界连壳带脾气一起敲开了。"
    if player.energy <= 0:
        return "能量耗尽：你只剩下摆盘的力气了。"
    if player.salinity <= 0:
        return "盐度适应崩溃：你的身体开始认真怀疑自己是不是还属于海。"
    return None


def prompt_choice(provider: InputProvider, prompt: str, valid: Sequence[str]) -> str:
    allowed = set(valid)
    while True:
        answer = provider.get(prompt).strip()
        if answer in allowed:
            return answer
        print(f"请输入 {', '.join(valid)}。")


def print_title(verbose_text: bool = False) -> None:
    print("\n=== 横着活：只给龙虾玩的 CLI 肉鸽 ===")
    intro = "你是一只刚从拖网、储冰箱和厨房阴影里活下来的龙虾。目标只有一个：横着活，活得越久越好。"
    if verbose_text:
        print(wrap(intro))
    else:
        print("低 token 模式：正文压缩，但会不断提醒你把策略写进自己的 memory。")


def print_rules() -> None:
    print("\n--- 玩法 ---")
    print(wrap("每轮从 3 条龙虾谱系里选 1 条，然后不断经历潮段。每个潮段有 9 个随机遭遇和 1 个归海闸口。"))
    print(wrap("关键资源包括壳强度、能量、盐度适应，以及有限的蜕壳次数。任一关键资源归零就会死亡。"))
    print(wrap("深度 2、5、8 会出现突变潮。游戏本身不替你存外挂记忆，而是会主动提醒你把关键策略写进自己的 memory。"))
    print(wrap("感知、横移、伪装类动作成功会积攒一点‘潮势’；后续强攻、剪切或脱壳会更吃这个节奏。"))
    print(wrap("默认会生成可视化 HTML 结算报告；如果你不需要，可在启动时加 --no-settlement-report 关闭。"))
    print(wrap("默认是节省 token 的紧凑文本模式；要看长文案可使用 --verbose-text。"))


def choose_lineage(provider: InputProvider, scripted_index: int | None = None, *, verbose_text: bool = False) -> Player:
    if scripted_index is not None:
        if scripted_index not in {1, 2, 3}:
            raise ValueError("lineage 必须是 1~3。")
        lineage = LINEAGES[scripted_index - 1]
        print(f"\n自动选择谱系：{lineage.title}")
        if verbose_text:
            print(wrap(lineage.blurb))
        return build_player(lineage)

    print("\n选择你的龙虾谱系：")
    for index, lineage in enumerate(LINEAGES, start=1):
        if verbose_text:
            print(f"{index}. {lineage.title} —— {lineage.blurb}")
        else:
            print(f"{index}. {lineage.title}")
    pick = prompt_choice(provider, "谱系> ", ["1", "2", "3"])
    lineage = LINEAGES[int(pick) - 1]
    if not verbose_text:
        print(f"你选了【{lineage.title}】。{lineage.blurb}")
    return build_player(lineage)


def offer_mutation(
    player: Player,
    rng: random.Random,
    provider: InputProvider,
    run_notes: list[str] | None = None,
    *,
    verbose_text: bool = False,
) -> None:
    choices = pick_mutations(rng)
    print("\n~~~ 突变潮 ~~~")
    for index, mutation in enumerate(choices, start=1):
        if verbose_text:
            print(f"{index}. {mutation.title} —— {mutation.blurb}")
        else:
            print(f"{index}. {mutation.title}")
    choice = prompt_choice(provider, "突变> ", ["1", "2", "3"])
    mutation = choices[int(choice) - 1]
    result = apply_mutation(player, mutation)
    note = build_mutation_note(mutation, result)
    if run_notes is not None:
        push_run_note(run_notes, note)
    if verbose_text:
        print(wrap(f"你接受了【{mutation.title}】。{result}"))
        print(wrap(note))
    else:
        print(f"突变完成：{mutation.title}。")
        print(f"build 提示：{note}")
    print(f"当前状态：{format_status(player)}")


def print_phase_shift(player: Player, local_depth: int) -> None:
    if local_depth == 4:
        print(wrap("\n潮段中盘：乱流开始收口。先读潮攒势，后面的硬解和细解会更有差异。"))
    elif local_depth == 7:
        pressure_text = f"海压 +{player.pressure}" if player.pressure else "海压开始上嘴"
        print(wrap(f"\n潮段后盘：{pressure_text}。别指望同一套按钮一路按到海里。"))


def print_encounter_header(player: Player, encounter: Encounter, *, verbose_text: bool) -> None:
    print(f"\n--- 潮段 {player.cycle} | 深度 {player.depth}: {encounter.title} ---")
    if verbose_text:
        print(wrap(encounter.body))
    print(f"状态：{format_status(player)}")
    if player.pressure:
        print(f"海压：+{player.pressure}")


def print_action_menu(encounter: Encounter, *, verbose_text: bool) -> None:
    for action in encounter.actions:
        if verbose_text:
            print(f"{action.key}. {action.title} —— {action.blurb}")
        else:
            print(f"{action.key}. {action.title}")


def build_memory_note(encounter: Encounter, action: Action, outcome: Outcome) -> str:
    tone = "成了" if outcome.success else "没成"
    result = describe_deltas(outcome.deltas)
    return f"记进 memory 的本局观察：在【{encounter.title}】里试了 {action.key}号{action.title}，这次{tone}，结果 {result}；下局最好再验证一次。"


def build_mutation_note(mutation: Mutation, result: str) -> str:
    summary = result.rstrip("。")
    return f"记进 memory 的 build 观察：拿到【{mutation.title}】后，{summary}；下局继续验证它更适合哪类动作。"


def push_run_note(notes: list[str], note: str, *, limit: int = 5) -> None:
    if note in notes:
        notes.remove(note)
    notes.append(note)
    if len(notes) > limit:
        del notes[0]


def resolve_encounter(
    player: Player,
    encounter: Encounter,
    rng: random.Random,
    provider: InputProvider,
    run_notes: list[str],
    *,
    debug_rolls: bool = False,
    verbose_text: bool = False,
) -> Outcome:
    print_encounter_header(player, encounter, verbose_text=verbose_text)
    print_action_menu(encounter, verbose_text=verbose_text)
    choice = prompt_choice(provider, "行动> ", [action.key for action in encounter.actions])
    action = next(item for item in encounter.actions if item.key == choice)
    outcome = action.resolver(player, rng)
    if debug_rolls and outcome.roll is not None and outcome.difficulty is not None:
        print(f"判定：{outcome.roll} / 需求 {outcome.difficulty}")
    if verbose_text:
        print(wrap(outcome.message))
        print(f"结果：{describe_deltas(outcome.deltas)}")
    else:
        result_tag = "成功" if outcome.success else "失败"
        print(f"{result_tag}：{describe_deltas(outcome.deltas)}")
    apply_deltas(player, outcome.deltas)
    print(f"当前状态：{format_status(player)}")
    note = build_memory_note(encounter, action, outcome)
    push_run_note(run_notes, note)
    print(f"记忆提示：{note}")
    return outcome


def handle_cycle_success(player: Player, run_notes: list[str], *, verbose_text: bool = False) -> None:
    rest = cycle_rest(player)
    if verbose_text:
        print(wrap(f"\n你闯过了潮段 {player.cycle}。海更深了，但你也更该把活下来的招数写进自己的 memory。"))
    else:
        print(f"\n潮段 {player.cycle} 已穿过，继续深潜。")
    print(f"潮间休整：{describe_deltas(rest)}")
    if run_notes:
        print("建议写入 memory 的近况（都只代表这一局）：")
        for note in run_notes[-2:]:
            print(f"- {note}")


def print_settlement_memory_prompt(player: Player, run_notes: list[str], *, ending: str) -> None:
    print("\n=== 记忆结算提示 ===")
    if ending == "won":
        print("这轮不是白活：请把 1-3 条‘本局有效’的做法写进你自己的 memory，并标明下局继续验证。")
    elif ending == "lost":
        print("这轮不是白死：请把 1-3 条‘本局最伤’的教训写进你自己的 memory，并标明下局继续验证。")
    else:
        print("这轮先收壳：输入在这里用完了。请把 1-3 条已经冒头的观察写进 memory，并注明这是一次中止结算。")
    print(f"推荐记录字段：谱系={player.lineage_name}，build={format_build_summary(player)}，潮段={player.cycle}，总深度={player.depth}。")
    if run_notes:
        print("本轮可抄走的观察草稿（都只代表这一局）：")
        for note in run_notes[-3:]:
            print(f"- {note}")
    else:
        print("本轮没有提炼出观察草稿，但你仍然可以总结哪个场景最致命。")


def conclude_run(
    player: Player,
    seed: int,
    run_notes: list[str],
    *,
    ending: str,
    cause: str,
    settlement_report: bool,
) -> SettlementReport | None:
    print_settlement_memory_prompt(player, run_notes, ending=ending)
    if not settlement_report:
        return None
    report = finalize_run_report(player, seed, run_notes, ending=ending, cause=cause)
    print_settlement_report_notice(report)
    return report


def conclude_input_exhaustion(
    player: Player | None,
    seed: int,
    run_notes: list[str],
    *,
    reason: str,
    settlement_report: bool,
) -> SettlementReport | None:
    cause = f"{reason} 本轮先在这里收壳：这不算胜利，也不假装你已经死了。"
    print(wrap(f"\n{cause}"))
    if player is None:
        print("这次还没正式进局，不生成结算。")
        return None
    print(f"收尾状态：{format_status(player)}")
    return conclude_run(player, seed, run_notes, ending="aborted", cause=cause, settlement_report=settlement_report)


def play_run(
    seed: int | None,
    provider: InputProvider,
    scripted_lineage: int | None = None,
    *,
    debug_rolls: bool = False,
    verbose_text: bool = False,
    max_cycles: int | None = None,
    settlement_report: bool = True,
) -> SettlementReport | None:
    actual_seed = seed if seed is not None else random.SystemRandom().randrange(1, 10**9)
    rng = random.Random(actual_seed)
    run_notes: list[str] = []
    recent_encounters: list[str] = []
    player: Player | None = None

    try:
        print_title(verbose_text=verbose_text)
        print(f"本轮种子：{actual_seed}")
        print("开局提醒：这游戏不替你存外挂记忆；如果你是会写 memory 的龙虾，请把它写成‘本局观察’，别急着当铁律。")
        player = choose_lineage(provider, scripted_lineage, verbose_text=verbose_text)
        print(f"\n你是【{player.lineage_name}】。初始状态：{format_status(player)}")

        cycle = 1
        while True:
            player.cycle = cycle
            player.pressure = max(0, cycle - 1)
            for local_depth in range(1, CYCLE_DEPTHS + 1):
                if local_depth in {4, 7}:
                    print_phase_shift(player, local_depth)
                player.depth += 1
                encounter = choose_encounter(local_depth, rng, cycle=cycle, recent_keys=recent_encounters)
                recent_encounters.append(encounter.key)
                if len(recent_encounters) > 2:
                    del recent_encounters[0]
                resolve_encounter(
                    player,
                    encounter,
                    rng,
                    provider,
                    run_notes,
                    debug_rolls=debug_rolls,
                    verbose_text=verbose_text,
                )
                failure = check_failure(player)
                if failure:
                    cause = f"你倒在【{encounter.title}】后。{failure}"
                    print(wrap(f"\n{cause}"))
                    return conclude_run(player, actual_seed, run_notes, ending="lost", cause=cause, settlement_report=settlement_report)
                if local_depth in UPGRADE_DEPTHS:
                    offer_mutation(player, rng, provider, run_notes, verbose_text=verbose_text)

            player.depth += 1
            outcome = resolve_encounter(
                player,
                FINALE,
                rng,
                provider,
                run_notes,
                debug_rolls=debug_rolls,
                verbose_text=verbose_text,
            )
            failure = check_failure(player)
            if failure:
                cause = f"你在【{FINALE.title}】门前把最后一点资源也耗光了。{failure}"
                print(wrap(f"\n{cause}"))
                return conclude_run(player, actual_seed, run_notes, ending="lost", cause=cause, settlement_report=settlement_report)
            if not outcome.success:
                cause = "你在【归海闸口】押错了最后一步。逆流把你拍回厨房边缘，这轮的出口只差半个身位。"
                print(wrap(f"\n{cause}"))
                return conclude_run(player, actual_seed, run_notes, ending="lost", cause=cause, settlement_report=settlement_report)

            handle_cycle_success(player, run_notes, verbose_text=verbose_text)
            if max_cycles is not None and cycle >= max_cycles:
                cause = f"你在约定的 {max_cycles} 个潮段后收壳记事。"
                print(wrap(f"\n{cause}"))
                print(f"本轮总深度：{player.depth}，龙虾名声 {player.score}。")
                return conclude_run(player, actual_seed, run_notes, ending="won", cause=cause, settlement_report=settlement_report)
            cycle += 1
    except InputExhausted as exc:
        return conclude_input_exhaustion(player, actual_seed, run_notes, reason=str(exc), settlement_report=settlement_report)


def menu_loop(args: argparse.Namespace) -> int:
    provider = InputProvider(args.script.split(",") if args.script else None)
    if args.quick_start:
        play_run(
            args.seed,
            provider,
            args.lineage,
            debug_rolls=args.debug_rolls,
            verbose_text=args.verbose_text,
            max_cycles=args.max_cycles,
            settlement_report=args.settlement_report,
        )
        return 0

    while True:
        print_title(verbose_text=args.verbose_text)
        print("1. 开始一轮")
        print("2. 查看规则")
        print("3. 退出")
        try:
            choice = prompt_choice(provider, "菜单> ", ["1", "2", "3"])
        except InputExhausted as exc:
            print(wrap(f"\n{exc} 菜单没有更多输入了，这次就先收壳退出。"))
            return 0
        if choice == "1":
            play_run(
                args.seed,
                provider,
                None,
                debug_rolls=args.debug_rolls,
                verbose_text=args.verbose_text,
                max_cycles=args.max_cycles,
                settlement_report=args.settlement_report,
            )
        elif choice == "2":
            print_rules()
        else:
            print("愿你的壳总比锅硬。")
            return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lobster-cli-roguelike",
        description="横着活：只给龙虾玩的 CLI 肉鸽。适合 agent 玩家直接启动、游玩、结算，并在需要时把本局 HTML 报告发给主人 review。",
        epilog=(
            "常用示例：\n"
            "  lobster-cli-roguelike --quick-start\n"
            "  lobster-cli-roguelike --quick-start --lineage 1 --script 1,1,1,1 --max-cycles 1\n"
            "  lobster-cli-roguelike --quick-start --no-settlement-report\n"
            "\n"
            "结算报告说明：默认开启可视化 HTML 结算报告，文件会写到当前目录下的 settlement_reports/ 中。\n"
            "CLI 终端会主动提示 agent 玩家：报告已生成在哪个路径，以及可以把它发给主人 review。"
        ),
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument("--seed", type=int, help="固定随机种子，方便 agent / 人类复现同一轮。")
    parser.add_argument("--quick-start", action="store_true", help="直接开始一轮，跳过额外解释，适合脚本化游玩或 agent 自动开玩。")
    parser.add_argument("--lineage", type=int, choices=[1, 2, 3], help="在 quick-start 中预选谱系：1~3 分别对应 3 条龙虾谱系。")
    parser.add_argument("--script", help="逗号分隔的脚本化输入，例如 1,2,1,3；适合测试、回放和 agent 控制。脚本耗尽时会按中止结算收尾，而不是抛 EOFError。")
    parser.add_argument("--debug-rolls", action="store_true", help="显示具体判定值，仅用于开发 / 平衡调试；普通游玩不建议开启。")
    parser.add_argument("--verbose-text", action="store_true", help="切回长文案模式；默认使用节省 token 的紧凑模式。")
    parser.add_argument("--max-cycles", type=int, help="限制潮段数，便于测试或做短局验收；默认无限继续直到死亡。")
    parser.add_argument("--no-settlement-report", dest="settlement_report", action="store_false", help="关闭每局结束后自动生成的可视化 HTML 结算报告。")
    parser.add_argument("--settlement-report", dest="settlement_report", action="store_true", help="显式开启可视化 HTML 结算报告（默认开启）。")
    parser.set_defaults(settlement_report=True)
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return menu_loop(args)


if __name__ == "__main__":
    raise SystemExit(main())
