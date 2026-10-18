import fs from 'node:fs';
import process from 'node:process';
import readline from 'node:readline/promises';

import { Palette, resolveColorEnabled } from '../color';
import { GameError, usageError } from '../errors';
import { ensureObserver, runForegroundObserver, stopObserver } from '../observer';
import type { GamePaths } from '../paths';
import { gamePaths, resolveRoot } from '../paths';
import { writeRecapReport } from '../report';
import { Session } from '../session';
import { summarizeSaves } from '../store';
import type { ActionView, GameDefinition, RecapView, SaveFile, StatusView } from '../types';
import { parseCliInput, parsePort, parseSeed, parseSlot } from './args';
import {
  renderActions,
  renderFrameText,
  renderHelp,
  renderRecapText,
  renderSavesText,
  renderStatus,
} from './output';

export interface CliIo {
  out(text: string): void;
  err(text: string): void;
  isTTY: boolean;
  readLine(prompt: string): Promise<string | null>;
  close?(): void;
}

export interface RunCliOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  io?: CliIo;
}

export function createProcessIo(): CliIo {
  let rl: readline.Interface | undefined;
  const ensureRl = (): readline.Interface => {
    if (!rl) {
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: process.stdin.isTTY === true,
      });
    }
    return rl;
  };
  return {
    out: (text) => process.stdout.write(`${text}\n`),
    err: (text) => process.stderr.write(`${text}\n`),
    isTTY: process.stdout.isTTY === true,
    readLine: async (prompt) => {
      try {
        return await ensureRl().question(prompt);
      } catch {
        return null;
      }
    },
    close: () => rl?.close(),
  };
}

interface EnvelopeInput<S> {
  game: GameDefinition<S>;
  save: SaveFile<S>;
  status: StatusView;
  actions: ActionView[];
  log?: string[];
  events?: unknown[];
  observerUrl?: string;
  report?: { html: string; markdown: string };
  recap?: RecapView;
}

function envelope<S>(input: EnvelopeInput<S>): Record<string, unknown> {
  const { game, save, status, actions } = input;
  return {
    ok: true,
    game: {
      id: game.meta.id,
      name: game.meta.name,
      englishName: game.meta.englishName,
      version: game.meta.version,
    },
    slot: save.slot,
    runId: save.runId,
    seed: save.seed,
    turn: save.turn,
    outcome: status.outcome,
    phase: status.phase ?? null,
    status: {
      headline: status.headline,
      metrics: status.metrics,
      sections: status.sections,
    },
    actions,
    log: input.log ?? [],
    events: input.events ?? [],
    observer: input.observerUrl ? { url: input.observerUrl } : null,
    report: input.report ?? null,
    recap: input.recap ?? null,
    next: status.outcome === 'ongoing' && actions[0] ? `act ${actions[0].id}` : null,
  };
}

function printError(error: GameError, io: CliIo, json: boolean): void {
  if (json) {
    io.out(
      JSON.stringify(
        {
          ok: false,
          error: { code: error.code, message: error.message, hint: error.hint ?? null },
        },
        null,
        2,
      ),
    );
    return;
  }
  io.err(`ERROR [${error.code}] ${error.message}`);
  if (error.hint) io.err(`HINT  ${error.hint}`);
}

function printFrame<S>(
  game: GameDefinition<S>,
  save: SaveFile<S>,
  status: StatusView,
  actions: ActionView[],
  palette: Palette,
  io: CliIo,
  extras: {
    log?: string[];
    observerUrl?: string;
    reportHtml?: string;
    reportMarkdown?: string;
    verbose?: boolean;
  },
): void {
  io.out(
    renderFrameText(
      {
        meta: game.meta,
        slot: save.slot,
        turn: save.turn,
        outcome: status.outcome,
        seed: save.seed,
        status,
        actions,
        ...extras,
      },
      palette,
    ),
  );
}

function parseFormat(raw: string | undefined): 'text' | 'markdown' | 'html' {
  const value = raw ?? 'text';
  if (value === 'text' || value === 'markdown' || value === 'html') return value;
  throw usageError(`Unknown --format value: ${value}`, 'Use one of: text, markdown, html');
}

function printRecap(recap: RecapView, palette: Palette, io: CliIo): void {
  io.out(renderRecapText(recap, palette));
}

