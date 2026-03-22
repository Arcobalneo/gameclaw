import type { CaseConfig, EventConfig } from './model.js';
import archiveCorridorCase from '../content/cases/archive-corridor.json' with { type: 'json' };
import backflowInnCase from '../content/cases/backflow-inn.json' with { type: 'json' };
import blindScreenRoomCase from '../content/cases/blind-screen-room.json' with { type: 'json' };
import sealedTideStationCase from '../content/cases/sealed-tide-station.json' with { type: 'json' };
import archiveCorridorEvents from '../content/events/archive-corridor.events.json' with { type: 'json' };
import backflowInnEvents from '../content/events/backflow-inn.events.json' with { type: 'json' };
import blindScreenRoomEvents from '../content/events/blind-screen-room.events.json' with { type: 'json' };
import sealedTideStationEvents from '../content/events/sealed-tide-station.events.json' with { type: 'json' };

export const CASES: CaseConfig[] = [
  archiveCorridorCase as CaseConfig,
  backflowInnCase as CaseConfig,
  blindScreenRoomCase as CaseConfig,
  sealedTideStationCase as CaseConfig
];

const ALL_EVENTS: EventConfig[] = [
  ...(archiveCorridorEvents as EventConfig[]),
  ...(backflowInnEvents as EventConfig[]),
  ...(blindScreenRoomEvents as EventConfig[]),
  ...(sealedTideStationEvents as EventConfig[])
];

export const CASE_MAP = new Map(CASES.map((item) => [item.id, item]));
export const EVENT_MAP = new Map<string, EventConfig[]>(
  CASES.map((item) => [item.id, ALL_EVENTS.filter((event) => event.caseId === item.id)])
);

export function getCaseConfig(caseId: string): CaseConfig {
  const found = CASE_MAP.get(caseId);
  if (!found) {
    throw new Error(`Unknown case: ${caseId}`);
  }
  return found;
}

export function getCaseEvents(caseId: string): EventConfig[] {
  return EVENT_MAP.get(caseId) ?? [];
}
