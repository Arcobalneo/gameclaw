import type { ActionView, StatusView } from '@gameclaw/gamekit';
import { GAMES, gameName } from '../catalog';
import { lang } from '../i18n';
import { localizeActions, localizeLines, localizeRecap, localizeStatus } from '../i18n/localize';
import type { GameHost } from './host';
import { hasGame } from './registry';

/**
 * Agent surface. The same functions back three transports:
 *   1. WebMCP (`document.modelContext.registerTool`, Chrome 146+ early preview),
 *   2. legacy / extension WebMCP (`navigator.modelContext.registerTool`, e.g. MCP-B),
 *   3. a plain `window.gameclaw` JS API for agents that drive the page via script.
 * Every call returns JSON and never throws; errors come back as `{ ok:false, error, hint }`.
 */
export interface PortalController {
  open(id: string, source: 'agent' | 'human'): Promise<GameHost>;
  close(id?: string): void;
  focused(): string | null;
}

type Json = Record<string, unknown>;

function compactStatus(status: StatusView, gameId: string): Json {
  const view = localizeStatus(gameId, status, lang());
  return {
    headline: view.headline,
    outcome: view.outcome,
    turn: view.turn,
    ...(view.phase ? { phase: view.phase } : {}),
    metrics: view.metrics.map((m) => ({
      label: m.label,
      value: m.value,
      ...(m.hint ? { hint: m.hint } : {}),
    })),
    sections: view.sections,
  };
}

function compactActions(actions: ActionView[], gameId: string): Json[] {
  return localizeActions(gameId, actions, lang()).map((a, i) => ({
    index: i + 1,
    id: a.id,
    label: a.label,
    ...(a.detail ? { detail: a.detail } : {}),
    ...(a.risk ? { risk: a.risk } : {}),
    ...(a.cost ? { cost: a.cost } : {}),
  }));
}

export interface GameclawApi {
  version: string;
  listGames(): Promise<Json>;
  openGame(args: { game_id: string }): Promise<Json>;
  newGame(args?: { game_id?: string; seed?: number; difficulty?: string }): Promise<Json>;
  getState(args?: { game_id?: string }): Promise<Json>;
  listActions(args?: { game_id?: string }): Promise<Json>;
  act(args: { action_id: string; game_id?: string }): Promise<Json>;
  recap(args?: { game_id?: string }): Promise<Json>;
  closeGame(args?: { game_id?: string }): Promise<Json>;
}

