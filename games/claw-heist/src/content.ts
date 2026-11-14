import { GameError } from '@gameclaw/gamekit';

/** Grid coordinate: `[row, column]`, zero-based. Row 0 is 上, row 1 is 下. */
export type Pos = [number, number];

export type Terrain = 'open' | 'cover' | 'shadow';
export type Facing = 'left' | 'right';
export type ProfileKey = 'shade' | 'breaker' | 'runner';

export interface RandomSource {
  pick<T>(items: readonly T[]): T;
  int(min: number, max: number): number;
}

export interface Profile {
  key: ProfileKey;
  title: string;
  subtitle: string;
  blurb: string;
  gearName: string;
  gearSummary: string;
  gearCharges: number;
  extractionBonus: number;
  passiveSummary: string;
}

export interface FacilityFrame {
  key: string;
  title: string;
  subtitle: string;
  brief: string;
  terrain: [Terrain[], Terrain[]];
  entry: Pos;
  exit: Pos;
  console: Pos;
  cache: Pos;
  candidates: Pos[];
  /** Two same-row vent endpoints. A single vent slide replaces the whole run. */
  vents: [Pos, Pos];
  climbColumns: number[];
  steamCell: Pos;
  responderEntry: Pos;
}

export interface PatrollerSpec {
  title: string;
  path: Pos[];
}

export interface WatcherSpec {
  title: string;
  position: Pos;
  facing: Facing;
  range: number;
}

export interface CameraSpec {
  title: string;
  position: Pos;
  patterns: Pos[][];
}

export interface SecurityPackage {
  key: string;
  title: string;
  brief: string;
  patroller: PatrollerSpec;
  watcher: WatcherSpec | null;
  camera: CameraSpec | null;
  sensors: Pos[];
  responderDelay: number;
}

export type SelectionRule = 'upper_inner' | 'farthest_exit' | 'lower_deep';
export type CacheReward = 'intel' | 'cold_sleeve' | 'exit_pass';

export interface ObjectivePackage {
  key: string;
  title: string;
  brief: string;
  clue: string;
  selectionRule: SelectionRule;
  extractionWindow: number;
  carryNoise: number;
  falseAlert: number;
  consoleReveals: boolean;
  cacheReward: CacheReward;
  score: number;
}

export type ComplicationMode = 'steam' | 'jammed_exit' | 'extra_watcher' | 'carry_noise';

export interface ComplicationPackage {
  key: string;
  title: string;
  brief: string;
  mode: ComplicationMode;
  carryNoiseBonus: number;
}

export interface Mission {
  facility: FacilityFrame;
  security: SecurityPackage;
  objective: ObjectivePackage;
  complication: ComplicationPackage;
  trueSite: Pos;
}

export const PROFILES: Profile[] = [
  {
    key: 'shade',
    title: '藻披影行者',
    subtitle: '贴着 shadow 读时机',
    blurb: '把曝光压在低线，用墨幕把一个本来会崩的转角拖成能过的节奏。',
    gearName: '墨幕壳',
    gearSummary: '在当前格炸出一团短时墨幕：本格隐蔽度拉满，并立刻压低 2 点曝光。',
    gearCharges: 2,
    extractionBonus: 0,
    passiveSummary: '暗格 / 蒸汽里的等待更有效；观察能多拿一拍预判。',
  },
  {
    key: 'breaker',
    title: '断钳拆闸手',
    subtitle: '专拆 console、闸门和安保件',
    blurb: '让门、sensor 和扫镜头临时闭嘴，适合对抗麻烦的 security package。',
    gearName: '干扰钉',
    gearSummary:
      '按优先级钉死最要命的一件安保件：镜头 > sensor > 巡逻蟹；快门卡涩对断钳手本就不挡路。',
    gearCharges: 2,
    extractionBonus: 1,
    passiveSummary: '操作终端不额外制造噪音，卡涩快门也不会挡住你。',
  },
  {
    key: 'runner',
    title: '脱壳快撤者',
    subtitle: '把取物后的残局硬撤出去',
    blurb: '平时风险不一定最低，但真到了 carry state，它能把一次失衡的线扯回到还能撤离。',
    gearName: '空壳冲刺',
    gearSummary: '朝当前目标自动冲刺 2 格：绕开守卫、压低噪音，并在这一拍少吸一点曝光。',
    gearCharges: 2,
    extractionBonus: 1,
    passiveSummary: '撤离窗多一拍；取物后的第一次位移脚步更轻。',
  },
];