export async function runCli<S>(
  game: GameDefinition<S>,
  options: RunCliOptions = {},
): Promise<number> {
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const io = options.io ?? createProcessIo();

  let input: ReturnType<typeof parseCliInput>;
  try {
    input = parseCliInput(argv);
  } catch (error) {
    const gameError = error instanceof GameError ? error : new GameError('INTERNAL', String(error));
    printError(gameError, io, argv.includes('--json'));
    return gameError.exitCode;
  }

  const { command, values } = input;
  const wantsJson = values.json;
  const palette = new Palette({ enabled: resolveColorEnabled(values.color, io.isTTY, env) });

  try {
    if (values.help || values.version) {
      if (values.version) io.out(`${game.meta.id} v${game.meta.version}`);
      else io.out(renderHelp(game.meta, resolveRoot(values.stateDir, env)));
      return 0;
    }

    if (command === 'help') {
      io.out(renderHelp(game.meta, resolveRoot(values.stateDir, env)));
      return 0;
    }
    if (command === 'version') {
      io.out(`${game.meta.id} v${game.meta.version}`);
      return 0;
    }

    const root = resolveRoot(values.stateDir, env);
    const paths = gamePaths(root, game.meta.id);

    if (command === '__observer-daemon') {
      if (values.gameId && values.gameId !== game.meta.id) {
        throw new GameError('INTERNAL', 'Observer daemon game id mismatch');
      }
      runForegroundObserver(game, { paths, port: parsePort(values.port, 8000) });
      return 0;
    }

    const slot = parseSlot(values.slot);
    const session = new Session(game, root, slot);

    if (command === 'doctor') {
      const lines = [
        `GAME    ${game.meta.id} v${game.meta.version}`,
        `ROOT    ${root}`,
        `SAVES   ${paths.savesDir}`,
        `REPORTS ${paths.reportsDir}`,
        `RUNTIME node=${process.version} bun=${process.versions.bun ?? '-'}`,
        `SLOTS   ${
          summarizeSaves<S>(paths, (state) => {
            const status = game.status(state);
            return { turn: status.turn, outcome: status.outcome, headline: status.headline };
          })
            .map((summary) => `${summary.slot}:${summary.outcome ?? 'empty'}`)
            .join(' ') || '(none)'
        }`,
      ];
      io.out(lines.join('\n'));
      return 0;
    }

    if (command === 'saves') {
      const summaries = summarizeSaves<S>(paths, (state) => {
        const status = game.status(state);
        return { turn: status.turn, outcome: status.outcome, headline: status.headline };
      });
      if (wantsJson) {
        io.out(JSON.stringify({ ok: true, game: game.meta.id, saves: summaries }, null, 2));
      } else {
        io.out(renderSavesText(summaries));
      }
      return 0;
    }

    if (command === 'new') {
      const seed = parseSeed(values.seed);
      const save = session.create({
        seed,
        content: values.content,
        difficulty: values.difficulty,
        force: values.force,
      });
      const status = session.status(save);
      if (status.outcome !== 'ongoing') {
        throw new GameError('INTERNAL', 'A new run cannot be already finished');
      }
      const observer = await ensureObserver(game, paths, { enabled: values.observer });
      const actions = session.actions(save);
      if (wantsJson) {
        io.out(
          JSON.stringify(
            envelope({ game, save, status, actions, observerUrl: observer?.url }),
            null,
            2,
          ),
        );
      } else {
        printFrame(game, save, status, actions, palette, io, {
          observerUrl: observer?.url,
          verbose: values.verbose,
        });
        if (!observer && values.observer !== false) {
          io.err('OBSERVER unavailable: could not start the local observer page.');
        }
      }
      return 0;
    }

    if (command === 'status') {
      const save = session.load();
      const status = session.status(save);
      const actions = session.actions(save);
      if (wantsJson) {
        io.out(JSON.stringify(envelope({ game, save, status, actions }), null, 2));
      } else {
        io.out(
          renderFrameText(
            {
              meta: game.meta,
              slot: save.slot,
              turn: save.turn,
              outcome: status.outcome,
              seed: save.seed,
              status,
              actions: [],
            },
            palette,
          ),
        );
      }
      return 0;
    }

    if (command === 'actions') {
      const save = session.load();
      const status = session.status(save);
      const actions = session.actions(save);
      if (wantsJson) {
        io.out(JSON.stringify(envelope({ game, save, status, actions }), null, 2));
      } else {
        io.out(renderActions(actions, palette, values.verbose).join('\n'));
      }
      return 0;
    }

    if (command === 'act') {
      const actionId = input.positionals[0];
      if (!actionId) {
        throw usageError('Missing action id.', 'Run `actions` to list legal ids, then `act <id>`.');
      }
      const outcome = session.act(actionId);
      const ended = outcome.status.outcome !== 'ongoing';
      const report = ended
        ? finalizeIfEnded(paths, game, outcome.save, outcome.status, values.report !== false)
        : undefined;
      if (ended && values.observer !== false) await stopObserver(paths);
      if (wantsJson) {
        io.out(
          JSON.stringify(
            envelope({
              game,
              save: outcome.save,
              status: outcome.status,
              actions: outcome.actions,
              log: outcome.result.log,
              events: outcome.result.events,
              report,
            }),
            null,
            2,
          ),
        );
      } else {
        printFrame(game, outcome.save, outcome.status, outcome.actions, palette, io, {
          log: outcome.result.log,
          reportHtml: report?.html,
          reportMarkdown: report?.markdown,
          verbose: values.verbose,
        });
      }
      return 0;
    }

    if (command === 'recap') {
      const save = session.load();
      const format = parseFormat(values.format);
      const recap = session.recap(save);
      const report =
        format === 'html' || format === 'markdown' || values.report !== false
          ? writeRecapReport(paths, game.meta, save, recap)
          : undefined;
      if (wantsJson) {
        io.out(
          JSON.stringify(
            envelope({
              game,
              save,
              status: session.status(save),
              actions: session.actions(save),
              recap,
              report,
            }),
            null,
            2,
          ),
        );
        return 0;
      }
      if (format === 'html') {
        io.out(report?.html ?? '');
      } else if (format === 'markdown') {
        io.out(report ? fs.readFileSync(report.markdown, 'utf8') : renderMarkdownFallback(recap));
      } else {
        printRecap(recap, palette, io);
        if (report) io.out(`REPORT ${report.html}`);
      }
      return 0;
    }

    if (command === 'observer') {
      runForegroundObserver(game, { paths, port: parsePort(values.port, 8000) });
      return 0;
    }

    if (command === 'play') {
      return await playLoop(game, session, values, palette, io);
    }

    throw usageError(
      `Unknown command: ${command}`,
      'Commands: new, status, actions, act, recap, saves, play, observer, doctor, help, version',
    );
  } catch (error) {
    const gameError =
      error instanceof GameError
        ? error
        : new GameError('INTERNAL', error instanceof Error ? error.message : String(error));
    printError(gameError, io, wantsJson);
    return gameError.exitCode;
  } finally {
    io.close?.();
  }
}

