import { test } from 'vitest';
import { MemorySession } from '@gameclaw/gamekit';
const G = process.env.G ?? 'shrimp-conquest';
test('path', async () => {
  const { definition } = await import(`../../games/${G}/src/definition.ts`);
  const found: Record<string, number[]> = {};
  let r = 12345;
  const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let trial = 0; trial < 400; trial++) {
    const s = MemorySession.create(definition, { seed: 7 });
    const seq: number[] = [];
    for (let i = 0; i < 120; i++) {
      const ph = ((s.state as any).phase ?? 'x') + (process.env.K ? ':' + (s.state as any)[process.env.K] : '');
      const key = `${ph}${s.status().outcome !== 'ongoing' ? ':' + s.status().outcome : ''}`;
      if (!found[key] || found[key].length > seq.length) found[key] = [...seq];
      const acts = s.actions().filter((a) => a.id !== 'abort');
      if (!acts.length) break;
      const k = Math.floor(rnd() * acts.length);
      seq.push(k);
      try { s.act(acts[k]!.id); } catch { break; }
    }
  }
  for (const [k, v] of Object.entries(found)) console.log(k, v.length > 40 ? `(len ${v.length})` : v.join(','));
});