export const FACILITIES: FacilityFrame[] = [
  {
    key: 'cold-rack',
    title: '低温挂架 A-12',
    subtitle: '冷库侧剖挂架线',
    brief: '上层是开阔挂架，下层是排水沟和短 vent。你能潜得很安静，但带着货就别想再钻回去。',
    terrain: [
      ['cover', 'cover', 'open', 'cover', 'cover', 'cover', 'cover'],
      ['cover', 'shadow', 'shadow', 'cover', 'cover', 'shadow', 'cover'],
    ],
    entry: [1, 0],
    exit: [0, 0],
    console: [1, 4],
    cache: [0, 4],
    candidates: [
      [0, 5],
      [0, 6],
      [1, 6],
    ],
    vents: [
      [1, 2],
      [1, 5],
    ],
    climbColumns: [1, 4, 6],
    steamCell: [1, 3],
    responderEntry: [0, 3],
  },
  {
    key: 'galley-backline',
    title: '后厨背线 3 号灶后',
    subtitle: '蒸汽、帘布和备货格挤在一起',
    brief: '这条后厨背线比冷库吵。你会更常看见 cover，也更容易因为一次贪 cache 被人盯上。',
    terrain: [
      ['cover', 'open', 'cover', 'cover', 'cover', 'cover', 'cover'],
      ['cover', 'shadow', 'cover', 'shadow', 'open', 'cover', 'cover'],
    ],
    entry: [1, 0],
    exit: [0, 0],
    console: [0, 4],
    cache: [1, 5],
    candidates: [
      [0, 5],
      [0, 6],
      [1, 6],
    ],
    vents: [
      [1, 2],
      [1, 5],
    ],
    climbColumns: [1, 3, 5],
    steamCell: [1, 4],
    responderEntry: [0, 3],
  },
  {
    key: 'dock-drain',
    title: '码头仓道 D-4',
    subtitle: '上层仓道 + 下层排水回路',
    brief: '上层仓道直、快、但暴露；下层排水回路安全，却只适合进，不适合带物后回头。',
    terrain: [
      ['cover', 'cover', 'open', 'cover', 'cover', 'cover', 'cover'],
      ['cover', 'shadow', 'shadow', 'open', 'cover', 'cover', 'shadow'],
    ],
    entry: [1, 0],
    exit: [0, 0],
    console: [1, 4],
    cache: [0, 4],
    candidates: [
      [0, 5],
      [0, 6],
      [1, 6],
    ],
    vents: [
      [1, 2],
      [1, 6],
    ],
    climbColumns: [2, 4, 6],
    steamCell: [1, 3],
    responderEntry: [0, 3],
  },
];

export const SECURITY_PACKAGES: SecurityPackage[] = [
  {
    key: 'line-watch',
    title: '直线盯守组',
    brief: '一名守线员盯着上层回撤线，底层还有一只来回巡的搬运蟹。',
    patroller: {
      title: '搬运蟹巡逻',
      path: [
        [1, 2],
        [1, 3],
        [1, 4],
        [1, 5],
        [1, 6],
      ],
    },
    watcher: { title: '冷架盯守员', position: [0, 6], facing: 'left', range: 4 },
    camera: null,
    sensors: [[1, 6]],
    responderDelay: 3,
  },
  {
    key: 'servo-cam',
    title: '摆扫镜头组',
    brief: '主压力来自 ceiling camera 和终端附近的 sensor。路线没读对会被镜头节奏卡死。',
    patroller: {
      title: '地沟巡逻蟹',
      path: [
        [1, 2],
        [1, 3],
        [1, 4],
        [1, 5],
      ],
    },
    watcher: null,
    camera: {
      title: '摆扫镜头',
      position: [0, 3],
      patterns: [
        [
          [0, 2],
          [0, 3],
          [0, 4],
        ],
        [
          [0, 3],
          [0, 4],
          [0, 5],
        ],
        [
          [0, 4],
          [0, 5],
          [0, 6],
        ],
        [
          [0, 3],
          [0, 4],
          [0, 5],
        ],
      ],
    },
    sensors: [
      [1, 4],
      [1, 6],
    ],
    responderDelay: 2,
  },
  {
    key: 'seal-crew',
    title: '封锁响应组',
    brief: '上层也有巡逻，取物后 responder 到得很快；你不是潜进去就赢了，是得真撤出去。',
    patroller: {
      title: '仓道巡逻蟹',
      path: [
        [0, 2],
        [0, 3],
        [0, 4],
        [0, 5],
      ],
    },
    watcher: { title: '封锁看闸员', position: [1, 5], facing: 'left', range: 3 },
    camera: {
      title: '门楣镜头',
      position: [0, 2],
      patterns: [
        [
          [0, 1],
          [0, 2],
          [0, 3],
        ],
        [
          [0, 2],
          [0, 3],
          [0, 4],
        ],
        [
          [0, 3],
          [0, 4],
          [0, 5],
        ],
      ],
    },
    sensors: [[1, 5]],
    responderDelay: 2,
  },
];