export function createApi(portal: PortalController, version: string): GameclawApi {
  async function resolve(gameId?: string): Promise<GameHost | Json> {
    const id = gameId || portal.focused();
    if (!id)
      return {
        ok: false,
        error: 'No game is open.',
        hint: 'Call open_game with a game_id from list_games first.',
      };
    if (!hasGame(id))
      return {
        ok: false,
        error: `Unknown game_id: ${id}`,
        hint: `Valid ids: ${GAMES.map((g) => g.id).join(', ')}`,
      };
    return portal.open(id, 'agent');
  }
  const isErr = (v: GameHost | Json): v is Json => !('session' in v);

  return {
    version,
    async listGames() {
      return {
        ok: true,
        focused: portal.focused(),
        games: GAMES.map((g) => ({
          id: g.id,
          name: gameName(g, lang()),
          english_name: g.englishName,
          tagline: lang() === 'zh' ? g.tagZh : g.tagEn,
          goal: lang() === 'zh' ? g.goal : g.goalEn,
        })),
      };
    },
    async openGame({ game_id }) {
      const host = await resolve(game_id);
      if (isErr(host)) return host;
      return {
        ok: true,
        game_id: host.id,
        seed: host.seed,
        state: compactStatus(host.status(), host.id),
        actions: compactActions(host.actions(), host.id),
      };
    },
    async newGame(args = {}) {
      const host = await resolve(args.game_id);
      if (isErr(host)) return host;
      try {
        host.newGame({
          ...(args.seed !== undefined ? { seed: Number(args.seed) } : {}),
          ...(args.difficulty ? { difficulty: args.difficulty } : {}),
          source: 'agent',
        });
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
      return {
        ok: true,
        game_id: host.id,
        seed: host.seed,
        guide: localizeLines(host.id, host.module.definition.meta.guide, lang()),
        state: compactStatus(host.status(), host.id),
        actions: compactActions(host.actions(), host.id),
      };
    },
    async getState(args = {}) {
      const host = await resolve(args.game_id);
      if (isErr(host)) return host;
      return {
        ok: true,
        game_id: host.id,
        seed: host.seed,
        state: compactStatus(host.status(), host.id),
        actions: compactActions(host.actions(), host.id),
      };
    },
    async listActions(args = {}) {
      const host = await resolve(args.game_id);
      if (isErr(host)) return host;
      const status = host.status();
      return {
        ok: true,
        game_id: host.id,
        outcome: status.outcome,
        turn: status.turn,
        actions: compactActions(host.actions(), host.id),
      };
    },
    async act(args) {
      if (!args || typeof args.action_id !== 'string' || !args.action_id.trim())
        return {
          ok: false,
          error: 'action_id is required.',
          hint: 'Pass an id (or 1-based index) from list_actions.',
        };
      const host = await resolve(args.game_id);
      if (isErr(host)) return host;
      const res = host.tryAct(args.action_id, 'agent');
      if (!res.ok) return { ...res, game_id: host.id };
      const o = res.outcome;
      return {
        ok: true,
        game_id: host.id,
        action: o.action.id,
        log: localizeLines(host.id, o.result.log, lang()),
        events: o.events,
        state: compactStatus(o.status, host.id),
        actions: compactActions(o.actions, host.id),
        ...(o.status.outcome !== 'ongoing'
          ? { next: 'Run ended. Call recap for the settlement.' }
          : {}),
      };
    },
    async recap(args = {}) {
      const host = await resolve(args.game_id);
      if (isErr(host)) return host;
      return {
        ok: true,
        game_id: host.id,
        seed: host.seed,
        recap: localizeRecap(host.id, host.recap(), lang()),
      };
    },
    async closeGame(args = {}) {
      portal.close(args.game_id);
      return { ok: true, focused: portal.focused() };
    },
  };
}

// ---------------- WebMCP registration ----------------

interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Json;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Json) => Promise<unknown>;
}

interface ModelContextLike {
  registerTool(tool: ToolDescriptor, options?: { signal?: AbortSignal }): unknown;
}

const gameIdProp = {
  type: 'string',
  description: 'Game id such as shrimp-trek. Defaults to the game focused in the page.',
};

export function toolDescriptors(api: GameclawApi): ToolDescriptor[] {
  const ids = GAMES.map((g) => g.id);
  return [
    {
      name: 'list_games',
      description: 'List every GameClaw game playable on this page with its goal.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => api.listGames(),
    },
    {
      name: 'open_game',
      description: 'Open (and focus) a game window so the human can watch; resumes its saved run.',
      inputSchema: {
        type: 'object',
        properties: { game_id: { type: 'string', enum: ids } },
        required: ['game_id'],
      },
      execute: (i) => api.openGame({ game_id: String(i.game_id ?? '') }),
    },
    {
      name: 'new_game',
      description:
        'Start a fresh deterministic run in a game window. Same seed + same actions = same run.',
      inputSchema: {
        type: 'object',
        properties: {
          game_id: gameIdProp,
          seed: {
            type: 'integer',
            minimum: 0,
            description: 'Optional seed for a reproducible run.',
          },
          difficulty: { type: 'string', enum: ['easy', 'normal', 'hard'] },
        },
      },
      execute: (i) =>
        api.newGame({
          ...(i.game_id ? { game_id: String(i.game_id) } : {}),
          ...(i.seed !== undefined ? { seed: Number(i.seed) } : {}),
          ...(i.difficulty ? { difficulty: String(i.difficulty) } : {}),
        }),
    },
    {
      name: 'get_state',
      description: 'Read the current run: headline, metrics, sections, outcome and legal actions.',
      inputSchema: { type: 'object', properties: { game_id: gameIdProp } },
      annotations: { readOnlyHint: true },
      execute: (i) => api.getState(i.game_id ? { game_id: String(i.game_id) } : {}),
    },
    {
      name: 'list_actions',
      description: 'List the legal actions for the current turn.',
      inputSchema: { type: 'object', properties: { game_id: gameIdProp } },
      annotations: { readOnlyHint: true },
      execute: (i) => api.listActions(i.game_id ? { game_id: String(i.game_id) } : {}),
    },
    {
      name: 'act',
      description:
        'Take exactly one action; it animates in the shared game window. Returns log, new state and next actions.',
      inputSchema: {
        type: 'object',
        properties: {
          action_id: {
            type: 'string',
            description: 'An id from list_actions (a unique prefix or 1-based index also works).',
          },
          game_id: gameIdProp,
        },
        required: ['action_id'],
      },
      execute: (i) =>
        api.act({
          action_id: String(i.action_id ?? ''),
          ...(i.game_id ? { game_id: String(i.game_id) } : {}),
        }),
    },
    {
      name: 'recap',
      description:
        'Settlement for the run: outcome, cause, metrics, timeline and lessons worth remembering.',
      inputSchema: { type: 'object', properties: { game_id: gameIdProp } },
      annotations: { readOnlyHint: true },
      execute: (i) => api.recap(i.game_id ? { game_id: String(i.game_id) } : {}),
    },
  ];
}

