import { MemorySession } from '@gameclaw/gamekit';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../src/catalog';
import { createApi, type PortalController, toolDescriptors } from '../src/runtime/agent-api';
import { getHost } from '../src/runtime/host';
import { buildPrompt, TOOL_NAMES } from '../src/runtime/prompt';
import { GAME_IDS, loadGame } from '../src/runtime/registry';

(globalThis as { window?: unknown }).window ??= {
  location: { origin: 'https://arcobalneo.github.io', pathname: '/gameclaw/' },
};

describe('catalog', () => {
  it('covers every registered game exactly once', () => {
    expect(GAMES.map((g) => g.id).sort()).toEqual([...GAME_IDS].sort());
    expect(GAMES).toHaveLength(11);
  });
});

describe.each(GAME_IDS)('%s module', (id) => {
  it('loads, matches its catalog id, and plays 12 deterministic turns', async () => {
    const mod = await loadGame(id);
    expect(mod.definition.meta.id).toBe(id);
    const run = () => {
      const s = MemorySession.create(mod.definition, { seed: 42 });
      const trail: string[] = [];
      for (let i = 0; i < 12 && s.status().outcome === 'ongoing'; i += 1) {
        const choices = s.actions().filter((a) => a.id !== 'abort');
        if (choices.length === 0) break;
        const pick = choices[i % choices.length]!;
        s.act(pick.id);
        trail.push(pick.id);
      }
      return { trail, headline: s.status().headline };
    };
    expect(run()).toEqual(run());
  });
});

describe('agent api', () => {
  const opened: string[] = [];
  let focused: string | null = null;
  const portal: PortalController = {
    async open(id) {
      opened.push(id);
      focused = id;
      return getHost(id);
    },
    close() {
      focused = null;
    },
    focused: () => focused,
  };
  const api = createApi(portal, '3.0.0');

  it('lists all games', async () => {
    const res = (await api.listGames()) as { games: { id: string }[] };
    expect(res.games).toHaveLength(11);
  });

  it('reports a helpful error before any game is open', async () => {
    const res = await api.getState();
    expect(res.ok).toBe(false);
    expect(String(res.hint)).toContain('open_game');
  });

  it('rejects unknown ids without throwing', async () => {
    const res = await api.openGame({ game_id: 'shrimp-nope' });
    expect(res.ok).toBe(false);
  });

  it('opens, starts, acts and recaps', async () => {
    await api.openGame({ game_id: 'shrimp-leap' });
    const fresh = await api.newGame({ seed: 7 });
    expect(fresh.ok).not.toBe(false);
    const listed = (await api.listActions()) as { actions: { id: string; index: number }[] };
    expect(listed.actions.length).toBeGreaterThan(0);
    const moved = await api.act({ action_id: listed.actions[0]!.id });
    expect(moved.ok).toBe(true);
    const byIndex = await api.act({ action_id: '1' });
    expect(byIndex.ok).toBe(true);
    const bad = await api.act({ action_id: 'definitely-not-an-action' });
    expect(bad.ok).toBe(false);
    const recap = await api.recap();
    expect(recap).toBeTruthy();
    expect(opened).toContain('shrimp-leap');
  });

  it('exposes exactly the documented WebMCP tools', () => {
    const names = toolDescriptors(api).map((t) => t.name);
    expect(names).toEqual([...TOOL_NAMES]);
    expect(names).toEqual([
      'list_games',
      'open_game',
      'new_game',
      'get_state',
      'list_actions',
      'act',
      'recap',
    ]);
  });
});

describe('prompt', () => {
  it('is bilingual and points at the game url and tools', () => {
    const game = GAMES[0]!;
    const text = buildPrompt(game, ['先看状态']);
    expect(text).toContain(`#/play/${game.id}`);
    expect(text).toContain('list_actions');
    expect(text).toMatch(/[\u4e00-\u9fff]/);
    expect(text).toMatch(/Play|play/);
    expect(text).toContain('window.gameclaw');
  });
});
