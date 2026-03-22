import React from 'react';
import { Box, Text, render } from 'ink';
import { PassThrough } from 'node:stream';
import type { ActionOption, CaseConfig, GameState } from './model.js';

function Header({ state, caseConfig }: { state: GameState; caseConfig: CaseConfig }) {
  return (
    <Box flexDirection="column">
      <Text color="cyanBright">STATE:</Text>
      <Text>
        case={caseConfig.chineseName} slot={state.slot} turn={state.turn} room={state.roomId} outcome={state.outcome}
      </Text>
      <Text>
        focus={state.focus} nerve={state.nerve} dread={state.dread} evidence={state.evidence} objective={state.objectiveCollected ? state.objectiveQuality : 'not-held'}
      </Text>
    </Box>
  );
}

function View({ lines }: { lines: string[] }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="magentaBright">VIEW:</Text>
      {lines.map((line, index) => (
        <Text key={index}>{line}</Text>
      ))}
    </Box>
  );
}

function ListSection({ title, lines, color }: { title: string; lines: string[]; color: string }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={color}>{title}</Text>
      {lines.map((line, index) => (
        <Text key={index}>{line}</Text>
      ))}
    </Box>
  );
}

function Snapshot({ state, caseConfig, actions, viewLines }: { state: GameState; caseConfig: CaseConfig; actions: ActionOption[]; viewLines: string[] }) {
  return (
    <Box flexDirection="column">
      <Header state={state} caseConfig={caseConfig} />
      <View lines={viewLines} />
      <ListSection
        title="THREATS:"
        color="redBright"
        lines={[
          state.currentPhenomenon ? `active=${state.currentPhenomenon.title}` : 'active=none-visible',
          `dread-band=${state.dread >= 7 ? 'the station is looking back' : state.dread >= 4 ? 'pressure climbing' : 'uneasy but survivable'}`,
          `nerve-band=${state.nerve <= 2 ? 'on the edge of collapse' : state.nerve <= 4 ? 'shaking' : 'holding line'}`
        ]}
      />
      <ListSection
        title="OBJECTIVE:"
        color="greenBright"
        lines={[
          `collect=${state.objectiveCollected ? state.objectiveQuality : 'not-yet'}`,
          `recorded-clues=${state.recordedClues.length}`,
          `required-evidence=${caseConfig.requiredEvidence}`
        ]}
      />
      <ListSection title="ACTIONS:" color="yellowBright" lines={actions.map((action) => `${action.id} :: ${action.label} [${action.risk}]`)} />
      <ListSection title="RESULT:" color="blueBright" lines={[state.latestResult ?? 'freshly loaded']} />
      <ListSection
        title="NEXT:"
        color="whiteBright"
        lines={state.history.slice(-3).map((entry) => `${entry.turn}. ${entry.action} -> ${entry.result}`)}
      />
    </Box>
  );
}

export async function renderSnapshot(args: { state: GameState; caseConfig: CaseConfig; actions: ActionOption[]; viewLines: string[] }): Promise<string> {
  const stream = new PassThrough();
  let output = '';
  stream.on('data', (chunk) => {
    output += chunk.toString();
  });
  const app = render(<Snapshot {...args} />, { stdout: stream as any, exitOnCtrlC: false });
  await new Promise((resolve) => setTimeout(resolve, 50));
  app.unmount();
  return output.trimEnd();
}

export async function renderAsciiBlock(title: string, lines: string[]): Promise<string> {
  const stream = new PassThrough();
  let output = '';
  stream.on('data', (chunk) => (output += chunk.toString()));
  const app = render(
    <Box flexDirection="column">
      <Text color="magentaBright">ASCII WITNESS:</Text>
      <Text>{title}</Text>
      {lines.map((line, index) => (
        <Text key={index}>{line}</Text>
      ))}
    </Box>,
    { stdout: stream as any, exitOnCtrlC: false }
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  // stream capture - use stream capture only
  app.unmount();
  return output.trimEnd();
}
