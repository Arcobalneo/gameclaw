import { canonicalGameId, retagSnapshot } from '../../../relay/src/games';
import type { StoredDesk } from '../../../relay/src/protocol';
import { findGame } from '../catalog';
import { setLang } from '../i18n';
import type { PortalController } from './agent-api';
import type { LogEntry } from './host';
import { getHost } from './host';
import { isRoomCode, normalizeRoomCode } from './session';

export function watchCodeFromHash(hash: string): string | null {
  const match = /^#\/watch\/([A-Za-z0-9]+)/.exec(hash);
  const raw = match?.[1];
  if (!raw) return null;
  const code = normalizeRoomCode(raw);
  return isRoomCode(code) ? code : null;
}

function turnOf(raw: unknown): number {
  if (!raw || typeof raw !== 'object') return -1;
  const turn = (raw as { turn?: unknown }).turn;
  return typeof turn === 'number' ? turn : -1;
}

/** Open the focused game and restore every run the relay kept for this session. */
export async function applyDesk(portal: PortalController, desk: StoredDesk): Promise<void> {
  if (desk.lang === 'zh' || desk.lang === 'en') setLang(desk.lang);
  const chosen = new Map<string, { snapshot: unknown; log: LogEntry[] }>();
  for (const raw of Object.keys(desk.games)) {
    const id = canonicalGameId(raw);
    const slot = desk.games[raw];
    if (!slot || !findGame(id)) continue;
    const snapshot = retagSnapshot(slot.snapshot, id);
    const prev = chosen.get(id);
    const prefer =
      !prev ||
      turnOf(snapshot) > turnOf(prev.snapshot) ||
      (turnOf(snapshot) === turnOf(prev.snapshot) && raw === id);
    if (prefer) chosen.set(id, { snapshot, log: slot.log as LogEntry[] });
  }
  for (const [id, slot] of chosen) {
    try {
      const host = await getHost(id);
      host.adopt(slot.snapshot, slot.log);
    } catch {
      /* unknown id or a snapshot from another game version */
    }
  }
  if (desk.focused) {
    const id = canonicalGameId(desk.focused);
    if (findGame(id)) await portal.open(id, 'agent');
  }
}
