/**
 * Content loading and validation.
 *
 * The case and event JSON is the identity of the game: it is kept verbatim from
 * the old standalone build. This module only adapts it to typed records and
 * refuses to start if a case references a room or an effect that does not
 * exist, so content rot becomes a loud error instead of a midnight crash.
 */

import archiveCorridorCase from '../content/cases/archive-corridor.json';
import backflowInnCase from '../content/cases/backflow-inn.json';
import blindScreenRoomCase from '../content/cases/blind-screen-room.json';
import sealedTideStationCase from '../content/cases/sealed-tide-station.json';
import archiveCorridorEvents from '../content/events/archive-corridor.events.json';
import backflowInnEvents from '../content/events/backflow-inn.events.json';
import blindScreenRoomEvents from '../content/events/blind-screen-room.events.json';
import sealedTideStationEvents from '../content/events/sealed-tide-station.events.json';

export type EventTrigger =
  | 'inspect'
  | 'move'
  | 'interact'
  | 'record'
  | 'brace'
  | 'extract'
  | 'status';

export type InteractableEffect = 'objective' | 'stabilize' | 'reveal';

export interface InspectTarget {
  id: string;
  label: string;
  focusCost?: number;
}

export interface Interactable {
  id: string;
  label: string;
  effect: InteractableEffect;
}

export interface RoomConfig {
  id: string;
  name: string;
  tags: string[];
  panels: string[];
  inspectTargets: InspectTarget[];
  interactables: Interactable[];
  exits: string[];
  isEntry?: boolean;
  isExit?: boolean;
  objective?: boolean;
}

export interface CaseConfig {
  id: string;
  name: string;
  chineseName: string;
  summary: string;
  requiredEvidence: number;
  startingRoom: string;
  rooms: RoomConfig[];
  defaultAscii: string[];
}

export interface EventConfig {
  id: string;
  caseId: string;
  title: string;
  trigger: EventTrigger;
  roomTags: string[];
  severity: number;
  flavor: string;
  witness: string;
  focusDelta: number;
  nerveDelta: number;
  dreadDelta: number;
  evidenceDelta: number;
  clueId: string;
  clueText: string;
  ascii: string[];
  tags: string[];
}

const TRIGGERS: readonly EventTrigger[] = [
  'inspect',
  'move',
  'interact',
  'record',
  'brace',
  'extract',
  'status',
];

const EFFECTS: readonly InteractableEffect[] = ['objective', 'stabilize', 'reveal'];

function invalid(path: string, message: string): never {
  throw new Error(`sideways-look content invalid at ${path}: ${message}`);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(path, 'expected an object');
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) invalid(path, 'expected an array');
  return value;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    invalid(path, 'expected a non-empty string');
  }
  return value;
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    invalid(path, 'expected a finite number');
  }
  return value;
}

function asInteger(value: unknown, path: string): number {
  const number = asNumber(value, path);
  if (!Number.isInteger(number)) invalid(path, 'expected an integer');
  return number;
}

function asBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalid(path, 'expected a boolean');
  return value;
}

function asStringArray(value: unknown, path: string): string[] {
  return asArray(value, path).map((item, index) => asString(item, `${path}[${index}]`));
}

function asOptionalBoolean(value: unknown, path: string): boolean | undefined {
  return value === undefined ? undefined : asBoolean(value, path);
}

function parseInspectTarget(raw: unknown, path: string): InspectTarget {
  const record = asRecord(raw, path);
  const target: InspectTarget = {
    id: asString(record.id, `${path}.id`),
    label: asString(record.label, `${path}.label`),
  };
  if (record.focusCost !== undefined) {
    target.focusCost = asInteger(record.focusCost, `${path}.focusCost`);
  }
  return target;
}

function parseInteractable(raw: unknown, path: string): Interactable {
  const record = asRecord(raw, path);
  const effect = asString(record.effect, `${path}.effect`) as InteractableEffect;
  if (!EFFECTS.includes(effect)) {
    invalid(`${path}.effect`, `expected one of ${EFFECTS.join(', ')}`);
  }
  return {
    id: asString(record.id, `${path}.id`),
    label: asString(record.label, `${path}.label`),
    effect,
  };
}