function finalizeIfEnded<S>(
  paths: GamePaths,
  game: GameDefinition<S>,
  save: SaveFile<S>,
  status: StatusView,
  reportEnabled: boolean,
): { html: string; markdown: string } | undefined {
  if (status.outcome === 'ongoing' || !reportEnabled) return undefined;
  return writeRecapReport(paths, game.meta, save, game.recap(save.state));
}

function renderMarkdownFallback(recap: RecapView): string {
  return [
    `# ${recap.title}`,
    '',
    `outcome: ${recap.outcome}`,
    '',
    recap.cause,
    '',
    ...recap.lessons.map((lesson) => `- ${lesson}`),
  ].join('\n');
}

async function playLoop<S>(
  game: GameDefinition<S>,
  session: Session<S>,
  values: ReturnType<typeof parseCliInput>['values'],
  palette: Palette,
  io: CliIo,
): Promise<number> {
  let save = session.hasSave() ? session.load() : session.create({ seed: parseSeed(values.seed) });
  let status = session.status(save);
  if (status.outcome !== 'ongoing') {
    throw new GameError(
      'GAME_OVER',
      `Slot ${save.slot} already ended with outcome=${status.outcome}.`,
      'Run `new --force` to start a fresh run.',
    );
  }
  const observer = await ensureObserver(game, session.paths, { enabled: values.observer });
  if (observer) io.out(`OBSERVER ${observer.url}`);
  io.out('Type an action id (or its number), /status, /actions, /recap, /quit.');

  while (true) {
    status = session.status(save);
    const actions = session.actions(save);
    printFrame(game, save, status, actions, palette, io, { verbose: values.verbose });
    if (status.outcome !== 'ongoing') break;

    const line = await io.readLine('> ');
    if (line === null) {
      if (game.abort) {
        save = session.act('abort').save;
        continue;
      }
      break;
    }
    const command = line.trim();
    if (command === '') continue;
    if (command === '/quit' || command === 'quit') {
      if (game.abort) {
        save = session.act('abort').save;
        continue;
      }
      break;
    }
    if (command === '/status') {
      io.out(renderStatus(session.status(save), palette).join('\n'));
      continue;
    }
    if (command === '/actions') {
      io.out(renderActions(session.actions(save), palette, true).join('\n'));
      continue;
    }
    if (command === '/recap') {
      printRecap(session.recap(save), palette, io);
      continue;
    }
    if (command === '/help') {
      io.out('Enter an action id, a number from the list, or /status /actions /recap /quit.');
      continue;
    }
    try {
      save = session.act(command).save;
    } catch (error) {
      printError(
        error instanceof GameError ? error : new GameError('INTERNAL', String(error)),
        io,
        false,
      );
    }
  }

  const finalStatus = session.status(save);
  if (finalStatus.outcome !== 'ongoing') {
    const recap = session.recap(save);
    printRecap(recap, palette, io);
    if (values.report !== false) {
      const report = writeRecapReport(session.paths, game.meta, save, recap);
      io.out(`REPORT ${report.html}`);
    }
    if (values.observer !== false) await stopObserver(session.paths);
  }
  return 0;
}
