import type { StoredDesk } from '../../../relay/src/protocol';
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

/** Open the focused game and restore every run the relay kept for this session. */
export async function applyDesk(portal: PortalController, desk: StoredDesk): Promise<void> {
  if (desk.lang === 'zh' || desk.lang === 'en') setLang(desk.lang);
  const ids = Object.keys(desk.games).sort();
  for (const id of ids) {
    const slot = desk.games[id];
    if (!slot) continue;
    try {
      const host = await getHost(id);
      host.adopt(slot.snapshot, slot.log as LogEntry[]);
    } catch {
      /* unknown id or a snapshot from another game version */
    }
  }
  if (desk.focused) await portal.open(desk.focused, 'agent');
}
