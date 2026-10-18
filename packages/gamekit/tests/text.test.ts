import { describe, expect, it } from 'vitest';
import { Palette, resolveColorEnabled } from '../src/color';
import { displayWidth, padEndDisplay, truncateDisplay, wrapText } from '../src/text';

describe('text', () => {
  it('counts CJK characters as double width', () => {
    expect(displayWidth('龙虾abc')).toBe(2 + 2 + 3);
  });

  it('pads using display width', () => {
    const padded = padEndDisplay('龙虾', 8);
    expect(displayWidth(padded)).toBe(8);
  });

  it('truncates without exceeding the width', () => {
    const result = truncateDisplay('一二三四五六七八九十', 7);
    expect(displayWidth(result)).toBeLessThanOrEqual(7);
    expect(result.endsWith('…')).toBe(true);
  });

  it('wraps long CJK text', () => {
    const lines = wrapText('龙虾'.repeat(20), 10);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(displayWidth(line)).toBeLessThanOrEqual(10);
  });
});

describe('color', () => {
  it('respects NO_COLOR', () => {
    expect(resolveColorEnabled(true, true, { NO_COLOR: '1' })).toBe(false);
  });

  it('enables colour only for TTY by default', () => {
    expect(resolveColorEnabled(undefined, false, {})).toBe(false);
    expect(resolveColorEnabled(undefined, true, {})).toBe(true);
  });

  it('emits escape codes only when enabled', () => {
    expect(new Palette({ enabled: false }).bold('x')).toBe('x');
    expect(new Palette({ enabled: true }).bold('x')).toContain('\u001B[1m');
  });
});