export const OBJECTIVE_PACKAGES: ObjectivePackage[] = [
  {
    key: 'salt-ledger',
    title: '盐账账本',
    brief: '一本记着塑料环去向的账本，不算重，但拿到手后设施还是会立刻紧起来。',
    clue: '简报线索：目标在高位货格里，而且不是最外侧那格。',
    selectionRule: 'upper_inner',
    extractionWindow: 8,
    carryNoise: 1,
    falseAlert: 1,
    consoleReveals: false,
    cacheReward: 'intel',
    score: 7,
  },
  {
    key: 'live-sample',
    title: '活体样本罐',
    brief: '拿到样本之后脚步会更沉，终端能明确告诉你哪格是真的，不看也能赌，但赌错会很伤。',
    clue: '简报线索：终端能锁定最低温那格；不看终端也能赌，但会很吵。',
    selectionRule: 'farthest_exit',
    extractionWindow: 8,
    carryNoise: 2,
    falseAlert: 2,
    consoleReveals: true,
    cacheReward: 'cold_sleeve',
    score: 9,
  },
  {
    key: 'brass-key',
    title: '黄铜钥环',
    brief: '不是最重的货，但它触发的封锁最快。路线要先想好，不然拿到也未必带得走。',
    clue: '简报线索：目标压在最深、而且偏低的那格。',
    selectionRule: 'lower_deep',
    extractionWindow: 7,
    carryNoise: 1,
    falseAlert: 1,
    consoleReveals: false,
    cacheReward: 'exit_pass',
    score: 8,
  },
];

export const COMPLICATION_PACKAGES: ComplicationPackage[] = [
  {
    key: 'steam-backflow',
    title: '蒸汽倒灌',
    brief: '固定一格会每三拍冒一次蒸汽。它能帮你遮视线，也会让这一格更容易发出动静。',
    mode: 'steam',
    carryNoiseBonus: 0,
  },
  {
    key: 'jammed-shutter',
    title: '快门闸卡涩',
    brief: '拿到目标后，出口快门不会老老实实自己开。终端或硬拆路线都得提前想。',
    mode: 'jammed_exit',
    carryNoiseBonus: 0,
  },
  {
    key: 'overtime-sorter',
    title: '临时加班看线',
    brief: '设施里多了一双盯线的眼睛，尤其容易惩罚去摸 side cache 的贪心路线。',
    mode: 'extra_watcher',
    carryNoiseBonus: 0,
  },
  {
    key: 'slick-floor',
    title: '湿滑地面',
    brief: '带物后脚步更容易发响。你仍然能赢，但会更依赖 profile 和预留 gear。',
    mode: 'carry_noise',
    carryNoiseBonus: 1,
  },
];

function lookup<T extends { key: string }>(items: readonly T[], key: string, label: string): T {
  const found = items.find((item) => item.key === key);
  if (!found) throw new Error(`Unknown ${label}: ${key}`);
  return found;
}

export function profileByKey(key: string): Profile {
  return lookup(PROFILES, key, 'profile');
}

export function facilityByKey(key: string): FacilityFrame {
  return lookup(FACILITIES, key, 'facility');
}

export function securityByKey(key: string): SecurityPackage {
  return lookup(SECURITY_PACKAGES, key, 'security package');
}

export function objectiveByKey(key: string): ObjectivePackage {
  return lookup(OBJECTIVE_PACKAGES, key, 'objective package');
}

export function complicationByKey(key: string): ComplicationPackage {
  return lookup(COMPLICATION_PACKAGES, key, 'complication package');
}

export function samePos(a: Pos, b: Pos): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

/** Apply one objective package's selection rule to the facility's candidate sites. */
export function selectObjectiveSite(
  rule: SelectionRule,
  candidates: readonly Pos[],
  exit: Pos,
): Pos {
  if (candidates.length === 0) throw new Error('Facility has no candidate sites');
  const ordered = [...candidates];
  if (rule === 'upper_inner') {
    const upper = ordered.filter((pos) => pos[0] === 0).sort((a, b) => a[1] - b[1]);
    if (upper[0]) return upper[0];
    return ordered.sort((a, b) => a[1] - b[1] || a[0] - b[0])[0]!;
  }
  if (rule === 'farthest_exit') {
    return ordered.sort(
      (a, b) => manhattan(b, exit) - manhattan(a, exit) || b[1] - a[1] || b[0] - a[0],
    )[0]!;
  }
  return ordered.sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]!;
}

/**
 * Build the deterministic mission for a seed.
 *
 * `content` may pin a facility key (`cold-rack`, `galley-backline`, `dock-drain`)
 * so agents can practise one skeleton; everything else still comes from the seed.
 */
export function pickMission(rng: RandomSource, content?: string): Mission {
  let facility: FacilityFrame;
  if (!content || content === 'random') {
    facility = rng.pick(FACILITIES);
  } else {
    const pinned = FACILITIES.find((item) => item.key === content);
    if (!pinned) {
      throw new GameError(
        'USAGE',
        `Unknown --content preset: ${content}`,
        `Use one of: ${FACILITIES.map((item) => item.key).join(', ')}, random`,
      );
    }
    facility = pinned;
  }
  const security = rng.pick(SECURITY_PACKAGES);
  const objective = rng.pick(OBJECTIVE_PACKAGES);
  const complication = rng.pick(COMPLICATION_PACKAGES);
  const trueSite = selectObjectiveSite(objective.selectionRule, facility.candidates, facility.exit);
  return { facility, security, objective, complication, trueSite };
}
