// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRequest, RELAY_VERSION } from '../../relay/src/app';
import { generateSessionId } from '../../relay/src/ids';
import type { StoredDesk } from '../../relay/src/protocol';
import { MemoryStore } from '../../relay/src/registry';
import { SessionRoomCore, type SocketLike } from '../../relay/src/room';
import { createApi, type GameclawApi, toolDescriptors } from '../src/runtime/agent-api';
import { applyDesk, watchCodeFromHash } from '../src/runtime/follow';
import { Portal } from '../src/ui/portal';

vi.mock('../src/ui/game-view', () => {
  class GameView {
    root: HTMLElement;
    host: { status(): { turn: number; headline: string }; subscribe(fn: () => void): void };
    onRequestNew: (() => void) | null = null;
    constructor(
      entry: { id: string },
      host: { status(): { turn: number; headline: string }; subscribe(fn: () => void): void },
    ) {
      this.host = host;
      this.root = document.createElement('div');
      this.root.className = 'gv';
      this.root.dataset.id = entry.id;
      const status = document.createElement('p');
      status.className = 'gv-status';
      const paint = () => {
        const view = host.status();
        status.textContent = `${view.turn}:${view.headline}`;
      };
      paint();
      host.subscribe(paint);
      this.root.append(status);
    }
    activate(): void {
      this.root.dataset.active = 'true';
    }
    deactivate(): void {
      delete this.root.dataset.active;
    }
    destroy(): void {
      this.root.remove();
    }
    toggleHelp(): void {}
    closeHelp(): boolean {
      return false;
    }
    handleKey(): boolean {
      return false;
    }
  }
  return { GameView };
});

interface ToolResult {
  ok: boolean;
  game_id?: string;
  error?: string;
  state?: { turn: number; headline: string };
  actions?: { id: string }[];
}

function at(hash: string): void {
  history.replaceState(null, '', `${location.pathname}${hash}`);
}

function backdrop(mount: ParentNode): HTMLElement {
  const el = mount.querySelector('.pw-backdrop');
  if (!(el instanceof HTMLElement)) throw new Error('missing window');
  return el;
}

function shown(mount: ParentNode): HTMLElement | null {
  const el = mount.querySelector('.gv:not([hidden])');
  return el instanceof HTMLElement ? el : null;
}

function statusText(view: HTMLElement | null | undefined): string {
  return view?.querySelector('.gv-status')?.textContent ?? '';
}

function playable(actions: { id: string }[] | undefined): string {
  const id = actions?.find((action) => action.id !== 'abort')?.id;
  if (!id) throw new Error('no legal action');
  return id;
}

async function call(
  api: GameclawApi,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  const found = toolDescriptors(api).find((item) => item.name === name);
  if (!found) throw new Error(`missing tool ${name}`);
  return (await found.execute(args)) as ToolResult;
}

function mountPortal(): { mount: HTMLElement; portal: Portal; api: GameclawApi } {
  const mount = document.createElement('div');
  document.body.append(mount);
  const portal = new Portal(mount);
  return { mount, portal, api: createApi(portal, '4.0.0') };
}