export type WebMcpMode = 'document.modelContext' | 'navigator.modelContext' | 'polyfill';

/** Registers tools on the native WebMCP surface when present, else installs a small polyfill. */
export function registerWebMcp(api: GameclawApi): WebMcpMode {
  const doc = document as Document & { modelContext?: ModelContextLike };
  const nav = navigator as Navigator & { modelContext?: ModelContextLike };
  const tools = toolDescriptors(api);
  const controller = new AbortController();

  if (doc.modelContext && typeof doc.modelContext.registerTool === 'function') {
    for (const tool of tools) {
      try {
        void Promise.resolve(
          doc.modelContext.registerTool(tool, { signal: controller.signal }),
        ).catch((e) => console.warn('[gameclaw] WebMCP registerTool failed', tool.name, e));
      } catch (e) {
        console.warn('[gameclaw] WebMCP registerTool failed', tool.name, e);
      }
    }
    return 'document.modelContext';
  }
  if (nav.modelContext && typeof nav.modelContext.registerTool === 'function') {
    for (const tool of tools) {
      try {
        nav.modelContext.registerTool({
          ...tool,
          // MCP-B style transports expect MCP CallToolResult content.
          execute: async (input) => {
            const data = await tool.execute(input ?? {});
            return {
              content: [{ type: 'text', text: JSON.stringify(data) }],
              structuredContent: data,
            };
          },
        });
      } catch (e) {
        console.warn('[gameclaw] navigator.modelContext.registerTool failed', tool.name, e);
      }
    }
    return 'navigator.modelContext';
  }
  // Polyfill: same shape as the draft (registerTool / getTools / executeTool).
  const registry = new Map<string, ToolDescriptor>();
  const polyfill = {
    __gameclawPolyfill: true,
    registerTool(tool: ToolDescriptor) {
      registry.set(tool.name, tool);
    },
    getTools() {
      return [...registry.values()].map(({ name, description, inputSchema, annotations }) => ({
        name,
        description,
        inputSchema,
        annotations,
      }));
    },
    async executeTool(tool: string | { name: string }, input: Json | string = {}) {
      const name = typeof tool === 'string' ? tool : tool.name;
      const t = registry.get(name);
      if (!t) return JSON.stringify({ ok: false, error: `Unknown tool ${name}` });
      const args = typeof input === 'string' ? (JSON.parse(input || '{}') as Json) : input;
      return JSON.stringify(await t.execute(args ?? {}));
    },
  };
  for (const tool of tools) polyfill.registerTool(tool);
  try {
    Object.defineProperty(doc, 'modelContext', { value: polyfill, configurable: true });
  } catch {
    /* read-only in exotic environments */
  }
  return 'polyfill';
}