function parseRoom(raw: unknown, path: string): RoomConfig {
  const record = asRecord(raw, path);
  const inspectTargets = asArray(record.inspectTargets, `${path}.inspectTargets`).map(
    (item, index) => parseInspectTarget(item, `${path}.inspectTargets[${index}]`),
  );
  const interactables = asArray(record.interactables, `${path}.interactables`).map((item, index) =>
    parseInteractable(item, `${path}.interactables[${index}]`),
  );
  const room: RoomConfig = {
    id: asString(record.id, `${path}.id`),
    name: asString(record.name, `${path}.name`),
    tags: asStringArray(record.tags, `${path}.tags`),
    panels: asStringArray(record.panels, `${path}.panels`),
    inspectTargets,
    interactables,
    exits: asStringArray(record.exits, `${path}.exits`),
  };
  const isEntry = asOptionalBoolean(record.isEntry, `${path}.isEntry`);
  const isExit = asOptionalBoolean(record.isExit, `${path}.isExit`);
  const objective = asOptionalBoolean(record.objective, `${path}.objective`);
  if (isEntry !== undefined) room.isEntry = isEntry;
  if (isExit !== undefined) room.isExit = isExit;
  if (objective !== undefined) room.objective = objective;
  return room;
}

function parseCase(raw: unknown, index: number): CaseConfig {
  const path = `cases[${index}]`;
  const record = asRecord(raw, path);
  const rooms = asArray(record.rooms, `${path}.rooms`).map((item, roomIndex) =>
    parseRoom(item, `${path}.rooms[${roomIndex}]`),
  );
  if (rooms.length === 0) invalid(`${path}.rooms`, 'must contain at least one room');

  const caseConfig: CaseConfig = {
    id: asString(record.id, `${path}.id`),
    name: asString(record.name, `${path}.name`),
    chineseName: asString(record.chineseName, `${path}.chineseName`),
    summary: asString(record.summary, `${path}.summary`),
    requiredEvidence: asInteger(record.requiredEvidence, `${path}.requiredEvidence`),
    startingRoom: asString(record.startingRoom, `${path}.startingRoom`),
    rooms,
    defaultAscii: asStringArray(record.defaultAscii, `${path}.defaultAscii`),
  };
  if (caseConfig.requiredEvidence < 1) {
    invalid(`${path}.requiredEvidence`, 'must be at least 1');
  }

  const roomIds = new Set<string>();
  for (const [roomIndex, room] of rooms.entries()) {
    if (roomIds.has(room.id))
      invalid(`${path}.rooms[${roomIndex}].id`, `duplicate room id ${room.id}`);
    roomIds.add(room.id);
    const targetIds = new Set<string>();
    for (const [targetIndex, target] of room.inspectTargets.entries()) {
      if (targetIds.has(target.id)) {
        invalid(
          `${path}.rooms[${roomIndex}].inspectTargets[${targetIndex}].id`,
          `duplicate inspect target id ${target.id}`,
        );
      }
      targetIds.add(target.id);
    }
    const interactableIds = new Set<string>();
    for (const [itemIndex, item] of room.interactables.entries()) {
      if (interactableIds.has(item.id)) {
        invalid(
          `${path}.rooms[${roomIndex}].interactables[${itemIndex}].id`,
          `duplicate interactable id ${item.id}`,
        );
      }
      interactableIds.add(item.id);
    }
  }

  if (!roomIds.has(caseConfig.startingRoom)) {
    invalid(`${path}.startingRoom`, `unknown room ${caseConfig.startingRoom}`);
  }
  for (const [roomIndex, room] of rooms.entries()) {
    for (const [exitIndex, exit] of room.exits.entries()) {
      if (!roomIds.has(exit)) {
        invalid(`${path}.rooms[${roomIndex}].exits[${exitIndex}]`, `unknown room ${exit}`);
      }
    }
  }
  if (!rooms.some((room) => room.isExit === true)) {
    invalid(`${path}.rooms`, 'no room is marked as an exit');
  }
  if (!rooms.some((room) => room.interactables.some((item) => item.effect === 'objective'))) {
    invalid(`${path}.rooms`, 'no objective interactable exists');
  }
  return caseConfig;
}

