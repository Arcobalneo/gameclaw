import process from 'node:process';

import { runCli } from '@gameclaw/gamekit';

import { definition } from './definition';

process.exitCode = await runCli(definition);
