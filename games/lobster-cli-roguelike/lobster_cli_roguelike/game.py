from __future__ import annotations

import argparse
import random
import textwrap
from dataclasses import dataclass, field
from typing import Callable, Sequence

from lobster_cli_roguelike import __version__

WRAP = 78
UPGRADE_DEPTHS = {2, 5, 8}
RUN_DEPTHS = 9


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


class InputProvider:
    def __init__(self, scripted: Sequence[str] | None = None) -> None:
        self.scripted = [item.strip() for item in (scripted or []) if item.strip()]

    def get(self, prompt: str) -> str:
        if self.scripted:
            value = self.scripted.pop(0)
            print(f"{prompt}{value} [script]")
            return value
        return input(prompt).strip()


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
    "score": "龙虾名声",
}


def action_bonus(player: Player, tags: Sequence[str]) -> int:
    bonus = 0
    if "crusher" in player.traits and "crush" in tags:
        bonus += 1
    if "oracle" in player.traits and any(tag in tags for tag in ("sense", "stealth", "dash")):
        bonus += 1
    if "gambler" in player.traits and "molt" in tags:
        bonus += 1
    if "dash" in tags:
        bonus += player.dash
    if "stealth" in tags:
        bonus += player.camouflage
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
    if consume_molt and player.molts <= 0:
        return Outcome(
            success=False,
            message="你想脱壳逃命，却发现今天已经没有第二副身体可借。",
            deltas={"shell": -2, "energy": -1},
        )

    roll = base + rng.randint(1, 6) + action_bonus(player, tags)
    if consume_molt:
        roll += 1

    success = roll >= difficulty
    deltas = dict(success_deltas if success else fail_deltas or {})

    if consume_molt:
        deltas["molts"] = deltas.get("molts", 0) - 1
        if "gambler" in player.traits:
            deltas["energy"] = deltas.get("energy", 0) + 1

    return Outcome(
        success=success,
        message=success_text if success else fail_text,
        deltas=deltas,
        roll=roll,
        difficulty=difficulty,
    )


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
                difficulty=7,
                tags=("molt", "sense"),
                success_text="旧壳留在网里当纪念品，你本人则以一种不太得体的方式滑了出去。",
                fail_text="壳是脱了，但还是被网边挂到一截。逃出来时你整只虾都在骂。",
                success_deltas={"score": 2},
                fail_deltas={"shell": -1, "salinity": -1},
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
                success_deltas={"energy": -1, "score": 2},
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
                difficulty=9,
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
                difficulty=8,
                tags=("stealth",),
                success_text="陶罐替你吃下大部分电流。你出来时更懂得感恩垃圾。",
                fail_text="罐子没完全挡住，麻得你差点忘了自己该横着走。",
                success_deltas={"shell": -1, "score": 1},
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
                difficulty=8,
                tags=("cut", "sense"),
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
                base=player.salinity + player.shell // 2,
                difficulty=8,
                tags=("sense",),
                success_text="你憋着鳃硬撑过去，只留下几句不适合幼虾听的心里话。",
                fail_text="塑料丝缠上了触须，水质也开始对你发表负面评价。",
                success_deltas={"energy": -1, "score": 1},
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
                success_deltas={"energy": 1, "score": 2},
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
    body="排水闸另一端是真正的海。只差最后一次横移、最后一次剪断，或最后一层壳。失败就会被冲回锅边。",
    actions=(
        Action(
            key="1",
            title="逆水横冲",
            blurb="用壳顶住水压，像一枚有怨气的炮弹那样横着出去。",
            resolver=lambda player, rng: contest(
                player,
                rng,
                base=player.shell + player.energy // 2,
                difficulty=11,
                tags=("dash",),
                success_text="你顶着逆流冲破闸缝，海盐重新包住身体。没有比这更像活着的味道。",
                fail_text="逆流把你拍回了金属壁上。世界提醒你：锅还没走远。",
                success_deltas={"energy": -1, "score": 4},
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
                difficulty=11,
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
                base=player.sense + player.salinity + 3,
                difficulty=10,
                tags=("molt", "sense"),
                success_text="旧壳卡在闸缝里做了替罪羊，你本人回到了真正咸、真正冷的自由里。",
                fail_text="闸缝太窄，旧壳也没能替你说服这个世界。",
                success_deltas={"score": 5},
                fail_deltas={"shell": -2, "salinity": -2},
                consume_molt=True,
            ),
        ),
    ),
)


def choose_encounter(depth: int, rng: random.Random) -> Encounter:
    if depth <= 3:
        pool = [FEEDING, PLASTIC, EEL, OCTOPUS]
    elif depth <= 6:
        pool = [FEEDING, PLASTIC, EEL, OCTOPUS, NET]
    else:
        pool = [PLASTIC, EEL, OCTOPUS, NET, CHEF]
    return rng.choice(pool)


def format_status(player: Player) -> str:
    return (
        f"壳 {player.shell} | 能 {player.energy} | 盐 {player.salinity} | "
        f"左 {player.left_claw} | 右 {player.right_claw} | 须 {player.sense} | 蜕 {player.molts}"
    )


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
        setattr(player, key, getattr(player, key) + value)


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


def print_title() -> None:
    print("\n=== 横着活：只给龙虾玩的 CLI 肉鸽 ===")
    print(wrap("你是一只刚从拖网、储冰箱和厨房阴影里活下来的龙虾。目标只有一个：横着回海。"))