function parseEvent(raw: unknown, index: number, caseIds: ReadonlySet<string>): EventConfig {
  const path = `events[${index}]`;
  const record = asRecord(raw, path);
  const trigger = asString(record.trigger, `${path}.trigger`) as EventTrigger;
  if (!TRIGGERS.includes(trigger)) {
    invalid(`${path}.trigger`, `expected one of ${TRIGGERS.join(', ')}`);
  }
  const caseId = asString(record.caseId, `${path}.caseId`);
  if (!caseIds.has(caseId)) invalid(`${path}.caseId`, `unknown case ${caseId}`);

  return {
    id: asString(record.id, `${path}.id`),
    caseId,
    title: asString(record.title, `${path}.title`),
    trigger,
    roomTags: asStringArray(record.roomTags, `${path}.roomTags`),
    severity: asInteger(record.severity, `${path}.severity`),
    flavor: asString(record.flavor, `${path}.flavor`),
    witness: asString(record.witness, `${path}.witness`),
    focusDelta: asInteger(record.focusDelta, `${path}.focusDelta`),
    nerveDelta: asInteger(record.nerveDelta, `${path}.nerveDelta`),
    dreadDelta: asInteger(record.dreadDelta, `${path}.dreadDelta`),
    evidenceDelta: asInteger(record.evidenceDelta, `${path}.evidenceDelta`),
    clueId: asString(record.clueId, `${path}.clueId`),
    clueText: asString(record.clueText, `${path}.clueText`),
    ascii: asStringArray(record.ascii, `${path}.ascii`),
    tags: asStringArray(record.tags, `${path}.tags`),
  };
}

function parseContent(
  rawCases: readonly unknown[],
  rawEvents: readonly unknown[],
): { cases: CaseConfig[]; events: EventConfig[] } {
  const cases = rawCases.map((raw, index) => parseCase(raw, index));
  if (cases.length === 0) invalid('cases', 'at least one case is required');
  const caseIds = new Set<string>();
  for (const [index, caseConfig] of cases.entries()) {
    if (caseIds.has(caseConfig.id))
      invalid(`cases[${index}].id`, `duplicate case id ${caseConfig.id}`);
    caseIds.add(caseConfig.id);
  }

  const events = rawEvents.map((raw, index) => parseEvent(raw, index, caseIds));
  const eventIds = new Set<string>();
  for (const [index, event] of events.entries()) {
    if (eventIds.has(event.id)) invalid(`events[${index}].id`, `duplicate event id ${event.id}`);
    eventIds.add(event.id);
  }

  for (const caseConfig of cases) {
    for (const trigger of ['inspect', 'move', 'interact'] as const) {
      if (!events.some((event) => event.caseId === caseConfig.id && event.trigger === trigger)) {
        invalid(`cases.${caseConfig.id}`, `no ${trigger} event exists`);
      }
    }
  }
  return { cases, events };
}

const CONTENT = parseContent(
  [archiveCorridorCase, backflowInnCase, blindScreenRoomCase, sealedTideStationCase],
  [
    ...archiveCorridorEvents,
    ...backflowInnEvents,
    ...blindScreenRoomEvents,
    ...sealedTideStationEvents,
  ],
);

export const CASES: readonly CaseConfig[] = CONTENT.cases;
export const EVENTS: readonly EventConfig[] = CONTENT.events;

const CASE_BY_ID = new Map(CASES.map((item) => [item.id, item]));
const EVENTS_BY_CASE = new Map<string, EventConfig[]>(CASES.map((item) => [item.id, []]));
for (const event of EVENTS) EVENTS_BY_CASE.get(event.caseId)?.push(event);

export function caseById(caseId: string | null | undefined): CaseConfig | undefined {
  return caseId ? CASE_BY_ID.get(caseId) : undefined;
}

export function eventsFor(caseId: string): readonly EventConfig[] {
  return EVENTS_BY_CASE.get(caseId) ?? [];
}

export function roomById(caseConfig: CaseConfig, roomId: string): RoomConfig {
  const room = caseConfig.rooms.find((item) => item.id === roomId);
  if (!room) throw new Error(`Unknown room ${roomId} in case ${caseConfig.id}`);
  return room;
}