describe('spectator follow', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 404 })),
    );
    at('');
    document.body.classList.remove('has-window');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the game from the homepage, stays on it, then follows a switch', async () => {
    const { mount, portal, api } = mountPortal();
    try {
      at('');
      expect(location.hash).toBe('');
      expect(backdrop(mount).hidden).toBe(true);

      const started = await call(api, 'new_game', { game_id: 'claw-leap', seed: 7 });
      expect(started.ok).toBe(true);
      expect(started.game_id).toBe('claw-leap');
      expect(location.hash).toBe('#/play/claw-leap');
      expect(backdrop(mount).hidden).toBe(false);
      expect(document.body.classList.contains('has-window')).toBe(true);
      const leap = shown(mount);
      expect(leap?.dataset.id).toBe('claw-leap');
      expect(leap?.dataset.active).toBe('true');
      expect(statusText(leap)).toMatch(new RegExp(`^${started.state?.turn}:`));

      const actionId = playable(started.actions);
      const before = statusText(leap);
      const moved = await call(api, 'act', { action_id: actionId });
      expect(moved.ok).toBe(true);
      expect(shown(mount)).toBe(leap);
      expect(location.hash).toBe('#/play/claw-leap');
      expect(statusText(leap)).toMatch(new RegExp(`^${moved.state?.turn}:`));
      expect(statusText(leap)).not.toBe(before);
      expect(moved.state?.turn).toBeGreaterThan(started.state?.turn ?? 0);

      const switched = await call(api, 'open_game', { game_id: 'claw-trek' });
      expect(switched.ok).toBe(true);
      expect(location.hash).toBe('#/play/claw-trek');
      const trek = shown(mount);
      expect(trek?.dataset.id).toBe('claw-trek');
      expect(trek).not.toBe(leap);
      expect(leap?.hidden).toBe(true);
      expect(statusText(trek)).toMatch(new RegExp(`^${switched.state?.turn}:`));

      const trekRun = await call(api, 'new_game', { game_id: 'claw-trek', seed: 5 });
      expect(trekRun.ok).toBe(true);
      expect(shown(mount)).toBe(trek);
      const trekBefore = statusText(trek);
      const trekMove = await call(api, 'act', {
        game_id: 'claw-trek',
        action_id: playable(trekRun.actions),
      });
      expect(trekMove.ok).toBe(true);
      expect(location.hash).toBe('#/play/claw-trek');
      expect(trek?.hidden).toBe(false);
      expect(statusText(trek)).toMatch(new RegExp(`^${trekMove.state?.turn}:`));
      expect(statusText(trek)).not.toBe(trekBefore);
    } finally {
      portal.closeAll();
      mount.remove();
    }
  });

  it('follows from a non-matching route and from a stale play hash', async () => {
    const { mount, portal, api } = mountPortal();
    try {
      at('#/room/WATCH01');
      const opened = await call(api, 'open_game', { game_id: 'claw-ink' });
      expect(opened.ok).toBe(true);
      expect(location.hash).toBe('#/play/claw-ink');
      expect(backdrop(mount).hidden).toBe(false);
      expect(shown(mount)?.dataset.id).toBe('claw-ink');

      portal.closeAll();
      expect(backdrop(mount).hidden).toBe(true);
      at('#/play/claw-burger');
      const next = await call(api, 'new_game', { game_id: 'claw-guard', seed: 3 });
      expect(next.ok).toBe(true);
      expect(location.hash).toBe('#/play/claw-guard');
      expect(shown(mount)?.dataset.id).toBe('claw-guard');
      expect(backdrop(mount).hidden).toBe(false);
    } finally {
      portal.closeAll();
      mount.remove();
    }
  });

  it('brings the window back when the human has returned home and the agent acts', async () => {
    const { mount, portal, api } = mountPortal();
    try {
      const started = await call(api, 'new_game', { game_id: 'claw-heist', seed: 11 });
      expect(started.ok).toBe(true);
      const actionId = playable(started.actions);
      portal.closeAll();
      expect(location.hash).toBe('#/');
      expect(backdrop(mount).hidden).toBe(true);
      expect(shown(mount)).toBeNull();

      const moved = await call(api, 'act', { game_id: 'claw-heist', action_id: actionId });
      expect(moved.ok).toBe(true);
      expect(location.hash).toBe('#/play/claw-heist');
      expect(backdrop(mount).hidden).toBe(false);
      expect(shown(mount)?.dataset.id).toBe('claw-heist');
      expect(statusText(shown(mount))).toMatch(new RegExp(`^${moved.state?.turn}:`));
    } finally {
      portal.closeAll();
      mount.remove();
    }
  });

  it('re-shows an already focused game when the route has drifted back to the homepage', async () => {
    const { mount, portal, api } = mountPortal();
    try {
      const started = await call(api, 'new_game', { game_id: 'claw-leap', seed: 9 });
      const root = shown(mount);
      expect(root?.dataset.id).toBe('claw-leap');
      const actionId = playable(started.actions);
      backdrop(mount).hidden = true;
      document.body.classList.remove('has-window');
      at('');
      expect(location.hash).toBe('');

      const moved = await call(api, 'act', { game_id: 'claw-leap', action_id: actionId });
      expect(moved.ok).toBe(true);
      expect(backdrop(mount).hidden).toBe(false);
      expect(document.body.classList.contains('has-window')).toBe(true);
      expect(location.hash).toBe('#/play/claw-leap');
      expect(shown(mount)).toBe(root);
      expect(statusText(root)).toMatch(new RegExp(`^${moved.state?.turn}:`));
    } finally {
      portal.closeAll();
      mount.remove();
    }
  });

  it('reads a watch code without treating it as a game route', () => {
    expect(watchCodeFromHash('#/watch/ab23k7m')).toBe('AB23K7M');
    expect(watchCodeFromHash('#/play/claw-leap')).toBeNull();
    expect(watchCodeFromHash('')).toBeNull();
  });

  it('shows the live run when a watch page attaches after headless play', async () => {
    const session = generateSessionId();
    const rooms = new Map<string, SessionRoomCore>();
    const hub = {
      store: new MemoryStore(),
      async getRoom(id: string) {
        let room = rooms.get(id);
        if (!room) {
          room = new SessionRoomCore(id, 'https://arcobalneo.github.io/gameclaw/');
          rooms.set(id, room);
        }
        return room;
      },
    };
    const post = async (id: number, name: string, args: Record<string, unknown>) => {
      const res = await handleRequest(
        new Request('https://relay/mcp', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id,
            method: 'tools/call',
            params: { name, arguments: args },
          }),
        }),
        hub,
        { siteUrl: 'https://arcobalneo.github.io/gameclaw/', version: RELAY_VERSION },
      );
      return (await res.json()) as {
        result: {
          structuredContent: {
            ok: boolean;
            watch_url?: string;
            actions?: { id: string }[];
            state?: { turn: number };
          };
        };
      };
    };
    const started = await post(1, 'new_game', { game_id: 'claw-burger', seed: 4 });
    expect(started.result.structuredContent.ok).toBe(true);
    expect(started.result.structuredContent.watch_url).toMatch(/#\/watch\/[23456789A-Z]{7}$/);
    const actionId = playable(started.result.structuredContent.actions);
    const moved = await post(2, 'act', { game_id: 'claw-burger', action_id: actionId });
    expect(moved.result.structuredContent.ok).toBe(true);
    const turn = moved.result.structuredContent.state?.turn ?? 0;
    expect(turn).toBeGreaterThan(0);

    const room = await hub.getRoom(session);
    const sent: string[] = [];
    const socket: SocketLike = {
      readyState: 1,
      send(data: string) {
        sent.push(data);
      },
      close() {
        /* the watch page only reads the desk */
      },
    };
    room.attach(socket);
    const run = sent
      .map((line) => JSON.parse(line) as { type: string; desk?: StoredDesk })
      .find((message) => message.type === 'run');
    expect(run?.desk?.focused).toBe('claw-burger');

    const { mount, portal } = mountPortal();
    try {
      at('');
      expect(backdrop(mount).hidden).toBe(true);
      await applyDesk(portal, run!.desk!);
      expect(location.hash).toBe('#/play/claw-burger');
      expect(backdrop(mount).hidden).toBe(false);
      expect(shown(mount)?.dataset.id).toBe('claw-burger');
      expect(statusText(shown(mount))).toMatch(new RegExp(`^${turn}:`));
    } finally {
      portal.closeAll();
      mount.remove();
    }
  });

  it('does not open a window for an unknown game', async () => {
    const { mount, portal, api } = mountPortal();
    try {
      at('#/');
      const res = await call(api, 'open_game', { game_id: 'not-a-game' });
      expect(res.ok).toBe(false);
      expect(backdrop(mount).hidden).toBe(true);
      expect(location.hash).toBe('#/');
      expect(shown(mount)).toBeNull();
    } finally {
      portal.closeAll();
      mount.remove();
    }
  });
});