def print_rules() -> None:
    print("\n--- 玩法 ---")
    print(wrap("每轮从 3 条龙虾谱系里选 1 条，连闯 9 个随机遭遇，再通过最终的归海闸口。"))
    print(wrap("资源包括壳强度、能量、盐度适应，以及有限的蜕壳次数。任一关键资源归零就会死亡。"))
    print(wrap("每逢深度 2、5、8，会出现一次突变潮，提供 3 选 1 的升级。"))
    print(wrap("所有操作都用数字 1/2/3 选择。你是龙虾，不需要复杂热键。"))


def choose_lineage(provider: InputProvider, scripted_index: int | None = None) -> Player:
    if scripted_index is not None:
        if scripted_index not in {1, 2, 3}:
            raise ValueError("lineage 必须是 1~3。")
        lineage = LINEAGES[scripted_index - 1]
        print(f"\n自动选择谱系：{lineage.title}")
        print(wrap(lineage.blurb))
        return build_player(lineage)

    print("\n选择你的龙虾谱系：")
    for index, lineage in enumerate(LINEAGES, start=1):
        print(f"{index}. {lineage.title} —— {lineage.blurb}")
    pick = prompt_choice(provider, "谱系> ", ["1", "2", "3"])
    lineage = LINEAGES[int(pick) - 1]
    return build_player(lineage)


def offer_mutation(player: Player, rng: random.Random, provider: InputProvider) -> None:
    choices = pick_mutations(rng)
    print("\n~~~ 突变潮拍来三种离谱可能 ~~~")
    for index, mutation in enumerate(choices, start=1):
        print(f"{index}. {mutation.title} —— {mutation.blurb}")
    choice = prompt_choice(provider, "突变> ", ["1", "2", "3"])
    mutation = choices[int(choice) - 1]
    result = apply_mutation(player, mutation)
    print(wrap(f"你接受了【{mutation.title}】。{result}"))
    print(f"当前状态：{format_status(player)}")


def resolve_encounter(
    player: Player,
    encounter: Encounter,
    rng: random.Random,
    provider: InputProvider,
    *,
    debug_rolls: bool = False,
) -> Outcome:
    print(f"\n--- 深度 {player.depth}: {encounter.title} ---")
    print(wrap(encounter.body))
    print(f"状态：{format_status(player)}")
    for action in encounter.actions:
        print(f"{action.key}. {action.title} —— {action.blurb}")
    choice = prompt_choice(provider, "行动> ", [action.key for action in encounter.actions])
    action = next(item for item in encounter.actions if item.key == choice)
    outcome = action.resolver(player, rng)
    if debug_rolls and outcome.roll is not None and outcome.difficulty is not None:
        print(f"判定：{outcome.roll} / 需求 {outcome.difficulty}")
    print(wrap(outcome.message))
    apply_deltas(player, outcome.deltas)
    print(f"结果：{describe_deltas(outcome.deltas)}")
    print(f"当前状态：{format_status(player)}")
    return outcome


def play_run(
    seed: int | None,
    provider: InputProvider,
    scripted_lineage: int | None = None,
    *,
    debug_rolls: bool = False,
) -> bool:
    actual_seed = seed if seed is not None else random.SystemRandom().randrange(1, 10**9)
    rng = random.Random(actual_seed)

    print_title()
    print(f"本轮种子：{actual_seed}")
    player = choose_lineage(provider, scripted_lineage)
    print(f"\n你是【{player.lineage_name}】。初始状态：{format_status(player)}")

    for depth in range(1, RUN_DEPTHS + 1):
        player.depth = depth
        encounter = choose_encounter(depth, rng)
        resolve_encounter(player, encounter, rng, provider, debug_rolls=debug_rolls)
        failure = check_failure(player)
        if failure:
            print(wrap(f"\n你死了。{failure}"))
            return False
        if depth in UPGRADE_DEPTHS:
            offer_mutation(player, rng, provider)

    player.depth = RUN_DEPTHS + 1
    outcome = resolve_encounter(player, FINALE, rng, provider, debug_rolls=debug_rolls)
    failure = check_failure(player)
    if failure:
        print(wrap(f"\n你没能回海。{failure}"))
        return False
    if not outcome.success:
        print(wrap("\n最后一步失败了。你被逆流拍回厨房边缘，成为人类菜单和海洋悲剧之间的一次小型误会。"))
        return False

    print(wrap(f"\n你成功回海。龙虾名声 {player.score}，突变 {len(player.upgrades)} 次。"))
    if player.upgrades:
        print("本轮突变：" + "、".join(player.upgrades))
    return True


def menu_loop(args: argparse.Namespace) -> int:
    provider = InputProvider(args.script.split(",") if args.script else None)
    if args.quick_start:
        play_run(args.seed, provider, args.lineage, debug_rolls=args.debug_rolls)
        return 0

    while True:
        print_title()
        print("1. 开始一轮")
        print("2. 查看规则")
        print("3. 退出")
        choice = prompt_choice(provider, "菜单> ", ["1", "2", "3"])
        if choice == "1":
            play_run(args.seed, provider, None, debug_rolls=args.debug_rolls)
        elif choice == "2":
            print_rules()
        else:
            print("愿你的壳总比锅硬。")
            return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="横着活：只给龙虾玩的 CLI 肉鸽")
    parser.add_argument("--seed", type=int, help="固定随机种子，方便复现同一轮。")
    parser.add_argument("--quick-start", action="store_true", help="直接开始一轮，适合脚本化测试。")
    parser.add_argument("--lineage", type=int, choices=[1, 2, 3], help="在 quick-start 中预选谱系。")
    parser.add_argument("--script", help="逗号分隔的脚本化输入，例如 1,2,1,3。")
    parser.add_argument("--debug-rolls", action="store_true", help="显示具体判定值，仅用于开发/平衡调试。")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return menu_loop(args)


if __name__ == "__main__":
    raise SystemExit(main())
